# 第 11 章：组合式 API 深度解析

## 本章概述

组合式 API 是 Vue3 最重要的新特性之一，它提供了一种更灵活、更强大的方式来组织和复用组件逻辑。本章将深入探讨组合式 API 的设计理念、核心实现原理、各种 API 的使用方法和最佳实践，帮助你全面掌握这一革命性的特性。

## 学习目标

- 深入理解组合式 API 的设计理念和核心原理
- 掌握 setup 函数的执行机制和上下文管理
- 熟练使用各种响应式 API 及其底层实现
- 了解生命周期 hooks 的工作原理
- 掌握依赖注入系统和逻辑复用最佳实践
- 理解与 Options API 的本质差异和迁移策略

## 11.1 组合式 API 设计理念

### 11.1.1 从 Options API 到 Composition API 的演进

**Options API 的核心问题**

```javascript
// Options API在大型组件中的问题示例 - 用户仪表盘组件
export default {
  name: "UserDashboard",
  data() {
    return {
      // 用户相关状态 - 分散在data中
      user: null,
      userLoading: false,
      userError: null,

      // 订单相关状态 - 分散在data中
      orders: [],
      ordersLoading: false,
      ordersError: null,
      orderFilter: "all",

      // 统计相关状态 - 分散在data中
      stats: null,
      statsLoading: false,
      statsError: null,

      // UI状态 - 分散在data中
      activeTab: "profile",
      sidebarCollapsed: false,
    };
  },
  computed: {
    // 用户相关计算属性 - 分散在computed中
    userName() {
      return this.user?.name || "Unknown User";
    },
    userAvatar() {
      return this.user?.avatar || "/default-avatar.png";
    },

    // 订单相关计算属性 - 分散在computed中
    filteredOrders() {
      return this.orderFilter === "all"
        ? this.orders
        : this.orders.filter((order) => order.status === this.orderFilter);
    },
    totalOrderValue() {
      return this.filteredOrders.reduce((sum, order) => sum + order.amount, 0);
    },

    // 统计相关计算属性 - 分散在computed中
    monthlyRevenue() {
      return this.stats?.monthly_revenue || 0;
    },
    growthRate() {
      return this.stats?.growth_rate || 0;
    },
  },
  methods: {
    // 用户相关方法 - 分散在methods中
    async fetchUser() {
      this.userLoading = true;
      try {
        this.user = await userAPI.getCurrentUser();
        this.userError = null;
      } catch (error) {
        this.userError = error.message;
      } finally {
        this.userLoading = false;
      }
    },

    // 订单相关方法 - 分散在methods中
    async fetchOrders() {
      this.ordersLoading = true;
      try {
        this.orders = await orderAPI.getUserOrders();
        this.ordersError = null;
      } catch (error) {
        this.ordersError = error.message;
      } finally {
        this.ordersLoading = false;
      }
    },

    setOrderFilter(filter) {
      this.orderFilter = filter;
    },

    // 统计相关方法 - 分散在methods中
    async fetchStats() {
      this.statsLoading = true;
      try {
        this.stats = await statsAPI.getUserStats();
        this.statsError = null;
      } catch (error) {
        this.statsError = error.message;
      } finally {
        this.statsLoading = false;
      }
    },

    // UI方法 - 分散在methods中
    setActiveTab(tab) {
      this.activeTab = tab;
    },
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },
  },

  async mounted() {
    await Promise.all([
      this.fetchUser(),
      this.fetchOrders(),
      this.fetchStats(),
    ]);
  },

  watch: {
    user: {
      handler(newUser) {
        if (newUser) {
          this.fetchOrders();
          this.fetchStats();
        }
      },
      deep: true,
    },
  },
};

/*
Options API的问题总结：
1. 逻辑分散：相关的状态、计算属性、方法被分散在不同选项中
2. 复用困难：逻辑与组件强耦合，难以提取和复用
3. 类型推导：TypeScript支持不够友好，this的类型推导复杂
4. 代码组织：随着功能增加，组件变得越来越难以维护
5. 测试困难：业务逻辑与组件实例绑定，单元测试不够纯粹
*/
```

**Composition API 的解决方案**

```javascript
// 使用Composition API重构 - 逻辑按功能分组
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useUser } from "@/composables/useUser";
import { useOrders } from "@/composables/useOrders";
import { useStats } from "@/composables/useStats";
import { useUI } from "@/composables/useUI";

export default {
  name: "UserDashboard",
  setup() {
    // 1. 用户逻辑模块 - 所有用户相关逻辑集中
    const { user, userLoading, userError, fetchUser, updateUser } = useUser();

    // 2. 订单逻辑模块 - 所有订单相关逻辑集中
    const {
      orders,
      ordersLoading,
      ordersError,
      orderFilter,
      filteredOrders,
      totalOrderValue,
      fetchOrders,
      setOrderFilter,
    } = useOrders();

    // 3. 统计逻辑模块 - 所有统计相关逻辑集中
    const {
      stats,
      statsLoading,
      statsError,
      monthlyRevenue,
      growthRate,
      fetchStats,
    } = useStats();

    // 4. UI状态逻辑模块 - 所有UI相关逻辑集中
    const { activeTab, sidebarCollapsed, setActiveTab, toggleSidebar } =
      useUI();

    // 5. 组合逻辑：用户变化时重新获取相关数据
    watch(
      user,
      (newUser) => {
        if (newUser) {
          fetchOrders();
          fetchStats();
        }
      },
      { deep: true }
    );

    // 6. 初始化逻辑
    onMounted(async () => {
      await Promise.all([fetchUser(), fetchOrders(), fetchStats()]);
    });

    // 7. 暴露给模板的API - 清晰明确
    return {
      // 用户相关
      user,
      userLoading,
      userError,
      updateUser,

      // 订单相关
      orders,
      ordersLoading,
      ordersError,
      orderFilter,
      filteredOrders,
      totalOrderValue,
      setOrderFilter,

      // 统计相关
      stats,
      statsLoading,
      statsError,
      monthlyRevenue,
      growthRate,

      // UI相关
      activeTab,
      sidebarCollapsed,
      setActiveTab,
      toggleSidebar,
    };
  },
};

/*
Composition API的优势：
1. 逻辑集中：相关逻辑被组织在独立的composable函数中
2. 易于复用：每个composable都可以在其他组件中重用
3. 类型友好：TypeScript类型推导更准确
4. 测试友好：每个composable都可以独立测试
5. 代码清晰：主组件只负责组合逻辑，职责清晰
*/
```

### 11.1.2 组合式 API 的核心设计理念

**1. 逻辑关注点分离（Separation of Concerns）**

```javascript
// composables/useUser.js - 用户相关逻辑的完整封装
import { ref, computed, readonly } from "vue";
import { userAPI } from "@/api/user";

export function useUser() {
  // 私有状态
  const user = ref(null);
  const loading = ref(false);
  const error = ref(null);

  // 公共计算属性
  const userName = computed(() => user.value?.name || "Unknown User");
  const userAvatar = computed(
    () => user.value?.avatar || "/default-avatar.png"
  );
  const isLoggedIn = computed(() => !!user.value);
  const userRole = computed(() => user.value?.role || "guest");

  // 公共方法
  const fetchUser = async () => {
    loading.value = true;
    error.value = null;
    try {
      const userData = await userAPI.getCurrentUser();
      user.value = userData;
      return userData;
    } catch (err) {
      error.value = err.message;
      console.error("获取用户信息失败:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateUser = async (userData) => {
    loading.value = true;
    error.value = null;
    try {
      const updatedUser = await userAPI.updateUser(userData);
      user.value = updatedUser;
      return updatedUser;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const logout = () => {
    user.value = null;
    error.value = null;
    // 清理相关状态
    localStorage.removeItem("token");
    sessionStorage.clear();
  };

  // 重置错误状态
  const clearError = () => {
    error.value = null;
  };

  // 返回公共API - 使用readonly保护内部状态
  return {
    // 只读状态
    user: readonly(user),
    loading,
    error,

    // 计算属性
    userName,
    userAvatar,
    isLoggedIn,
    userRole,

    // 方法
    fetchUser,
    updateUser,
    logout,
    clearError,
  };
}
```

**2. 可组合性（Composability）**

```javascript
// composables/useOrders.js - 订单逻辑，依赖用户信息
import { ref, computed, watch } from "vue";
import { orderAPI } from "@/api/order";

export function useOrders(userId) {
  const orders = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const filter = ref("all");

  // 计算属性
  const filteredOrders = computed(() => {
    if (!orders.value) return [];
    return filter.value === "all"
      ? orders.value
      : orders.value.filter((order) => order.status === filter.value);
  });

  const totalValue = computed(() => {
    return filteredOrders.value.reduce((sum, order) => sum + order.amount, 0);
  });

  const ordersByStatus = computed(() => {
    const groups = { pending: [], completed: [], cancelled: [] };
    orders.value.forEach((order) => {
      if (groups[order.status]) {
        groups[order.status].push(order);
      }
    });
    return groups;
  });

  const orderStats = computed(() => ({
    total: orders.value.length,
    pending: ordersByStatus.value.pending.length,
    completed: ordersByStatus.value.completed.length,
    cancelled: ordersByStatus.value.cancelled.length,
    totalValue: totalValue.value,
  }));

  // 方法
  const fetchOrders = async () => {
    if (!userId?.value) return;

    loading.value = true;
    error.value = null;
    try {
      const orderData = await orderAPI.getUserOrders(userId.value);
      orders.value = orderData;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  const setFilter = (newFilter) => {
    filter.value = newFilter;
  };

  const cancelOrder = async (orderId) => {
    try {
      await orderAPI.cancelOrder(orderId);
      const orderIndex = orders.value.findIndex((o) => o.id === orderId);
      if (orderIndex > -1) {
        orders.value[orderIndex].status = "cancelled";
      }
    } catch (err) {
      error.value = err.message;
      throw err;
    }
  };

  // 响应userId变化，自动重新获取订单
  if (userId) {
    watch(
      userId,
      (newUserId) => {
        if (newUserId) {
          fetchOrders();
        } else {
          orders.value = [];
        }
      },
      { immediate: true }
    );
  }

  return {
    orders,
    loading,
    error,
    filter,
    filteredOrders,
    totalValue,
    ordersByStatus,
    orderStats,
    fetchOrders,
    setFilter,
    cancelOrder,
  };
}
```

**3. 高阶组合模式**

```javascript
// composables/useDashboard.js - 高阶组合，聚合多个composable
import { computed } from "vue";
import { useUser } from "./useUser";
import { useOrders } from "./useOrders";
import { useStats } from "./useStats";

export function useDashboard() {
  // 基础composables
  const userComposable = useUser();
  const ordersComposable = useOrders(
    computed(() => userComposable.user.value?.id)
  );
  const statsComposable = useStats(
    computed(() => userComposable.user.value?.id)
  );

  // 聚合状态
  const isLoading = computed(() => {
    return (
      userComposable.loading.value ||
      ordersComposable.loading.value ||
      statsComposable.loading.value
    );
  });

  const hasError = computed(() => {
    return !!(
      userComposable.error.value ||
      ordersComposable.error.value ||
      statsComposable.error.value
    );
  });

  const allErrors = computed(() => {
    return [
      userComposable.error.value,
      ordersComposable.error.value,
      statsComposable.error.value,
    ].filter(Boolean);
  });

  // 聚合数据
  const dashboardData = computed(() => ({
    user: userComposable.user.value,
    orders: ordersComposable.orders.value,
    orderStats: ordersComposable.orderStats.value,
    stats: statsComposable.stats.value,
  }));

  // 聚合方法
  const initializeDashboard = async () => {
    try {
      await userComposable.fetchUser();
      // 用户数据获取成功后，订单和统计会通过watch自动获取
    } catch (error) {
      console.error("仪表盘初始化失败:", error);
    }
  };

  const refreshAllData = async () => {
    await Promise.all([
      userComposable.fetchUser(),
      ordersComposable.fetchOrders(),
      statsComposable.fetchStats(),
    ]);
  };

  const clearAllErrors = () => {
    userComposable.clearError();
    ordersComposable.error.value = null;
    statsComposable.error.value = null;
  };

  return {
    // 聚合状态
    isLoading,
    hasError,
    allErrors,
    dashboardData,

    // 分模块访问
    user: userComposable,
    orders: ordersComposable,
    stats: statsComposable,

    // 聚合方法
    initializeDashboard,
    refreshAllData,
    clearAllErrors,
  };
}
```

## 11.2 setup 函数深度解析

### 11.2.1 setup 函数的执行时机和上下文

```typescript
// setup函数在组件生命周期中的精确位置
interface ComponentLifecycleFlow {
  "1. 组件实例创建": "createComponentInstance()";
  "2. Props解析和验证": "initProps()";
  "3. setup函数执行": "setup(props, context)"; // <- 关键执行点
  "4. 数据选项初始化": "initData()";
  "5. 计算属性初始化": "initComputed()";
  "6. 侦听器初始化": "initWatch()";
  "7. 生命周期钩子": "created()";
  "8. 模板编译": "compile()";
  "9. 挂载阶段": "mount()";
}

// setup函数的详细执行机制
function setupComponent(instance: ComponentInternalInstance) {
  const { setup } = instance.type as ComponentOptions;

  if (setup) {
    // 1. 设置当前组件实例上下文 - 关键步骤
    setCurrentInstance(instance);

    // 2. 创建setup专用的上下文对象
    const setupContext = createSetupContext(instance);

    // 3. 执行setup函数 - 传入响应式props和context
    const setupResult = callWithErrorHandling(
      setup,
      instance,
      ErrorCodes.SETUP_FUNCTION,
      [
        shallowReadonly(instance.props), // 第一个参数：只读的props代理
        setupContext, // 第二个参数：context对象
      ]
    );

    // 4. 清理当前实例上下文
    unsetCurrentInstance();

    // 5. 处理setup返回值
    handleSetupResult(instance, setupResult);
  }
}

// setup上下文对象的创建和管理
function createSetupContext(instance: ComponentInternalInstance): SetupContext {
  return {
    // attrs: 非prop的attribute，响应式代理
    get attrs() {
      return getAttrsProxy(instance);
    },

    // slots: 插槽对象，包含所有插槽内容
    get slots() {
      return getSlotsProxy(instance);
    },

    // emit: 事件发射函数，类型安全
    emit: instance.emit,

    // expose: 暴露组件内部API给父组件
    expose(exposed?: Record<string, any>) {
      if (__DEV__ && instance.exposed) {
        warn("expose() should be called only once per setup().");
      }
      instance.exposed = exposed || {};
    },
  };
}
```

**setup 函数参数的深入使用**

```javascript
export default {
  name: "AdvancedComponent",
  props: {
    title: {
      type: String,
      required: true,
    },
    count: {
      type: Number,
      default: 0,
      validator: (value) => value >= 0,
    },
    config: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: {
    // 声明事件及其验证
    "update:count": (value) => typeof value === "number",
    change: (event) => event && typeof event === "object",
    delete: null, // 无参数事件
  },
  setup(props, context) {
    // === 第一个参数：props 的高级用法 ===

    // ❌ 错误：直接解构会失去响应性
    // const { title, count } = props

    // ✅ 正确：使用toRefs保持响应性
    const { title, count, config } = toRefs(props);

    // ✅ 也可以选择性地转换某些属性
    const reactiveCount = toRef(props, "count");

    // 监听props变化
    watch(count, (newCount, oldCount) => {
      console.log(`Count changed from ${oldCount} to ${newCount}`);
    });

    // 在计算属性中使用props
    const displayTitle = computed(() => {
      return `${title.value} (${count.value})`;
    });

    // === 第二个参数：context 的详细用法 ===
    const { attrs, slots, emit, expose } = context;

    // 1. attrs - 非prop属性的使用
    const handleNativeClick = (event) => {
      // 获取所有非prop属性
      console.log("Non-prop attributes:", attrs);

      // 常用的非prop属性
      const { class: className, style, id } = attrs;
      console.log("CSS类:", className);
      console.log("样式:", style);
      console.log("ID:", id);
    };

    // 2. slots - 插槽内容的处理
    const renderSlotContent = () => {
      // 检查插槽是否存在
      const hasDefaultSlot = !!slots.default;
      const hasHeaderSlot = !!slots.header;
      const hasFooterSlot = !!slots.footer;

      // 动态渲染插槽
      return {
        defaultContent: hasDefaultSlot ? slots.default() : null,
        headerContent: hasHeaderSlot
          ? slots.header({ title: title.value })
          : null,
        footerContent: hasFooterSlot
          ? slots.footer({ count: count.value })
          : null,
      };
    };

    // 3. emit - 事件发射的类型安全使用
    const handleIncrement = () => {
      const newCount = count.value + 1;
      emit("update:count", newCount);
      emit("change", {
        type: "increment",
        oldValue: count.value,
        newValue: newCount,
      });
    };

    const handleDecrement = () => {
      if (count.value > 0) {
        const newCount = count.value - 1;
        emit("update:count", newCount);
        emit("change", {
          type: "decrement",
          oldValue: count.value,
          newValue: newCount,
        });
      }
    };

    const handleDelete = () => {
      emit("delete");
    };

    // 4. expose - 暴露组件API
    const internalValue = ref("");
    const inputRef = ref();

    // 暴露给父组件的方法
    expose({
      // 公共方法
      focus() {
        inputRef.value?.focus();
      },

      blur() {
        inputRef.value?.blur();
      },

      getValue() {
        return internalValue.value;
      },

      setValue(value) {
        internalValue.value = value;
      },

      reset() {
        internalValue.value = "";
        emit("update:count", 0);
      },

      // 公共属性（只读）
      get isValid() {
        return internalValue.value.length > 0;
      },

      get currentCount() {
        return count.value;
      },
    });

    // === 返回给模板的数据和方法 ===
    return {
      // 响应式数据
      internalValue,
      displayTitle,

      // 方法
      handleIncrement,
      handleDecrement,
      handleDelete,
      handleNativeClick,
      renderSlotContent,

      // 引用
      inputRef,
    };
  },
};
```

### 11.2.2 setup 返回值处理机制

```typescript
// setup返回值的不同类型和处理方式
function handleSetupResult(
  instance: ComponentInternalInstance,
  setupResult: unknown
) {
  if (isFunction(setupResult)) {
    // 情况1: 返回渲染函数
    instance.render = setupResult as InternalRenderFunction;
  } else if (isObject(setupResult)) {
    // 情况2: 返回状态对象
    if (__DEV__ && isVNode(setupResult)) {
      warn("setup() should not return VNodes directly.");
    }

    // 将setup返回的对象转换为响应式代理
    instance.setupState = proxyRefs(setupResult);
  } else if (__DEV__ && setupResult !== undefined) {
    // 情况3: 无效返回值警告
    warn(
      `setup() should return an object or a render function. ` +
        `Received: ${typeof setupResult}`
    );
  }
}

// proxyRefs的实现 - 自动解包ref
function proxyRefs<T extends object>(objectWithRefs: T): ShallowUnwrapRef<T> {
  return isReactive(objectWithRefs)
    ? objectWithRefs
    : new Proxy(objectWithRefs, shallowUnwrapHandlers);
}

const shallowUnwrapHandlers: ProxyHandler<any> = {
  get(target, key, receiver) {
    const res = Reflect.get(target, key, receiver);
    // 自动解包ref值
    return unref(res);
  },
  set(target, key, value, receiver) {
    const oldValue = target[key];
    if (isRef(oldValue) && !isRef(value)) {
      // 如果原值是ref，新值不是ref，则设置ref的value
      oldValue.value = value;
      return true;
    } else {
      // 否则直接设置
      return Reflect.set(target, key, value, receiver);
    }
  },
};
```

**setup 返回值的最佳实践**

```javascript
export default {
  setup() {
    // === 方式1: 返回状态对象（推荐） ===
    const count = ref(0)
    const message = ref('Hello')
    const user = reactive({ name: 'John', age: 30 })

    const increment = () => count.value++
    const updateUser = (newData) => Object.assign(user, newData)

    // 返回给模板使用的数据和方法
    return {
      count,        // 在模板中自动解包：{{ count }}
      message,      // 在模板中自动解包：{{ message }}
      user,         // 响应式对象：{{ user.name }}
      increment,    // 方法：@click="increment"
      updateUser    // 方法：@click="updateUser({name: 'Jane'})"
    }
  }
}

// === 方式2: 返回渲染函数（高级用法） ===
export default {
  setup(props, { slots }) {
    const count = ref(0)

    // 返回渲染函数，完全控制渲染逻辑
    return () => h('div', [
      h('p', `Count: ${count.value}`),
      h('button', {
        onClick: () => count.value++
      }, 'Increment'),
      slots.default?.()
    ])
  }
}

// === 方式3: 混合使用（JSX + 状态） ===
export default {
  setup() {
    const visible = ref(true)
    const toggle = () => visible.value = !visible.value

    // 可以同时返回状态和渲染函数
    return {
      visible,
      toggle,
      // 自定义渲染逻辑
      renderContent: () => visible.value ? h('div', 'Content') : null
    }
  }
}
```

## 11.3 响应式 API 深入剖析

### 11.3.1 ref 系统完整实现原理

```typescript
// ref的核心实现
class RefImpl<T> {
  private _value: T;
  private _rawValue: T;
  public dep?: Dep = undefined;
  public readonly __v_isRef = true;

  constructor(value: T, public readonly __v_isShallow: boolean) {
    // 存储原始值（用于对比）
    this._rawValue = __v_isShallow ? value : toRaw(value);
    // 存储响应式值
    this._value = __v_isShallow ? value : toReactive(value);
  }

  get value() {
    // 依赖收集
    trackRefValue(this);
    return this._value;
  }

  set value(newVal) {
    const useDirectValue =
      this.__v_isShallow || isShallow(newVal) || isReadonly(newVal);
    newVal = useDirectValue ? newVal : toRaw(newVal);

    // 值变化检测
    if (hasChanged(newVal, this._rawValue)) {
      this._rawValue = newVal;
      this._value = useDirectValue ? newVal : toReactive(newVal);
      // 触发更新
      triggerRefValue(this, newVal);
    }
  }
}

// ref依赖收集
function trackRefValue(ref: RefBase<any>) {
  if (shouldTrack && activeEffect) {
    ref = toRaw(ref);
    if (__DEV__) {
      trackEffects(ref.dep || (ref.dep = createDep()), {
        target: ref,
        type: TrackOpTypes.GET,
        key: "value",
      });
    } else {
      trackEffects(ref.dep || (ref.dep = createDep()));
    }
  }
}

// ref触发更新
function triggerRefValue(ref: RefBase<any>, newVal?: any) {
  ref = toRaw(ref);
  if (ref.dep) {
    if (__DEV__) {
      triggerEffects(ref.dep, {
        target: ref,
        type: TriggerOpTypes.SET,
        key: "value",
        newValue: newVal,
      });
    } else {
      triggerEffects(ref.dep);
    }
  }
}
```

**ref 的高级用法和最佳实践**

```javascript
import {
  ref,
  shallowRef,
  triggerRef,
  customRef,
  unref,
  toRef,
  toRefs,
} from "vue";

// === 1. 基础ref用法 ===
const count = ref(0);
const message = ref("Hello");
const user = ref({ name: "John", age: 30 });

// 访问和修改
console.log(count.value); // 0
count.value++; // 触发响应式更新
user.value.name = "Jane"; // 深度响应式

// === 2. shallowRef - 浅层响应式 ===
const shallowUser = shallowRef({ name: "John", age: 30 });
shallowUser.value.name = "Jane"; // 不会触发更新
shallowUser.value = { name: "Jane", age: 25 }; // 会触发更新

// 手动触发shallowRef更新
triggerRef(shallowUser);

// === 3. customRef - 自定义ref ===
function useDebouncedRef(value, delay = 200) {
  let timeout;
  return customRef((track, trigger) => {
    return {
      get() {
        track(); // 收集依赖
        return value;
      },
      set(newValue) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          value = newValue;
          trigger(); // 触发更新
        }, delay);
      },
    };
  });
}

// 使用防抖ref
const debouncedText = useDebouncedRef("", 300);

// === 4. 高级自定义ref示例 ===
function useLocalStorageRef(key, defaultValue) {
  return customRef((track, trigger) => {
    return {
      get() {
        track();
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
      },
      set(newValue) {
        if (newValue == null) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, JSON.stringify(newValue));
        }
        trigger();
      },
    };
  });
}

// 使用localStorage同步的ref
const settings = useLocalStorageRef("app-settings", { theme: "light" });

// === 5. ref工具函数 ===
// unref - 获取ref的值或返回原值
function getValue(maybeRef) {
  return unref(maybeRef); // 等价于 isRef(maybeRef) ? maybeRef.value : maybeRef
}

// toRef - 将响应式对象的属性转为ref
const state = reactive({ count: 0, name: "John" });
const countRef = toRef(state, "count"); // 保持与state.count的响应式连接

// toRefs - 将响应式对象的所有属性转为ref
const { count: countRef2, name: nameRef } = toRefs(state);

// === 6. ref的类型推导和约束 ===
// TypeScript中的ref类型
const typedRef = (ref < string) | (null > null);
const numberRef = ref(0); // 自动推导为Ref<number>

// 只读ref
const readonlyRef = readonly(ref(42));
// readonlyRef.value = 43  // TypeScript错误
```

### 11.3.2 reactive 系统深度剖析

```typescript
// reactive的核心实现
function reactive<T extends object>(target: T): UnwrapNestedRefs<T> {
  // 如果已经是只读的，直接返回
  if (isReadonly(target)) {
    return target;
  }

  // 创建响应式代理
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers,
    reactiveMap
  );
}

function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>
) {
  // 只能代理对象类型
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`);
    }
    return target;
  }

  // 已经是代理对象，直接返回
  if (
    target[ReactiveFlags.RAW] &&
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target;
  }

  // 检查是否已经有对应的代理
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }

  // 检查目标对象是否可以被代理
  const targetType = getTargetType(target);
  if (targetType === TargetType.INVALID) {
    return target;
  }

  // 创建代理对象
  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers
  );

  // 缓存代理对象
  proxyMap.set(target, proxy);
  return proxy;
}

// 基础对象的代理处理器
const mutableHandlers: ProxyHandler<object> = {
  get(target, key, receiver) {
    // 处理特殊标识符
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly;
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly;
    } else if (key === ReactiveFlags.RAW) {
      return target;
    }

    const targetIsArray = isArray(target);

    // 数组的特殊方法处理
    if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver);
    }

    const res = Reflect.get(target, key, receiver);

    // 内置Symbol和非字符串key不进行依赖收集
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res;
    }

    // 依赖收集
    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key);
    }

    // 如果是浅层响应式，直接返回
    if (shallow) {
      return res;
    }

    // 如果是ref，自动解包
    if (isRef(res)) {
      return targetIsArray && isIntegerKey(key) ? res : res.value;
    }

    // 如果是对象，递归创建响应式
    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res);
    }

    return res;
  },

  set(target, key, value, receiver) {
    let oldValue = (target as any)[key];

    // 处理只读情况
    if (isReadonly(oldValue) && isRef(oldValue) && !isRef(value)) {
      return false;
    }

    // 处理浅层响应式
    if (!shallow) {
      if (!isShallow(value) && !isReadonly(value)) {
        oldValue = toRaw(oldValue);
        value = toRaw(value);
      }

      // 如果旧值是ref，新值不是ref，设置ref的value
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        oldValue.value = value;
        return true;
      }
    }

    // 检查key是否存在
    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key);

    // 设置值
    const result = Reflect.set(target, key, value, receiver);

    // 如果target是原始对象（不是原型链上的）
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        // 新增属性
        trigger(target, TriggerOpTypes.ADD, key, value);
      } else if (hasChanged(value, oldValue)) {
        // 修改属性
        trigger(target, TriggerOpTypes.SET, key, value, oldValue);
      }
    }

    return result;
  },

  deleteProperty(target, key) {
    const hadKey = hasOwn(target, key);
    const oldValue = (target as any)[key];
    const result = Reflect.deleteProperty(target, key);

    if (result && hadKey) {
      trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue);
    }

    return result;
  },

  has(target, key) {
    const result = Reflect.has(target, key);
    if (!isSymbol(key) || !builtInSymbols.has(key)) {
      track(target, TrackOpTypes.HAS, key);
    }
    return result;
  },

  ownKeys(target) {
    track(
      target,
      TrackOpTypes.ITERATE,
      isArray(target) ? "length" : ITERATE_KEY
    );
    return Reflect.ownKeys(target);
  },
};
```

**reactive 的高级用法和最佳实践**

```javascript
import {
  reactive,
  shallowReactive,
  readonly,
  shallowReadonly,
  markRaw,
  toRaw,
} from "vue";

// === 1. 基础reactive用法 ===
const state = reactive({
  count: 0,
  user: {
    name: "John",
    profile: {
      age: 30,
      email: "john@example.com",
    },
  },
  items: [1, 2, 3],
});

// 深度响应式 - 所有嵌套属性都是响应式的
state.user.name = "Jane"; // 触发更新
state.user.profile.age = 31; // 触发更新
state.items.push(4); // 触发更新

// === 2. shallowReactive - 浅层响应式 ===
const shallowState = shallowReactive({
  count: 0,
  user: {
    name: "John",
    age: 30,
  },
});

shallowState.count++; // 触发更新
shallowState.user.name = "Jane"; // 不触发更新
shallowState.user = { name: "Jane", age: 31 }; // 触发更新

// === 3. readonly - 只读代理 ===
const readonlyState = readonly({
  count: 0,
  user: { name: "John" },
});

// readonlyState.count++           // 开发环境警告，生产环境静默失败
// readonlyState.user.name = 'Jane' // 开发环境警告，生产环境静默失败

// === 4. shallowReadonly - 浅层只读 ===
const shallowReadonlyState = shallowReadonly({
  count: 0,
  user: { name: "John" },
});

// shallowReadonlyState.count++    // 只读，无法修改
shallowReadonlyState.user.name = "Jane"; // 可以修改，因为是浅层只读

// === 5. markRaw - 标记对象不可被代理 ===
const rawObject = markRaw({
  name: "Raw Object",
  data: new Map(),
});

const state2 = reactive({
  raw: rawObject,
  normal: { count: 0 },
});

// rawObject不会被转换为响应式
console.log(isReactive(state2.raw)); // false
console.log(isReactive(state2.normal)); // true

// === 6. toRaw - 获取原始对象 ===
const original = { count: 0 };
const reactiveObj = reactive(original);

console.log(toRaw(reactiveObj) === original); // true

// === 7. 响应式判断工具 ===
import { isReactive, isReadonly, isProxy } from "vue";

const obj = reactive({ count: 0 });
const readonlyObj = readonly({ count: 0 });

console.log(isReactive(obj)); // true
console.log(isReadonly(readonlyObj)); // true
console.log(isProxy(obj)); // true
console.log(isProxy(readonlyObj)); // true
```

### 11.3.3 computed 计算属性实现原理

```typescript
// computed的核心实现
class ComputedRefImpl<T> {
  public dep?: Dep = undefined;
  private _value!: T;
  public readonly effect: ReactiveEffect<T>;
  public readonly __v_isRef = true;
  public readonly [ReactiveFlags.IS_READONLY]: boolean = false;

  constructor(
    getter: ComputedGetter<T>,
    private readonly _setter: ComputedSetter<T>,
    isReadonly: boolean,
    isSSR: boolean
  ) {
    // 创建计算属性的effect
    this.effect = new ReactiveEffect(getter, () => {
      // 计算属性的调度器：标记为脏值并触发依赖更新
      if (!this._dirty) {
        this._dirty = true;
        triggerRefValue(this);
      }
    });

    this.effect.computed = this;
    this.effect.active = this._cacheable = !isSSR;
    this[ReactiveFlags.IS_READONLY] = isReadonly;
  }

  get value() {
    // 获取原始对象（处理代理情况）
    const self = toRaw(this);

    // 依赖收集
    trackRefValue(self);

    // 如果是脏值或者不可缓存，重新计算
    if (self._dirty || !self._cacheable) {
      self._dirty = false;
      self._value = self.effect.run()!;
    }

    return self._value;
  }

  set value(newValue: T) {
    this._setter(newValue);
  }
}

// computed函数的实现
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions,
  isSSR = false
): WritableComputedRef<T> | ComputedRef<T> {
  let getter: ComputedGetter<T>;
  let setter: ComputedSetter<T>;

  const onlyGetter = isFunction(getterOrOptions);
  if (onlyGetter) {
    getter = getterOrOptions;
    setter = __DEV__
      ? () => {
          console.warn("Write operation failed: computed value is readonly");
        }
      : NOOP;
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }

  const cRef = new ComputedRefImpl(
    getter,
    setter,
    onlyGetter || !getterOrOptions.set,
    isSSR
  );

  if (__DEV__ && debugOptions && !isSSR) {
    cRef.effect.onTrack = debugOptions.onTrack;
    cRef.effect.onTrigger = debugOptions.onTrigger;
  }

  return cRef as any;
}
```

**computed 的高级用法和最佳实践**

```javascript
import { computed, ref, reactive, watch } from "vue";

// === 1. 只读计算属性 ===
const count = ref(0);
const doubleCount = computed(() => count.value * 2);

console.log(doubleCount.value); // 0
count.value = 5;
console.log(doubleCount.value); // 10

// === 2. 可写计算属性 ===
const firstName = ref("John");
const lastName = ref("Doe");

const fullName = computed({
  get() {
    return `${firstName.value} ${lastName.value}`;
  },
  set(newValue) {
    const [first, last] = newValue.split(" ");
    firstName.value = first;
    lastName.value = last;
  },
});

console.log(fullName.value); // "John Doe"
fullName.value = "Jane Smith"; // 触发setter
console.log(firstName.value); // "Jane"
console.log(lastName.value); // "Smith"

// === 3. 复杂计算属性示例 ===
const state = reactive({
  items: [
    { id: 1, name: "Apple", price: 1.2, category: "fruit", inStock: true },
    { id: 2, name: "Banana", price: 0.8, category: "fruit", inStock: false },
    { id: 3, name: "Carrot", price: 0.5, category: "vegetable", inStock: true },
  ],
  filter: "all",
  sortBy: "name",
});

// 过滤后的商品
const filteredItems = computed(() => {
  let items = state.items;

  if (state.filter === "inStock") {
    items = items.filter((item) => item.inStock);
  } else if (state.filter === "outOfStock") {
    items = items.filter((item) => !item.inStock);
  }

  return items;
});

// 排序后的商品
const sortedItems = computed(() => {
  return [...filteredItems.value].sort((a, b) => {
    const aValue = a[state.sortBy];
    const bValue = b[state.sortBy];

    if (typeof aValue === "string") {
      return aValue.localeCompare(bValue);
    }
    return aValue - bValue;
  });
});

// 统计信息
const statistics = computed(() => ({
  total: state.items.length,
  inStock: state.items.filter((item) => item.inStock).length,
  outOfStock: state.items.filter((item) => !item.inStock).length,
  totalValue: state.items.reduce((sum, item) => sum + item.price, 0),
  averagePrice:
    state.items.length > 0
      ? state.items.reduce((sum, item) => sum + item.price, 0) /
        state.items.length
      : 0,
  categories: [...new Set(state.items.map((item) => item.category))],
}));

// === 4. 计算属性的缓存机制演示 ===
let computeCount = 0;
const expensiveComputed = computed(() => {
  computeCount++;
  console.log(`计算执行次数: ${computeCount}`);

  // 模拟昂贵的计算
  let result = 0;
  for (let i = 0; i < 1000000; i++) {
    result += Math.random();
  }

  return count.value + result;
});

// 多次访问，只计算一次
console.log(expensiveComputed.value); // 计算执行次数: 1
console.log(expensiveComputed.value); // 不会重新计算
console.log(expensiveComputed.value); // 不会重新计算

// 依赖变化时才重新计算
count.value++; // 计算执行次数: 2

// === 5. 计算属性的调试 ===
const debuggedComputed = computed(
  () => {
    return count.value * 2;
  },
  {
    onTrack(e) {
      console.log("依赖收集:", e);
    },
    onTrigger(e) {
      console.log("触发更新:", e);
    },
  }
);
```

### 11.3.4 watch 和 watchEffect 详解

**watch 和 watchEffect 的高级用法**

```javascript
import { ref, reactive, watch, watchEffect, nextTick } from "vue";

// === 1. 基础watch用法 ===
const count = ref(0);
const name = ref("John");

// 监听单个ref
const stopWatcher1 = watch(count, (newValue, oldValue) => {
  console.log(`count changed from ${oldValue} to ${newValue}`);
});

// 监听多个数据源
const stopWatcher2 = watch(
  [count, name],
  ([newCount, newName], [oldCount, oldName]) => {
    console.log(`count: ${oldCount} -> ${newCount}`);
    console.log(`name: ${oldName} -> ${newName}`);
  }
);

// 监听响应式对象
const state = reactive({ user: { name: "John", age: 30 } });
const stopWatcher3 = watch(
  () => state.user,
  (newUser, oldUser) => {
    console.log("user changed:", newUser);
  },
  { deep: true } // 深度监听
);

// === 2. watch选项详解 ===
const stopWatcher4 = watch(
  count,
  (newValue, oldValue, onCleanup) => {
    console.log(`count: ${oldValue} -> ${newValue}`);

    // 清理副作用
    const timer = setTimeout(() => {
      console.log("延迟执行的副作用");
    }, 1000);

    onCleanup(() => {
      clearTimeout(timer);
      console.log("清理定时器");
    });
  },
  {
    immediate: true, // 立即执行
    deep: false, // 是否深度监听
    flush: "pre", // 执行时机：'pre' | 'post' | 'sync'
    onTrack(e) {
      // 调试：依赖收集时触发
      console.log("依赖收集:", e);
    },
    onTrigger(e) {
      // 调试：依赖触发时触发
      console.log("依赖触发:", e);
    },
  }
);

// === 3. watchEffect用法 ===
const stopWatchEffect1 = watchEffect(() => {
  // 自动收集依赖
  console.log(`count is ${count.value}, name is ${name.value}`);
});

// watchEffect with cleanup
const stopWatchEffect2 = watchEffect((onCleanup) => {
  const timer = setInterval(() => {
    console.log(`当前计数: ${count.value}`);
  }, 1000);

  onCleanup(() => {
    clearInterval(timer);
    console.log("清理定时器");
  });
});

// === 4. 高级监听模式 ===
// 监听计算属性
const doubleCount = computed(() => count.value * 2);
const stopWatcher5 = watch(doubleCount, (newValue) => {
  console.log(`doubleCount: ${newValue}`);
});

// 监听getter函数
const stopWatcher6 = watch(
  () => state.user.name,
  (newName) => {
    console.log(`用户名变更: ${newName}`);
  }
);

// 条件性监听
const enabled = ref(true);
const stopWatcher7 = watch(count, (newValue) => {
  if (enabled.value) {
    console.log(`条件监听: ${newValue}`);
  }
});

// === 5. 异步监听处理 ===
const asyncData = ref(null);
const loading = ref(false);

const stopWatcher8 = watch(count, async (newCount, oldCount, onCleanup) => {
  loading.value = true;

  // 取消标志
  let cancelled = false;
  onCleanup(() => {
    cancelled = true;
  });

  try {
    // 模拟异步请求
    const response = await fetch(`/api/data/${newCount}`);
    const data = await response.json();

    // 检查是否已被取消
    if (!cancelled) {
      asyncData.value = data;
    }
  } catch (error) {
    if (!cancelled) {
      console.error("请求失败:", error);
    }
  } finally {
    if (!cancelled) {
      loading.value = false;
    }
  }
});

// === 6. 监听器的生命周期管理 ===
// 在组件中使用
export default {
  setup() {
    const count = ref(0);

    // 组件卸载时自动停止
    watch(count, (newValue) => {
      console.log(`count: ${newValue}`);
    });

    // 手动控制停止
    const stopWatcher = watch(count, (newValue) => {
      console.log(`manual watch: ${newValue}`);
    });

    // 条件性停止
    const shouldWatch = ref(true);
    watch(shouldWatch, (newValue) => {
      if (!newValue) {
        stopWatcher();
      }
    });

    return { count, shouldWatch };
  },
};

// === 7. 监听器的性能优化 ===
// 使用shallowRef避免深度监听
const shallowData = shallowRef({ items: [] });
watch(shallowData, (newValue) => {
  // 只有shallowData.value整体替换时才触发
  console.log("shallow data changed");
});

// 使用computed缓存复杂计算
const expensiveValue = computed(() => {
  // 复杂计算逻辑
  return state.items.reduce((sum, item) => sum + item.value, 0);
});

watch(expensiveValue, (newValue) => {
  console.log(`expensive value: ${newValue}`);
});
```

## 11.4 生命周期 Hooks

### 11.4.1 生命周期 Hooks 的实现原理

```typescript
// 生命周期hooks的核心实现
export function onMounted(
  hook: () => any,
  target?: ComponentInternalInstance | null
) {
  injectHook(LifecycleHooks.MOUNTED, hook, target);
}

export function onUpdated(
  hook: () => any,
  target?: ComponentInternalInstance | null
) {
  injectHook(LifecycleHooks.UPDATED, hook, target);
}

export function onUnmounted(
  hook: () => any,
  target?: ComponentInternalInstance | null
) {
  injectHook(LifecycleHooks.UNMOUNTED, hook, target);
}

export function onBeforeMount(
  hook: () => any,
  target?: ComponentInternalInstance | null
) {
  injectHook(LifecycleHooks.BEFORE_MOUNT, hook, target);
}

export function onBeforeUpdate(
  hook: () => any,
  target?: ComponentInternalInstance | null
) {
  injectHook(LifecycleHooks.BEFORE_UPDATE, hook, target);
}

export function onBeforeUnmount(
  hook: () => any,
  target?: ComponentInternalInstance | null
) {
  injectHook(LifecycleHooks.BEFORE_UNMOUNT, hook, target);
}

// 注入生命周期钩子的核心函数
export function injectHook(
  type: LifecycleHooks,
  hook: Function & { __weh?: Function },
  target: ComponentInternalInstance | null = currentInstance,
  prepend: boolean = false
): Function | undefined {
  if (target) {
    // 获取或创建对应类型的hooks数组
    const hooks = target[type] || (target[type] = []);

    // 包装hook函数，绑定当前实例
    const wrappedHook =
      hook.__weh ||
      (hook.__weh = (...args: unknown[]) => {
        if (target.isUnmounted) {
          return;
        }
        // 设置当前实例上下文
        setCurrentInstance(target);
        // 执行hook
        const res = callWithAsyncErrorHandling(hook, target, type, args);
        // 清理当前实例上下文
        unsetCurrentInstance();
        return res;
      });

    if (prepend) {
      hooks.unshift(wrappedHook);
    } else {
      hooks.push(wrappedHook);
    }

    return wrappedHook;
  } else if (__DEV__) {
    const apiName = toHandlerKey(ErrorTypeStrings[type].replace(/ hook$/, ""));
    warn(
      `${apiName} is called when there is no active component instance to be ` +
        `associated with. ` +
        `Lifecycle injection APIs can only be used during execution of setup().`
    );
  }
}
```

**生命周期 Hooks 的高级用法**

```javascript
import {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  onErrorCaptured,
  onRenderTracked,
  onRenderTriggered,
  ref,
  reactive,
  nextTick,
} from "vue";

export default {
  setup() {
    const count = ref(0);
    const state = reactive({ message: "Hello" });

    // === 1. 挂载阶段 ===
    onBeforeMount(() => {
      console.log("组件即将挂载");
      // 此时组件实例已创建，但DOM还未挂载
      // 可以进行最后的状态初始化
    });

    onMounted(() => {
      console.log("组件已挂载");
      // DOM已挂载，可以访问DOM元素
      // 适合进行API调用、事件监听等

      // 访问DOM
      const el = document.querySelector("#my-element");
      if (el) {
        el.focus();
      }

      // 启动定时器
      const timer = setInterval(() => {
        count.value++;
      }, 1000);

      // 在卸载时清理
      onUnmounted(() => {
        clearInterval(timer);
      });
    });

    // === 2. 更新阶段 ===
    onBeforeUpdate(() => {
      console.log("组件即将更新");
      // 在组件更新之前调用
      // 可以在此阶段访问更新前的DOM状态
    });

    onUpdated(() => {
      console.log("组件已更新");
      // 组件更新完成后调用
      // DOM已更新，可以访问更新后的DOM

      nextTick(() => {
        // 确保所有DOM更新都已完成
        console.log("DOM更新完成");
      });
    });

    // === 3. 卸载阶段 ===
    onBeforeUnmount(() => {
      console.log("组件即将卸载");
      // 组件实例仍然完全可用
      // 适合进行清理工作的准备
    });

    onUnmounted(() => {
      console.log("组件已卸载");
      // 组件实例已被卸载
      // 进行最终的清理工作

      // 清理事件监听
      window.removeEventListener("resize", handleResize);

      // 清理定时器
      // 清理WebSocket连接
      // 清理其他资源
    });

    // === 4. 错误处理 ===
    onErrorCaptured((error, instance, info) => {
      console.error("捕获到错误:", error);
      console.log("错误实例:", instance);
      console.log("错误信息:", info);

      // 返回false阻止错误继续传播
      return false;
    });

    // === 5. 调试钩子 ===
    onRenderTracked((e) => {
      console.log("依赖被追踪:", e);
      // 在开发环境中调试响应式依赖
    });

    onRenderTriggered((e) => {
      console.log("重新渲染被触发:", e);
      // 在开发环境中调试渲染触发原因
    });

    // === 6. 多个同类型钩子 ===
    onMounted(() => {
      console.log("第一个mounted钩子");
    });

    onMounted(() => {
      console.log("第二个mounted钩子");
    });
    // 多个钩子会按注册顺序执行

    // === 7. 异步钩子处理 ===
    onMounted(async () => {
      try {
        const data = await fetchUserData();
        state.userData = data;
      } catch (error) {
        console.error("获取用户数据失败:", error);
      }
    });

    // === 8. 条件性钩子注册 ===
    const shouldTrackRender = ref(false);

    if (shouldTrackRender.value) {
      onRenderTracked((e) => {
        console.log("条件性渲染追踪:", e);
      });
    }

    return {
      count,
      state,
    };
  },
};

// === 9. 自定义钩子中使用生命周期 ===
function useTimer(interval = 1000) {
  const count = ref(0);
  let timer = null;

  onMounted(() => {
    timer = setInterval(() => {
      count.value++;
    }, interval);
  });

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer);
    }
  });

  return { count };
}

// === 10. 生命周期钩子的最佳实践 ===
function useResourceManager() {
  const resources = new Set();

  const addResource = (resource) => {
    resources.add(resource);
  };

  const removeResource = (resource) => {
    resources.delete(resource);
    if (typeof resource.cleanup === "function") {
      resource.cleanup();
    }
  };

  onUnmounted(() => {
    // 自动清理所有资源
    resources.forEach((resource) => {
      removeResource(resource);
    });
    resources.clear();
  });

  return {
    addResource,
    removeResource,
  };
}
```

## 11.5 依赖注入系统

### 11.5.1 provide/inject 的实现原理

```typescript
// provide的核心实现
export function provide<T>(key: InjectionKey<T> | string | number, value: T) {
  if (!currentInstance) {
    if (__DEV__) {
      warn(`provide() can only be used inside setup().`);
    }
  } else {
    let provides = currentInstance.provides;

    // 默认情况下，实例继承其父级的provides对象
    // 但当它需要提供自己的值时，它会创建自己的provides对象
    // 使用父级provides作为原型
    const parentProvides =
      currentInstance.parent && currentInstance.parent.provides;
    if (parentProvides === provides) {
      provides = currentInstance.provides = Object.create(parentProvides);
    }

    // TS不允许symbol作为索引类型
    provides[key as string] = value;
  }
}

// inject的核心实现
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue?: unknown,
  treatDefaultAsFactory = false
) {
  // 获取当前实例，如果在setup外调用则为null
  const instance = currentInstance || currentRenderingInstance;

  if (instance) {
    // #2400
    // 为了支持函数式组件，我们需要检查父级provides
    const provides =
      instance.parent == null
        ? instance.vnode.appContext && instance.vnode.appContext.provides
        : instance.parent.provides;

    if (provides && (key as string | symbol) in provides) {
      // TS不允许symbol作为索引类型
      return provides[key as string];
    } else if (arguments.length > 1) {
      return treatDefaultAsFactory && isFunction(defaultValue)
        ? (defaultValue as Function).call(instance.proxy)
        : defaultValue;
    } else if (__DEV__) {
      warn(`injection "${String(key)}" not found.`);
    }
  } else if (__DEV__) {
    warn(`inject() can only be used inside setup() or functional components.`);
  }
}
```

**provide/inject 的高级用法**

```javascript
import { provide, inject, ref, reactive, computed, readonly } from 'vue'

// === 1. 基础用法 ===
// 父组件
export default {
  setup() {
    const theme = ref('dark')
    const user = reactive({ name: 'John', role: 'admin' })

    // 提供数据
    provide('theme', theme)
    provide('user', readonly(user))  // 提供只读版本

    return { theme, user }
  }
}

// 子组件
export default {
  setup() {
    // 注入数据
    const theme = inject('theme')
    const user = inject('user')

    return { theme, user }
  }
}

// === 2. 使用Symbol作为key ===
// symbols.js
export const ThemeSymbol = Symbol('theme')
export const UserSymbol = Symbol('user')

// 父组件
import { ThemeSymbol, UserSymbol } from './symbols'

export default {
  setup() {
    const theme = ref('light')
    const user = reactive({ name: 'Jane' })

    provide(ThemeSymbol, theme)
    provide(UserSymbol, user)

    return { theme, user }
  }
}

// 子组件
import { ThemeSymbol, UserSymbol } from './symbols'

export default {
  setup() {
    const theme = inject(ThemeSymbol)
    const user = inject(UserSymbol)

    return { theme, user }
  }
}

// === 3. 默认值和工厂函数 ===
export default {
  setup() {
    // 提供默认值
    const theme = inject('theme', 'light')

    // 使用工厂函数作为默认值
    const config = inject('config', () => ({
      apiUrl: '/api',
      timeout: 5000
    }), true)  // 第三个参数表示默认值是工厂函数

    // 使用computed作为默认值
    const settings = inject('settings', () => computed(() => ({
      theme: theme.value,
      language: 'zh-CN'
    })), true)

    return { theme, config, settings }
  }
}

// === 4. 响应式注入 ===
// 祖先组件
export default {
  setup() {
    const count = ref(0)
    const doubleCount = computed(() => count.value * 2)

    provide('count', count)
    provide('doubleCount', readonly(doubleCount))

    const increment = () => count.value++
    provide('increment', increment)

    return { count, increment }
  }
}

// 后代组件
export default {
  setup() {
    const count = inject('count')
    const doubleCount = inject('doubleCount')
    const increment = inject('increment')

    // count和doubleCount都是响应式的
    watch(count, (newValue) => {
      console.log(`count changed to ${newValue}`)
    })

    return { count, doubleCount, increment }
  }
}

// === 5. 高级模式：状态管理 ===
// store.js
import { reactive, readonly, computed } from 'vue'

function createStore() {
  const state = reactive({
    user: null,
    posts: [],
    loading: false
  })

  const getters = {
    isLoggedIn: computed(() => !!state.user),
    postCount: computed(() => state.posts.length),
    userPosts: computed(() =>
      state.posts.filter(post => post.userId === state.user?.id)
    )
  }

  const actions = {
    async login(credentials) {
      state.loading = true
      try {
        const user = await api.login(credentials)
        state.user = user
      } finally {
        state.loading = false
      }
    },

    async fetchPosts() {
      state.loading = true
      try {
        const posts = await api.getPosts()
        state.posts = posts
      } finally {
        state.loading = false
      }
    },

    logout() {
      state.user = null
      state.posts = []
    }
  }

  return {
    state: readonly(state),
    getters,
    actions
  }
}

// 在根组件中提供store
export default {
  setup() {
    const store = createStore()
    provide('store', store)

    return {}
  }
}

// 在子组件中使用store
export default {
  setup() {
    const store = inject('store')

    const login = async (credentials) => {
      await store.actions.login(credentials)
    }

    return {
      user: store.state.user,
      isLoggedIn: store.getters.isLoggedIn,
      login
    }
  }
}

// === 6. 类型安全的注入 ===
// types.ts
import type { InjectionKey, Ref } from 'vue'

export interface User {
  id: number
  name: string
  email: string
}

export const UserKey: InjectionKey<Ref<User | null>> = Symbol('user')
export const ThemeKey: InjectionKey<Ref<string>> = Symbol('theme')

// 使用类型安全的注入
export default {
  setup() {
    const user = inject(UserKey)  // 类型为 Ref<User | null> | undefined
    const theme = inject(ThemeKey, ref('light'))  // 类型为 Ref<string>

    return { user, theme }
  }
}
```

## 11.6 本章总结

本章深入探讨了 Vue3 组合式 API 的核心原理和高级用法：

### 核心要点

1. **设计理念**：组合式 API 通过逻辑关注点分离、可组合性和高阶组合模式，解决了 Options API 在大型组件中的问题

2. **setup 函数**：作为组合式 API 的入口点，提供了 props、context 参数和灵活的返回值处理机制

3. **响应式 API**：

   - ref 系统提供了基础的响应式包装
   - reactive 系统实现了深度响应式代理
   - computed 提供了缓存的计算属性
   - watch/watchEffect 提供了灵活的数据监听

4. **生命周期 Hooks**：提供了与 Options API 对应的生命周期钩子，支持多次注册和异步处理

5. **依赖注入**：provide/inject 系统实现了跨组件层级的数据传递，支持响应式和类型安全

### 最佳实践

- 使用 composable 函数封装可复用逻辑
- 合理使用 ref 和 reactive，避免过度响应式
- 利用 computed 缓存昂贵的计算
- 正确处理 watch 的清理逻辑
- 使用 Symbol 作为 inject 的 key 以避免命名冲突
- 在 TypeScript 中使用 InjectionKey 确保类型安全

组合式 API 为 Vue3 带来了更强的逻辑复用能力和更好的 TypeScript 支持，是现代 Vue 开发的核心特性。
