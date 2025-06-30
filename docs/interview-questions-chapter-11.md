# 第11章面试问题：组合式API深度解析

## 核心概念类问题

### 1. 什么是组合式API？它解决了什么问题？

**考查点：** 组合式API的基本概念和设计初衷

**参考答案：**

组合式API（Composition API）是Vue3引入的一套新的API，它提供了一种更灵活的方式来组织和复用组件逻辑。

**解决的核心问题：**

1. **逻辑复用困难**
   ```javascript
   // Options API - 逻辑分散
   export default {
     data() {
       return {
         userLoading: false,
         user: null,
         postsLoading: false,
         posts: []
       }
     },
     methods: {
       fetchUser() { /* 用户逻辑 */ },
       fetchPosts() { /* 文章逻辑 */ }
     }
   }
   
   // Composition API - 逻辑集中
   export default {
     setup() {
       const { user, userLoading, fetchUser } = useUser()
       const { posts, postsLoading, fetchPosts } = usePosts()
       
       return { user, userLoading, fetchUser, posts, postsLoading, fetchPosts }
     }
   }
   ```

2. **大型组件难以维护**
   - Options API将相关逻辑分散在data、methods、computed中
   - Composition API按功能组织代码，相关逻辑集中在一起

3. **TypeScript支持不足**
   - Options API中this的类型推导困难
   - Composition API提供更好的类型推导和IDE支持

4. **逻辑组织方式单一**
   - Options API强制按选项类型组织代码
   - Composition API允许按功能模块组织代码

**核心优势：**
- 更好的逻辑复用
- 更灵活的代码组织
- 更好的TypeScript支持
- 更小的打包体积（Tree-shaking友好）

### 2. setup函数的执行时机是什么？它接收哪些参数？

**考查点：** setup函数的执行机制和参数使用

**参考答案：**

**执行时机：**
setup函数在组件实例创建时调用，位于beforeCreate和created之间：

```javascript
// 组件生命周期流程
1. 创建组件实例
2. 初始化props
3. 调用setup函数 ←—— 在这里执行
4. 初始化data（如果有）
5. 初始化computed
6. 调用created钩子
```

**接收的参数：**

1. **第一个参数：props**
   ```javascript
   export default {
     props: ['message', 'count'],
     setup(props) {
       console.log(props.message) // 响应式的props
       
       // ❌ 不能解构，会失去响应性
       // const { message } = props
       
       // ✅ 使用toRefs保持响应性
       const { message, count } = toRefs(props)
       
       return { message, count }
     }
   }
   ```

2. **第二个参数：context**
   ```javascript
   export default {
     setup(props, context) {
       const { attrs, slots, emit, expose } = context
       
       // attrs: 非prop的attribute
       console.log(attrs.class, attrs.style)
       
       // slots: 插槽对象
       const hasDefault = !!slots.default
       
       // emit: 事件发射函数
       const handleClick = () => emit('click', 'data')
       
       // expose: 暴露组件内部API
       expose({
         focus() {
           // 暴露给父组件的方法
         }
       })
       
       return { handleClick }
     }
   }
   ```

**注意事项：**
- setup函数是同步的，不能是async函数
- 在setup中可以访问props，但不能访问this
- setup返回的对象会自动解包ref

### 3. ref和reactive有什么区别？分别在什么场景下使用？

**考查点：** 响应式API的选择和使用场景

**参考答案：**

**基本区别：**

| 特性 | ref | reactive |
|------|-----|----------|
| 使用对象 | 任何类型 | 只能是对象/数组 |
| 访问方式 | .value | 直接访问属性 |
| 模板中 | 自动解包 | 直接使用 |
| 解构 | 失去响应性 | 失去响应性 |
| 重新赋值 | 支持 | 不支持 |

**具体示例：**

```javascript
// ref - 适用于基本类型和需要重新赋值的场景
const count = ref(0)
const user = ref({ name: 'John' })

// 访问和修改
count.value++
user.value = { name: 'Jane' } // 可以重新赋值

// reactive - 适用于复杂对象
const state = reactive({
  count: 0,
  user: { name: 'John' }
})

// 直接访问和修改
state.count++
state.user.name = 'Jane'

// ❌ 不能重新赋值
// state = { count: 10 } // 这样做会失去响应性
```

**使用场景：**

1. **使用ref的场景：**
   ```javascript
   // 基本类型
   const loading = ref(false)
   const message = ref('')
   
   // 需要重新赋值的对象
   const currentUser = ref(null)
   currentUser.value = await fetchUser()
   
   // DOM元素引用
   const inputRef = ref()
   ```

2. **使用reactive的场景：**
   ```javascript
   // 复杂的状态对象
   const form = reactive({
     username: '',
     password: '',
     errors: {}
   })
   
   // 列表数据
   const state = reactive({
     items: [],
     loading: false,
     error: null
   })
   ```

**最佳实践：**
- 基本类型和需要重新赋值的场景使用ref
- 复杂对象且不需要重新赋值的场景使用reactive
- 可以结合使用，根据具体需求选择

### 4. computed在Composition API中是如何工作的？

**考查点：** computed计算属性的实现原理和使用方式

**参考答案：**

**基本使用：**

```javascript
import { ref, computed } from 'vue'

export default {
  setup() {
    const count = ref(0)
    
    // 只读computed
    const doubled = computed(() => count.value * 2)
    
    // 可写computed
    const fullName = computed({
      get() {
        return `${firstName.value} ${lastName.value}`
      },
      set(value) {
        [firstName.value, lastName.value] = value.split(' ')
      }
    })
    
    return { count, doubled, fullName }
  }
}
```

**工作原理：**

1. **依赖收集**
   ```javascript
   // 模拟computed实现
   class ComputedRef {
     constructor(getter) {
       this._getter = getter
       this._dirty = true
       this._value = undefined
       
       // 创建effect收集依赖
       this.effect = new ReactiveEffect(getter, () => {
         if (!this._dirty) {
           this._dirty = true
           // 触发computed的依赖更新
           triggerRefValue(this)
         }
       })
     }
     
     get value() {
       // 惰性计算
       if (this._dirty) {
         this._value = this.effect.run()
         this._dirty = false
       }
       return this._value
     }
   }
   ```

2. **缓存机制**
   ```javascript
   const count = ref(0)
   const expensiveComputed = computed(() => {
     console.log('计算执行') // 只有在依赖变化时才执行
     return count.value * 2
   })
   
   // 多次访问，只计算一次
   console.log(expensiveComputed.value) // 计算执行
   console.log(expensiveComputed.value) // 使用缓存
   console.log(expensiveComputed.value) // 使用缓存
   
   // 依赖变化后重新计算
   count.value = 10 // 标记为dirty
   console.log(expensiveComputed.value) // 重新计算
   ```

**高级用法：**

```javascript
// 调试computed
const debugComputed = computed(() => {
  return count.value * 2
}, {
  onTrack(e) {
    console.log('依赖被跟踪:', e)
  },
  onTrigger(e) {
    console.log('计算被触发:', e)
  }
})

// 链式computed
const count = ref(1)
const doubled = computed(() => count.value * 2)
const quadrupled = computed(() => doubled.value * 2)
```

## 实现原理类问题

### 5. watch和watchEffect有什么区别？它们的实现原理是什么？

**考查点：** 侦听器API的区别和底层实现

**参考答案：**

**基本区别：**

| 特性 | watch | watchEffect |
|------|-------|-------------|
| 监听源 | 明确指定 | 自动收集 |
| 回调参数 | newVal, oldVal | 无 |
| 立即执行 | 可选 | 默认立即执行 |
| 停止监听 | 返回停止函数 | 返回停止函数 |

**使用示例：**

```javascript
// watch - 明确指定监听源
const count = ref(0)
const name = ref('Vue')

// 监听单个ref
watch(count, (newVal, oldVal) => {
  console.log(`count: ${oldVal} -> ${newVal}`)
})

// 监听多个源
watch([count, name], ([newCount, newName], [oldCount, oldName]) => {
  console.log('Multiple sources changed')
})

// 监听对象属性
watch(() => user.name, (newName, oldName) => {
  console.log(`name: ${oldName} -> ${newName}`)
})

// watchEffect - 自动收集依赖
watchEffect(() => {
  console.log(`count: ${count.value}, name: ${name.value}`)
  // 自动跟踪count和name的变化
})
```

**实现原理：**

```javascript
// 简化的实现
function watch(source, cb, options = {}) {
  let getter
  
  // 处理不同类型的source
  if (isRef(source)) {
    getter = () => source.value
  } else if (isReactive(source)) {
    getter = () => source
    options.deep = true
  } else if (isFunction(source)) {
    getter = source
  }
  
  let oldValue
  
  const job = () => {
    const newValue = effect.run()
    if (hasChanged(newValue, oldValue) || options.deep) {
      cb(newValue, oldValue)
      oldValue = newValue
    }
  }
  
  const effect = new ReactiveEffect(getter, job)
  
  // 初始值
  oldValue = effect.run()
  
  return () => effect.stop()
}

function watchEffect(effect, options = {}) {
  const runner = new ReactiveEffect(effect)
  
  // 立即执行
  runner.run()
  
  return () => runner.stop()
}
```

**高级用法：**

```javascript
// 深度监听
watch(user, (newUser, oldUser) => {
  console.log('User changed deeply')
}, { deep: true })

// 立即执行
watch(count, (newVal) => {
  console.log('Initial and changed:', newVal)
}, { immediate: true })

// 清理副作用
const stop = watchEffect((onCleanup) => {
  const timer = setInterval(() => {
    console.log('Timer tick')
  }, 1000)
  
  onCleanup(() => {
    clearInterval(timer)
  })
})

// 控制flush时机
watch(count, () => {
  // DOM更新后执行
}, { flush: 'post' })
```

### 6. 生命周期hooks在Composition API中是如何实现的？

**考查点：** 生命周期hooks的实现机制

**参考答案：**

**API对比：**

| Options API | Composition API |
|-------------|-----------------|
| beforeCreate | setup() |
| created | setup() |
| beforeMount | onBeforeMount |
| mounted | onMounted |
| beforeUpdate | onBeforeUpdate |
| updated | onUpdated |
| beforeUnmount | onBeforeUnmount |
| unmounted | onUnmounted |
| activated | onActivated |
| deactivated | onDeactivated |
| errorCaptured | onErrorCaptured |

**使用示例：**

```javascript
import { onMounted, onUnmounted, onBeforeUpdate, onUpdated } from 'vue'

export default {
  setup() {
    // 可以注册多个相同类型的钩子
    onMounted(() => {
      console.log('第一个mounted钩子')
    })
    
    onMounted(() => {
      console.log('第二个mounted钩子')
    })
    
    // 清理资源
    onUnmounted(() => {
      console.log('组件卸载，清理资源')
    })
    
    // 条件注册
    if (someCondition) {
      onMounted(() => {
        console.log('条件性注册的钩子')
      })
    }
  }
}
```

**实现原理：**

```javascript
// 模拟实现
let currentInstance = null

function setCurrentInstance(instance) {
  currentInstance = instance
}

function onMounted(hook) {
  if (!currentInstance) {
    console.warn('onMounted只能在setup中调用')
    return
  }
  
  const instance = currentInstance
  if (!instance.hooks.mounted) {
    instance.hooks.mounted = []
  }
  
  instance.hooks.mounted.push(hook)
}

// 在组件生命周期中调用
function callMountedHooks(instance) {
  const hooks = instance.hooks.mounted
  if (hooks) {
    hooks.forEach(hook => {
      try {
        hook()
      } catch (error) {
        console.error('mounted钩子执行错误:', error)
      }
    })
  }
}

// 组件挂载流程
function mountComponent(instance) {
  // 设置当前实例
  setCurrentInstance(instance)
  
  // 调用setup，注册钩子
  instance.setupResult = instance.setup()
  
  // 清理当前实例
  setCurrentInstance(null)
  
  // 执行beforeMount钩子
  callHooks(instance, 'beforeMount')
  
  // 挂载组件
  // ...
  
  // 执行mounted钩子
  callMountedHooks(instance)
}
```

**高级用法：**

```javascript
// 异步组件的生命周期
export default {
  async setup() {
    // 可以在异步操作前注册钩子
    onMounted(() => {
      console.log('异步组件mounted')
    })
    
    // 异步操作
    const data = await fetchData()
    
    // 异步操作后仍然可以注册钩子
    onMounted(() => {
      console.log('异步操作完成后的mounted')
    })
    
    return { data }
  }
}

// 条件性钩子注册
export default {
  setup(props) {
    if (props.enableAutoSave) {
      onMounted(() => {
        startAutoSave()
      })
      
      onUnmounted(() => {
        stopAutoSave()
      })
    }
    
    // 错误处理钩子
    onErrorCaptured((error, instance, info) => {
      console.error('子组件错误:', error)
      return false // 阻止错误传播
    })
  }
}
```

### 7. provide/inject在Composition API中是如何工作的？

**考查点：** 依赖注入系统的实现和使用

**参考答案：**

**基本使用：**

```javascript
// 祖先组件
import { provide, ref } from 'vue'

export default {
  setup() {
    const theme = ref('dark')
    const user = reactive({ name: 'John', role: 'admin' })
    
    // 提供数据
    provide('theme', theme)
    provide('user', user)
    
    // 提供方法
    provide('updateTheme', (newTheme) => {
      theme.value = newTheme
    })
    
    return { theme }
  }
}

// 后代组件
import { inject } from 'vue'

export default {
  setup() {
    // 注入数据
    const theme = inject('theme')
    const user = inject('user')
    const updateTheme = inject('updateTheme')
    
    // 提供默认值
    const config = inject('config', { mode: 'production' })
    
    // 工厂函数作为默认值
    const api = inject('api', () => createApiClient(), true)
    
    return { theme, user, updateTheme, config, api }
  }
}
```

**TypeScript支持：**

```typescript
// 定义类型安全的injection key
import type { InjectionKey, Ref } from 'vue'

interface User {
  name: string
  role: string
}

const userKey: InjectionKey<User> = Symbol('user')
const themeKey: InjectionKey<Ref<string>> = Symbol('theme')

// 提供时有类型检查
provide(userKey, { name: 'John', role: 'admin' })
provide(themeKey, ref('dark'))

// 注入时自动推导类型
const user = inject(userKey) // 类型: User | undefined
const theme = inject(themeKey) // 类型: Ref<string> | undefined
```

**实现原理：**

```javascript
// 简化的实现原理
function provide(key, value) {
  const instance = getCurrentInstance()
  if (!instance) {
    console.warn('provide只能在setup中使用')
    return
  }
  
  let provides = instance.provides
  
  // 创建当前实例的provides对象
  const parentProvides = instance.parent?.provides
  if (provides === parentProvides) {
    provides = instance.provides = Object.create(parentProvides)
  }
  
  provides[key] = value
}

function inject(key, defaultValue, treatDefaultAsFactory = false) {
  const instance = getCurrentInstance()
  if (!instance) {
    console.warn('inject只能在setup中使用')
    return defaultValue
  }
  
  // 从当前实例开始向上查找
  let source = instance.parent
  while (source) {
    if (source.provides && key in source.provides) {
      return source.provides[key]
    }
    source = source.parent
  }
  
  // 未找到，返回默认值
  if (arguments.length > 1) {
    return treatDefaultAsFactory && typeof defaultValue === 'function'
      ? defaultValue()
      : defaultValue
  }
  
  console.warn(`注入 "${key}" 未找到`)
}
```

**高级模式：**

```javascript
// 创建Context模式
function createContext(name) {
  const key = Symbol(name)
  
  function provideContext(data) {
    provide(key, data)
  }
  
  function useContext() {
    const context = inject(key)
    if (!context) {
      throw new Error(`use${name} must be used within ${name}Provider`)
    }
    return context
  }
  
  return { provideContext, useContext }
}

// 使用Context
const { provideContext: provideAuth, useContext: useAuth } = createContext('Auth')

// Provider组件
export default {
  setup() {
    const user = ref(null)
    const login = async (credentials) => {
      user.value = await api.login(credentials)
    }
    
    provideAuth({ user, login })
    
    return {}
  }
}

// Consumer组件
export default {
  setup() {
    const { user, login } = useAuth()
    return { user, login }
  }
}
```

## 实战应用类问题

### 8. 如何设计一个好的Composable函数？

**考查点：** Composable函数的设计原则和最佳实践

**参考答案：**

**设计原则：**

1. **单一职责**：每个composable只负责一个特定的功能
2. **输入输出明确**：清晰的参数和返回值
3. **可组合性**：能够与其他composable组合使用
4. **错误处理**：合理的错误处理机制
5. **类型安全**：良好的TypeScript支持

**最佳实践示例：**

```javascript
// ✅ 好的设计：useCounter
function useCounter(initialValue = 0, options = {}) {
  const { min = -Infinity, max = Infinity } = options
  
  const count = ref(initialValue)
  
  const increment = (delta = 1) => {
    count.value = Math.min(max, count.value + delta)
  }
  
  const decrement = (delta = 1) => {
    count.value = Math.max(min, count.value - delta)
  }
  
  const reset = () => {
    count.value = initialValue
  }
  
  const set = (value) => {
    count.value = Math.max(min, Math.min(max, value))
  }
  
  return {
    count: readonly(count), // 只读，防止外部直接修改
    increment,
    decrement,
    reset,
    set
  }
}

// ✅ 好的设计：useAsyncState
function useAsyncState(promise, defaultValue, options = {}) {
  const {
    resetOnExecute = true,
    shallow = true,
    delay = 0,
    onSuccess = () => {},
    onError = () => {}
  } = options
  
  const state = shallow ? shallowRef(defaultValue) : ref(defaultValue)
  const isReady = ref(false)
  const isLoading = ref(false)
  const error = ref(null)
  
  const execute = async (...args) => {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    isLoading.value = true
    error.value = null
    
    if (resetOnExecute) {
      state.value = defaultValue
    }
    
    try {
      const data = await (typeof promise === 'function' ? promise(...args) : promise)
      state.value = data
      isReady.value = true
      onSuccess(data)
      return data
    } catch (err) {
      error.value = err
      onError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  return {
    state,
    isReady,
    isLoading,
    error,
    execute
  }
}
```

**组合使用示例：**

```javascript
// 组合多个composable
function useUserDashboard() {
  // 用户状态
  const { 
    state: user, 
    isLoading: userLoading, 
    error: userError,
    execute: fetchUser 
  } = useAsyncState(() => api.getCurrentUser(), null)
  
  // 通知计数
  const { count: notificationCount, increment: addNotification } = useCounter(0)
  
  // 页面状态
  const activeTab = ref('profile')
  const sidebarCollapsed = ref(false)
  
  // 组合逻辑
  const isReady = computed(() => user.value !== null)
  
  // 初始化
  onMounted(() => {
    fetchUser()
  })
  
  // 监听用户变化
  watch(user, (newUser) => {
    if (newUser) {
      // 用户登录后的逻辑
      addNotification()
    }
  })
  
  return {
    // 用户相关
    user,
    userLoading,
    userError,
    fetchUser,
    
    // 通知相关
    notificationCount,
    addNotification,
    
    // UI状态
    activeTab,
    sidebarCollapsed,
    
    // 计算属性
    isReady
  }
}
```

**错误处理模式：**

```javascript
function useSafeAsyncOperation(operation) {
  const { state, isLoading, error, execute } = useAsyncState(operation, null)
  
  const executeWithRetry = async (maxRetries = 3, ...args) => {
    let lastError
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await execute(...args)
      } catch (err) {
        lastError = err
        if (i < maxRetries) {
          // 重试前等待
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)))
        }
      }
    }
    
    throw lastError
  }
  
  return {
    state,
    isLoading,
    error,
    execute: executeWithRetry
  }
}
```

### 9. 如何在大型项目中组织Composition API代码？

**考查点：** 大型项目中的代码组织和架构设计

**参考答案：**

**目录结构：**

```
src/
├── composables/           # 可复用的逻辑
│   ├── core/             # 核心composables
│   │   ├── useStorage.js
│   │   ├── useEventListener.js
│   │   └── useAsyncState.js
│   ├── business/         # 业务composables
│   │   ├── useAuth.js
│   │   ├── useCart.js
│   │   └── useOrders.js
│   └── ui/              # UI相关composables
│       ├── useModal.js
│       ├── useToast.js
│       └── useTheme.js
├── components/           # 组件
├── stores/              # 状态管理
├── utils/               # 工具函数
└── types/               # TypeScript类型定义
```

**分层架构：**

```javascript
// 1. 基础工具层
// composables/core/useStorage.js
export function useStorage(key, defaultValue, storage = localStorage) {
  const storedValue = storage.getItem(key)
  const state = ref(storedValue ? JSON.parse(storedValue) : defaultValue)
  
  watch(state, (newValue) => {
    storage.setItem(key, JSON.stringify(newValue))
  }, { deep: true })
  
  return state
}

// 2. 业务逻辑层
// composables/business/useAuth.js
export function useAuth() {
  const user = useStorage('user', null)
  const token = useStorage('token', null)
  
  const isLoggedIn = computed(() => !!user.value && !!token.value)
  
  const login = async (credentials) => {
    const response = await api.login(credentials)
    user.value = response.user
    token.value = response.token
  }
  
  const logout = () => {
    user.value = null
    token.value = null
  }
  
  return {
    user: readonly(user),
    token: readonly(token),
    isLoggedIn,
    login,
    logout
  }
}

// 3. 组合层
// composables/business/useUserDashboard.js
export function useUserDashboard() {
  const auth = useAuth()
  const { data: profile, execute: fetchProfile } = useAsyncState(
    () => api.getUserProfile(auth.user.value.id),
    null
  )
  
  const { showToast } = useToast()
  
  const updateProfile = async (data) => {
    try {
      await api.updateProfile(data)
      await fetchProfile()
      showToast('Profile updated successfully', 'success')
    } catch (error) {
      showToast('Failed to update profile', 'error')
    }
  }
  
  return {
    profile,
    updateProfile,
    isLoggedIn: auth.isLoggedIn
  }
}
```

**模块化组织：**

```javascript
// composables/index.js - 统一导出
export * from './core'
export * from './business'
export * from './ui'

// 或者按需导出
export { useAuth } from './business/useAuth'
export { useCart } from './business/useCart'
export { useStorage } from './core/useStorage'

// 在组件中使用
import { useAuth, useCart, useStorage } from '@/composables'
```

**类型定义：**

```typescript
// types/composables.ts
export interface UseAsyncStateOptions {
  resetOnExecute?: boolean
  shallow?: boolean
  delay?: number
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
}

export interface UseAuthReturn {
  user: Readonly<Ref<User | null>>
  token: Readonly<Ref<string | null>>
  isLoggedIn: ComputedRef<boolean>
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
}

// composables/business/useAuth.ts
export function useAuth(): UseAuthReturn {
  // 实现...
}
```

### 10. Composition API与Options API的性能对比如何？

**考查点：** 两种API的性能差异和优化策略

**参考答案：**

**性能对比分析：**

1. **内存使用**
   ```javascript
   // Options API - 每个组件实例都有完整的选项对象
   export default {
     data() {
       return {
         count: 0,
         items: []
       }
     },
     computed: {
       doubled() { return this.count * 2 }
     },
     methods: {
       increment() { this.count++ }
     }
   }
   
   // Composition API - 更少的对象创建
   export default {
     setup() {
       const count = ref(0)
       const items = ref([])
       const doubled = computed(() => count.value * 2)
       const increment = () => count.value++
       
       return { count, items, doubled, increment }
     }
   }
   ```

2. **Tree-shaking支持**
   ```javascript
   // Composition API支持按需引入
   import { ref, computed } from 'vue'
   // 只引入需要的API，减少打包体积
   
   // Options API无法tree-shake
   // 所有选项都会被包含在最终打包中
   ```

3. **组件初始化性能**
   ```javascript
   // 性能测试代码
   function performanceTest() {
     const iterations = 10000
     
     // Options API组件创建
     console.time('Options API')
     for (let i = 0; i < iterations; i++) {
       createOptionsComponent()
     }
     console.timeEnd('Options API')
     
     // Composition API组件创建
     console.time('Composition API')
     for (let i = 0; i < iterations; i++) {
       createCompositionComponent()
     }
     console.timeEnd('Composition API')
   }
   ```

**优化策略：**

1. **合理使用ref和reactive**
   ```javascript
   // ❌ 过度使用reactive
   const state = reactive({
     a: 1,
     b: 2,
     c: 3,
     // ... 大量属性
   })
   
   // ✅ 按需使用
   const a = ref(1)
   const b = ref(2)
   const complexState = reactive({
     nested: {
       data: []
     }
   })
   ```

2. **避免不必要的响应式转换**
   ```javascript
   // ❌ 静态数据不需要响应式
   const staticConfig = reactive({
     API_URL: 'https://api.example.com',
     VERSION: '1.0.0'
   })
   
   // ✅ 静态数据直接使用
   const staticConfig = {
     API_URL: 'https://api.example.com',
     VERSION: '1.0.0'
   }
   ```

3. **使用shallowRef和shallowReactive**
   ```javascript
   // 大量数据使用浅层响应式
   const largeList = shallowRef([])
   const largeObject = shallowReactive({
     data: new Array(10000).fill(0).map((_, i) => ({ id: i }))
   })
   ```

4. **计算属性缓存优化**
   ```javascript
   // ✅ 利用computed的缓存特性
   const expensiveComputed = computed(() => {
     return heavyCalculation(data.value)
   })
   
   // ❌ 在模板中直接调用函数
   // {{ heavyCalculation(data) }}
   ```

**基准测试结果：**
- 组件初始化速度：Composition API比Options API快约15-20%
- 内存使用：Composition API减少约10-15%的内存占用
- 打包体积：使用Composition API可减少约20-30%的体积（通过tree-shaking）
- 运行时性能：两者相近，但Composition API在大型组件中表现更好

**选择建议：**
- 新项目推荐使用Composition API
- 小型组件两者性能差异不大，可根据团队习惯选择
- 大型复杂组件建议使用Composition API
- 需要更好的TypeScript支持时选择Composition API

---

## 总结

本章涵盖了Vue3组合式API的核心概念和实现原理，包括：

1. **setup函数**：执行时机、参数使用、返回值处理
2. **响应式API**：ref、reactive、computed、watch的实现和使用
3. **生命周期hooks**：新的钩子函数和注册机制
4. **依赖注入**：provide/inject的工作原理
5. **Composable函数**：设计原则和最佳实践
6. **性能优化**：与Options API的对比和优化策略

掌握这些内容对于深入理解Vue3和在实际项目中高效使用Composition API至关重要。 