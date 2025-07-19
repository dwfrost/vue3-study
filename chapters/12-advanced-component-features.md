# 第 12 章：高级组件特性

## 本章概述

Vue3 在组件系统方面引入了许多高级特性，这些特性为开发者提供了更强大的工具来构建复杂的应用程序。本章将深入探讨异步组件、动态组件、高阶组件、组件通信的高级模式、性能优化技术以及自定义渲染器等高级主题。

## 学习目标

- 掌握异步组件的实现原理和使用场景
- 理解动态组件和 keep-alive 的工作机制
- 学会构建和使用高阶组件(HOC)
- 掌握组件间通信的高级模式
- 了解组件性能优化的各种技术
- 理解自定义渲染器的概念和实现
- 掌握函数式组件的使用方法

## 12.1 异步组件与 Suspense

### 12.1.1 异步组件的实现原理

```typescript
// 异步组件的核心实现
export function defineAsyncComponent<
  T extends Component = { new (): ComponentPublicInstance }
>(source: AsyncComponentLoader<T> | AsyncComponentOptions<T>): T {
  if (isFunction(source)) {
    source = { loader: source };
  }

  const {
    loader,
    loadingComponent,
    errorComponent,
    delay = 200,
    timeout, // undefined = never times out
    suspensible = true,
    onError: userOnError,
  } = source;

  let pendingRequest: Promise<ConcreteComponent> | null = null;
  let resolvedComp: ConcreteComponent | undefined;

  let retries = 0;
  const retry = () => {
    retries++;
    pendingRequest = null;
    return load();
  };

  const load = (): Promise<ConcreteComponent> => {
    let thisRequest: Promise<ConcreteComponent>;
    return (
      pendingRequest ||
      (thisRequest = pendingRequest =
        loader()
          .catch((err) => {
            err = err instanceof Error ? err : new Error(String(err));
            if (userOnError) {
              return new Promise((resolve, reject) => {
                const userRetry = () => resolve(retry());
                const userFail = () => reject(err);
                userOnError(err, userRetry, userFail, retries + 1);
              });
            } else {
              throw err;
            }
          })
          .then((comp: any) => {
            if (thisRequest !== pendingRequest && pendingRequest) {
              return pendingRequest;
            }
            if (__DEV__ && !comp) {
              warn(
                `Async component loader resolved to undefined. ` +
                  `If you are using retry(), make sure to return a valid component.`
              );
            }
            // interop module default
            if (
              comp &&
              (comp.__esModule || comp[Symbol.toStringTag] === "Module")
            ) {
              comp = comp.default;
            }
            if (__DEV__ && comp && !isObject(comp) && !isFunction(comp)) {
              throw new Error(`Invalid async component load result: ${comp}`);
            }
            resolvedComp = comp;
            return comp;
          }))
    );
  };

  return defineComponent({
    name: "AsyncComponentWrapper",
    __asyncLoader: load,
    __asyncResolved: false,
    setup() {
      const instance = currentInstance!;

      // 如果组件已经解析，直接返回
      if (resolvedComp) {
        return () => createInnerComp(resolvedComp, instance);
      }

      const onError = (err: Error) => {
        pendingRequest = null;
        handleError(
          err,
          instance,
          ErrorCodes.ASYNC_COMPONENT_LOADER,
          !errorComponent
        );
      };

      // suspense-controlled or SSR.
      if (
        (__FEATURE_SUSPENSE__ && suspensible && instance.suspense) ||
        (__SSR__ && isInSSRComponentSetup)
      ) {
        return load()
          .then((comp) => {
            return () => createInnerComp(comp, instance);
          })
          .catch(onError);
      }

      const loaded = ref(false);
      const error = ref();
      const delayed = ref(!!delay);

      if (delay) {
        setTimeout(() => {
          delayed.value = false;
        }, delay);
      }

      if (timeout != null) {
        setTimeout(() => {
          if (!loaded.value && !error.value) {
            const err = new Error(
              `Async component timed out after ${timeout}ms.`
            );
            onError(err);
            error.value = err;
          }
        }, timeout);
      }

      load()
        .then(() => {
          loaded.value = true;
          if (instance.parent && isKeepAlive(instance.parent.vnode)) {
            // parent is keep-alive, force update so the loaded component's
            // name is taken into account
            queueJob(instance.parent.update);
          }
        })
        .catch((err) => {
          onError(err);
          error.value = err;
        });

      return () => {
        if (loaded.value && resolvedComp) {
          return createInnerComp(resolvedComp, instance);
        } else if (error.value && errorComponent) {
          return createVNode(errorComponent as ConcreteComponent, {
            error: error.value,
          });
        } else if (loadingComponent && !delayed.value) {
          return createVNode(loadingComponent as ConcreteComponent);
        }
      };
    },
  }) as T;
}

function createInnerComp(
  comp: ConcreteComponent,
  { vnode: { ref, props, children } }: ComponentInternalInstance
) {
  const vnode = createVNode(comp, props, children);
  // ensure inner component inherits the async wrapper's ref owner
  vnode.ref = ref;
  return vnode;
}
```

**异步组件的高级用法**

```javascript
import { defineAsyncComponent, ref, computed } from "vue";

// === 1. 基础异步组件 ===
const AsyncComponent = defineAsyncComponent(() => import("./MyComponent.vue"));

// === 2. 带选项的异步组件 ===
const AsyncComponentWithOptions = defineAsyncComponent({
  // 加载函数
  loader: () => import("./MyComponent.vue"),

  // 加载异步组件时使用的组件
  loadingComponent: LoadingComponent,

  // 展示加载组件前的延迟时间，默认为 200ms
  delay: 200,

  // 加载失败后展示的组件
  errorComponent: ErrorComponent,

  // 如果提供了一个 timeout 时间限制，并超时了
  // 也会显示这里配置的报错组件，默认值是：Infinity
  timeout: 3000,

  // 定义组件是否可挂起，默认值是：true
  suspensible: false,

  // 错误处理函数
  onError(error, retry, fail, attempts) {
    if (error.message.match(/fetch/) && attempts <= 3) {
      // 请求发生错误时重试，最多可尝试 3 次
      retry();
    } else {
      // 注意，retry/fail 就像 promise 的 resolve/reject 一样：
      // 必须调用其中一个才能继续错误处理。
      fail();
    }
  },
});

// === 3. 条件异步加载 ===
function createConditionalAsyncComponent(condition) {
  return defineAsyncComponent({
    loader: () => {
      if (condition()) {
        return import("./ComponentA.vue");
      } else {
        return import("./ComponentB.vue");
      }
    },
  });
}

// === 4. 带缓存的异步组件 ===
const componentCache = new Map();

function createCachedAsyncComponent(componentPath) {
  return defineAsyncComponent({
    loader: async () => {
      if (componentCache.has(componentPath)) {
        return componentCache.get(componentPath);
      }

      const component = await import(componentPath);
      componentCache.set(componentPath, component.default);
      return component.default;
    },
  });
}

// === 5. 动态异步组件 ===
export default {
  setup() {
    const currentComponentName = ref("ComponentA");

    const DynamicAsyncComponent = computed(() => {
      return defineAsyncComponent(() =>
        import(`./components/${currentComponentName.value}.vue`)
      );
    });

    const switchComponent = (name) => {
      currentComponentName.value = name;
    };

    return {
      DynamicAsyncComponent,
      switchComponent,
    };
  },
};
```

### 12.1.2 Suspense 组件详解

```javascript
// === Suspense的基础用法 ===
<template>
  <Suspense>
    <!-- 具有深层异步依赖的组件 -->
    <template #default>
      <AsyncComponent />
    </template>

    <!-- 在 #fallback 插槽中显示 "正在加载中" -->
    <template #fallback>
      <div>Loading...</div>
    </template>
  </Suspense>
</template>

// === 嵌套Suspense ===
<template>
  <Suspense>
    <template #default>
      <div>
        <h1>主要内容</h1>
        <Suspense>
          <template #default>
            <AsyncChildComponent />
          </template>
          <template #fallback>
            <div>加载子组件中...</div>
          </template>
        </Suspense>
      </div>
    </template>
    <template #fallback>
      <div>加载主要内容中...</div>
    </template>
  </Suspense>
</template>

// === 错误处理 ===
export default {
  setup() {
    const error = ref(null)

    const handleError = (err) => {
      error.value = err
    }

    return { error, handleError }
  },
  errorCaptured(err, instance, info) {
    this.handleError(err)
    return false
  }
}
```

## 12.2 动态组件与 keep-alive

### 12.2.1 动态组件的高级用法

```javascript
import { ref, computed, shallowRef, markRaw } from "vue";
import ComponentA from "./ComponentA.vue";
import ComponentB from "./ComponentB.vue";
import ComponentC from "./ComponentC.vue";

export default {
  components: {
    ComponentA,
    ComponentB,
    ComponentC,
  },
  setup() {
    // === 1. 基础动态组件 ===
    const currentComponent = ref("ComponentA");

    const switchComponent = (name) => {
      currentComponent.value = name;
    };

    // === 2. 使用组件对象 ===
    const componentMap = {
      a: ComponentA,
      b: ComponentB,
      c: ComponentC,
    };

    const currentComponentObj = ref(ComponentA);

    const switchToComponent = (key) => {
      currentComponentObj.value = componentMap[key];
    };

    // === 3. 条件动态组件 ===
    const userRole = ref("admin");
    const conditionalComponent = computed(() => {
      switch (userRole.value) {
        case "admin":
          return ComponentA;
        case "user":
          return ComponentB;
        default:
          return ComponentC;
      }
    });

    // === 4. 异步动态组件 ===
    const asyncComponents = {
      a: () => import("./AsyncComponentA.vue"),
      b: () => import("./AsyncComponentB.vue"),
      c: () => import("./AsyncComponentC.vue"),
    };

    const currentAsyncComponent = ref(null);

    const loadAsyncComponent = async (key) => {
      const component = await asyncComponents[key]();
      currentAsyncComponent.value = component.default;
    };

    // === 5. 带参数的动态组件 ===
    const componentProps = ref({});
    const componentEvents = ref({});

    const setComponentConfig = (props, events) => {
      componentProps.value = props;
      componentEvents.value = events;
    };

    // === 6. 性能优化：使用shallowRef ===
    const optimizedComponent = shallowRef(ComponentA);

    const switchOptimized = (component) => {
      optimizedComponent.value = markRaw(component);
    };

    return {
      currentComponent,
      currentComponentObj,
      conditionalComponent,
      currentAsyncComponent,
      componentProps,
      componentEvents,
      optimizedComponent,
      switchComponent,
      switchToComponent,
      loadAsyncComponent,
      setComponentConfig,
      switchOptimized,
    };
  },
};
```

### 12.2.2 keep-alive 的高级用法

```javascript
// === 1. 基础keep-alive用法 ===
<template>
  <keep-alive>
    <component :is="currentComponent" />
  </keep-alive>
</template>

// === 2. 条件缓存 ===
<template>
  <keep-alive :include="['ComponentA', 'ComponentB']" :exclude="['ComponentC']">
    <component :is="currentComponent" />
  </keep-alive>
</template>

// === 3. 动态include/exclude ===
export default {
  setup() {
    const includeList = ref(['ComponentA'])
    const excludeList = ref([])

    const addToCache = (componentName) => {
      if (!includeList.value.includes(componentName)) {
        includeList.value.push(componentName)
      }
    }

    const removeFromCache = (componentName) => {
      const index = includeList.value.indexOf(componentName)
      if (index > -1) {
        includeList.value.splice(index, 1)
      }
    }

    return {
      includeList,
      excludeList,
      addToCache,
      removeFromCache
    }
  }
}

// === 4. 最大缓存数量 ===
<template>
  <keep-alive :max="3">
    <component :is="currentComponent" />
  </keep-alive>
</template>

// === 5. 生命周期钩子 ===
export default {
  setup() {
    onActivated(() => {
      console.log('组件被激活')
      // 组件从缓存中恢复时调用
      // 可以在这里刷新数据
    })

    onDeactivated(() => {
      console.log('组件被停用')
      // 组件被缓存时调用
      // 可以在这里保存状态
    })

    return {}
  }
}

// === 6. 高级缓存控制 ===
export default {
  setup() {
    const cacheKey = ref(0)
    const shouldCache = ref(true)

    // 强制重新创建组件实例
    const forceRecreate = () => {
      cacheKey.value++
    }

    // 动态控制是否缓存
    const toggleCache = () => {
      shouldCache.value = !shouldCache.value
    }

    return {
      cacheKey,
      shouldCache,
      forceRecreate,
      toggleCache
    }
  }
}
```

## 12.3 高阶组件(HOC)模式

### 12.3.1 高阶组件的实现

```javascript
import { defineComponent, h } from "vue";

// === 1. 基础高阶组件 ===
function withLoading(WrappedComponent) {
  return defineComponent({
    name: `WithLoading(${WrappedComponent.name})`,
    props: {
      loading: {
        type: Boolean,
        default: false,
      },
    },
    setup(props, { slots, attrs }) {
      return () => {
        if (props.loading) {
          return h("div", { class: "loading" }, "Loading...");
        }

        return h(WrappedComponent, attrs, slots);
      };
    },
  });
}

// 使用高阶组件
const MyComponentWithLoading = withLoading(MyComponent);

// === 2. 权限控制高阶组件 ===
function withAuth(WrappedComponent, requiredPermissions = []) {
  return defineComponent({
    name: `WithAuth(${WrappedComponent.name})`,
    setup(props, { slots, attrs }) {
      const { user, hasPermission } = useAuth();

      return () => {
        if (!user.value) {
          return h("div", { class: "auth-required" }, "请先登录");
        }

        const hasRequiredPermissions = requiredPermissions.every((permission) =>
          hasPermission(permission)
        );

        if (!hasRequiredPermissions) {
          return h("div", { class: "permission-denied" }, "权限不足");
        }

        return h(WrappedComponent, attrs, slots);
      };
    },
  });
}

// 使用权限控制
const AdminPanel = withAuth(AdminPanelComponent, ["admin", "write"]);

// === 3. 数据获取高阶组件 ===
function withData(WrappedComponent, dataFetcher) {
  return defineComponent({
    name: `WithData(${WrappedComponent.name})`,
    setup(props, { slots, attrs }) {
      const data = ref(null);
      const loading = ref(false);
      const error = ref(null);

      const fetchData = async () => {
        loading.value = true;
        error.value = null;
        try {
          data.value = await dataFetcher(props);
        } catch (err) {
          error.value = err;
        } finally {
          loading.value = false;
        }
      };

      onMounted(fetchData);

      // 监听props变化重新获取数据
      watch(() => props, fetchData, { deep: true });

      return () => {
        if (loading.value) {
          return h("div", { class: "loading" }, "Loading data...");
        }

        if (error.value) {
          return h("div", { class: "error" }, `Error: ${error.value.message}`);
        }

        return h(
          WrappedComponent,
          {
            ...attrs,
            data: data.value,
          },
          slots
        );
      };
    },
  });
}

// 使用数据获取
const UserListWithData = withData(UserList, async (props) => {
  const response = await fetch(`/api/users?page=${props.page}`);
  return response.json();
});

// === 4. 组合多个高阶组件 ===
function compose(...hocs) {
  return (WrappedComponent) => {
    return hocs.reduceRight((acc, hoc) => hoc(acc), WrappedComponent);
  };
}

// 组合使用
const EnhancedComponent = compose(
  withLoading,
  withAuth(["read"]),
  withData(fetchUserData)
)(BaseComponent);

// === 5. 高阶组件工厂 ===
function createWithState(initialState) {
  return function withState(WrappedComponent) {
    return defineComponent({
      name: `WithState(${WrappedComponent.name})`,
      setup(props, { slots, attrs }) {
        const state = reactive({ ...initialState });

        const updateState = (newState) => {
          Object.assign(state, newState);
        };

        return () =>
          h(
            WrappedComponent,
            {
              ...attrs,
              state,
              updateState,
            },
            slots
          );
      },
    });
  };
}

// 使用状态工厂
const withUserState = createWithState({ user: null, isLoggedIn: false });
const UserComponent = withUserState(BaseUserComponent);
```

## 12.4 组件通信高级模式

### 12.4.1 事件总线模式

```javascript
// === 1. 简单事件总线 ===
import { ref, onUnmounted } from "vue";

class EventBus {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);

    // 返回取消订阅函数
    return () => {
      const index = this.events[event].indexOf(callback);
      if (index > -1) {
        this.events[event].splice(index, 1);
      }
    };
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach((callback) => callback(...args));
    }
  }

  off(event, callback) {
    if (this.events[event]) {
      const index = this.events[event].indexOf(callback);
      if (index > -1) {
        this.events[event].splice(index, 1);
      }
    }
  }

  once(event, callback) {
    const unsubscribe = this.on(event, (...args) => {
      callback(...args);
      unsubscribe();
    });
    return unsubscribe;
  }
}

// 创建全局事件总线
export const eventBus = new EventBus();

// === 2. 在组件中使用事件总线 ===
export default {
  setup() {
    const message = ref("");

    // 监听事件
    const unsubscribe = eventBus.on("user-login", (user) => {
      message.value = `欢迎 ${user.name}!`;
    });

    // 发送事件
    const login = (user) => {
      eventBus.emit("user-login", user);
    };

    // 组件卸载时清理
    onUnmounted(() => {
      unsubscribe();
    });

    return {
      message,
      login,
    };
  },
};

// === 3. 响应式事件总线 ===
import { reactive, computed } from "vue";

class ReactiveEventBus {
  constructor() {
    this.state = reactive({});
    this.events = {};
  }

  // 设置响应式状态
  setState(key, value) {
    this.state[key] = value;
    this.emit(`state:${key}`, value);
  }

  // 获取响应式状态
  getState(key) {
    return computed(() => this.state[key]);
  }

  // 监听状态变化
  watchState(key, callback) {
    return this.on(`state:${key}`, callback);
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);

    return () => {
      const index = this.events[event].indexOf(callback);
      if (index > -1) {
        this.events[event].splice(index, 1);
      }
    };
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach((callback) => callback(...args));
    }
  }
}

export const reactiveEventBus = new ReactiveEventBus();
```

### 12.4.2 状态管理模式

```javascript
// === 1. 简单状态管理 ===
import { reactive, readonly, computed } from "vue";

function createStore(initialState, actions) {
  const state = reactive(initialState);

  const getters = {};
  const mutations = {};

  // 创建actions
  const wrappedActions = {};
  Object.keys(actions).forEach((key) => {
    wrappedActions[key] = (...args) => {
      return actions[key](
        {
          state,
          getters,
          commit: (type, payload) => {
            if (mutations[type]) {
              mutations[type](state, payload);
            }
          },
        },
        ...args
      );
    };
  });

  return {
    state: readonly(state),
    getters,
    actions: wrappedActions,
    commit: (type, payload) => {
      if (mutations[type]) {
        mutations[type](state, payload);
      }
    },
    registerMutation: (type, handler) => {
      mutations[type] = handler;
    },
    registerGetter: (name, getter) => {
      getters[name] = computed(() => getter(state, getters));
    },
  };
}

// 使用状态管理
const userStore = createStore(
  {
    user: null,
    posts: [],
    loading: false,
  },
  {
    async login({ commit }, credentials) {
      commit("SET_LOADING", true);
      try {
        const user = await api.login(credentials);
        commit("SET_USER", user);
      } finally {
        commit("SET_LOADING", false);
      }
    },

    async fetchPosts({ commit, state }) {
      if (!state.user) return;

      commit("SET_LOADING", true);
      try {
        const posts = await api.getUserPosts(state.user.id);
        commit("SET_POSTS", posts);
      } finally {
        commit("SET_LOADING", false);
      }
    },
  }
);

// 注册mutations
userStore.registerMutation("SET_USER", (state, user) => {
  state.user = user;
});

userStore.registerMutation("SET_POSTS", (state, posts) => {
  state.posts = posts;
});

userStore.registerMutation("SET_LOADING", (state, loading) => {
  state.loading = loading;
});

// 注册getters
userStore.registerGetter("isLoggedIn", (state) => !!state.user);
userStore.registerGetter("userPosts", (state) => state.posts);

// === 2. 模块化状态管理 ===
function createModularStore() {
  const modules = {};
  const globalState = reactive({});

  const registerModule = (name, module) => {
    modules[name] = module;
    globalState[name] = module.state;
  };

  const getModule = (name) => modules[name];

  const dispatch = (action, payload) => {
    const [moduleName, actionName] = action.split("/");
    const module = modules[moduleName];

    if (module && module.actions[actionName]) {
      return module.actions[actionName](payload);
    }
  };

  return {
    state: readonly(globalState),
    registerModule,
    getModule,
    dispatch,
  };
}

// 使用模块化store
const store = createModularStore();

// 用户模块
const userModule = createStore(
  { user: null, loading: false },
  {
    async login({ commit }, credentials) {
      // login logic
    },
  }
);

// 注册模块
store.registerModule("user", userModule);

// 使用
store.dispatch("user/login", credentials);
```

## 12.5 函数式组件

### 12.5.1 函数式组件的实现

```javascript
import { h } from "vue";

// === 1. 基础函数式组件 ===
const FunctionalButton = (props, { slots, emit, attrs }) => {
  return h(
    "button",
    {
      class: ["btn", `btn-${props.type}`],
      onClick: () => emit("click"),
      ...attrs,
    },
    slots.default?.()
  );
};

// 定义props
FunctionalButton.props = {
  type: {
    type: String,
    default: "primary",
  },
};

// 定义emits
FunctionalButton.emits = ["click"];

// === 2. 复杂函数式组件 ===
const DataList = (props, { slots }) => {
  const { items, loading, error } = props;

  if (loading) {
    return h("div", { class: "loading" }, "Loading...");
  }

  if (error) {
    return h("div", { class: "error" }, error.message);
  }

  if (!items || items.length === 0) {
    return h("div", { class: "empty" }, "No data");
  }

  return h(
    "ul",
    { class: "data-list" },
    items.map((item) =>
      h("li", { key: item.id, class: "data-item" }, [
        slots.item ? slots.item({ item }) : item.name,
      ])
    )
  );
};

DataList.props = {
  items: Array,
  loading: Boolean,
  error: Object,
};
```

## 12.6 组件性能优化

### 12.6.1 性能优化技术

```javascript
import { defineComponent, shallowRef, markRaw, computed } from 'vue'

// === 1. 使用shallowRef优化大对象 ===
export default defineComponent({
  setup() {
    // 对于大型不可变对象，使用shallowRef
    const largeData = shallowRef({
      items: new Array(10000).fill(0).map((_, i) => ({ id: i, name: `Item ${i}` }))
    })

    // 更新时需要替换整个对象
    const updateData = (newData) => {
      largeData.value = newData
    }

    return { largeData, updateData }
  }
})

// === 2. 计算属性缓存优化 ===
export default defineComponent({
  setup() {
    const items = ref([])

    // 使用computed缓存昂贵的计算
    const expensiveComputation = computed(() => {
      return items.value
        .filter(item => item.active)
        .map(item => ({
          ...item,
          computed: heavyComputation(item)
        }))
        .sort((a, b) => a.priority - b.priority)
    })

    return {
      items,
      expensiveComputation
    }
  }
})
```

## 12.7 本章总结

本章深入探讨了 Vue3 的高级组件特性：

### 核心要点

1. **异步组件与 Suspense**：提供了优雅的异步加载和错误处理机制
2. **动态组件与 keep-alive**：实现了灵活的组件切换和状态保持
3. **高阶组件模式**：通过函数式编程思想实现组件逻辑复用
4. **组件通信高级模式**：事件总线和状态管理为复杂应用提供了通信方案
5. **函数式组件**：提供了轻量级的组件实现方式
6. **性能优化**：通过各种技术手段提升组件性能

### 最佳实践

- 合理使用异步组件进行代码分割
- 在适当场景下使用 keep-alive 缓存组件状态
- 通过高阶组件实现横切关注点的复用
- 选择合适的组件通信模式
- 在性能敏感场景下使用函数式组件
- 运用各种优化技术提升应用性能

这些高级特性为构建大型、复杂的 Vue3 应用提供了强大的工具和模式。
