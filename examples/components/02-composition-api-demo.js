/**
 * 第11章：组合式API深度解析 - 完整演示
 * 
 * 本文件演示Vue3组合式API的核心概念：
 * 1. setup函数的执行机制和上下文
 * 2. 响应式API (ref, reactive, computed, watch)
 * 3. 生命周期hooks的使用
 * 4. 依赖注入系统 (provide/inject)
 * 5. Composable函数的设计和复用
 * 6. 与Options API的对比
 */

console.log('🚀 Vue3组合式API深度解析演示开始')

// ===== 1. ref系统演示 =====

/**
 * 模拟Vue3的ref实现
 */
class RefImpl {
  constructor(value, isShallow = false) {
    this._value = value
    this._rawValue = value
    this.__v_isRef = true
    this.__v_isShallow = isShallow
    this.dep = new Set() // 依赖收集
    
    console.log(`📦 创建ref:`, value)
  }
  
  get value() {
    // 依赖收集
    this.track()
    return this._value
  }
  
  set value(newValue) {
    if (newValue !== this._rawValue) {
      console.log(`🔄 ref值变化: ${this._rawValue} -> ${newValue}`)
      this._rawValue = newValue
      this._value = newValue
      // 触发依赖更新
      this.trigger()
    }
  }
  
  track() {
    if (currentEffect) {
      this.dep.add(currentEffect)
      console.log(`📍 收集依赖:`, currentEffect.name)
    }
  }
  
  trigger() {
    console.log(`⚡ 触发依赖更新，共 ${this.dep.size} 个依赖`)
    this.dep.forEach(effect => {
      effect()
    })
  }
}

function ref(value) {
  return new RefImpl(value)
}

function shallowRef(value) {
  return new RefImpl(value, true)
}

// 当前活动的effect
let currentEffect = null

function effect(fn, options = {}) {
  const effectFn = () => {
    currentEffect = effectFn
    try {
      return fn()
    } finally {
      currentEffect = null
    }
  }
  
  effectFn.name = options.name || 'anonymous'
  
  // 立即执行一次
  effectFn()
  
  return effectFn
}

// ===== 2. reactive系统演示 =====

/**
 * 模拟Vue3的reactive实现
 */
function reactive(target) {
  if (target.__v_isReactive) {
    return target
  }
  
  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      console.log(`🔍 读取属性: ${String(key)}`)
      
      // 特殊key处理
      if (key === '__v_isReactive') {
        return true
      }
      
      const result = Reflect.get(target, key, receiver)
      
      // 依赖收集
      track(target, key)
      
      // 深层响应式
      if (typeof result === 'object' && result !== null) {
        return reactive(result)
      }
      
      return result
    },
    
    set(target, key, value, receiver) {
      const oldValue = target[key]
      const result = Reflect.set(target, key, value, receiver)
      
      if (value !== oldValue) {
        console.log(`✏️ 设置属性: ${String(key)} = ${value}`)
        // 触发更新
        trigger(target, key)
      }
      
      return result
    },
    
    deleteProperty(target, key) {
      const hasKey = Object.prototype.hasOwnProperty.call(target, key)
      const result = Reflect.deleteProperty(target, key)
      
      if (hasKey && result) {
        console.log(`🗑️ 删除属性: ${String(key)}`)
        trigger(target, key)
      }
      
      return result
    }
  })
  
  console.log('🎯 创建reactive对象')
  return proxy
}

// 依赖映射表
const targetMap = new WeakMap()

function track(target, key) {
  if (!currentEffect) return
  
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  
  if (!dep.has(currentEffect)) {
    dep.add(currentEffect)
    console.log(`📌 跟踪依赖: ${String(key)} -> ${currentEffect.name}`)
  }
}

function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  
  const dep = depsMap.get(key)
  if (dep) {
    console.log(`🔥 触发依赖: ${String(key)}, 共 ${dep.size} 个`)
    dep.forEach(effect => effect())
  }
}

// ===== 3. computed系统演示 =====

/**
 * 模拟Vue3的computed实现
 */
class ComputedRefImpl {
  constructor(getter, setter) {
    this._getter = getter
    this._setter = setter
    this._dirty = true
    this._value = undefined
    this.__v_isRef = true
    this.dep = new Set()
    
    // 创建计算属性的effect
    this.effect = effect(() => {
      if (this._dirty) {
        this._value = this._getter()
        this._dirty = false
        console.log('💡 计算属性重新计算:', this._value)
      }
    }, { name: 'computed' })
    
    console.log('🧮 创建computed')
  }
  
  get value() {
    this.track()
    if (this._dirty) {
      this._value = this._getter()
      this._dirty = false
      console.log('💡 计算属性计算:', this._value)
    }
    return this._value
  }
  
  set value(newValue) {
    if (this._setter) {
      this._setter(newValue)
    } else {
      console.warn('⚠️ 计算属性是只读的')
    }
  }
  
  track() {
    if (currentEffect) {
      this.dep.add(currentEffect)
    }
  }
  
  trigger() {
    this.dep.forEach(effect => effect())
  }
}

function computed(getterOrOptions) {
  let getter, setter
  
  if (typeof getterOrOptions === 'function') {
    getter = getterOrOptions
    setter = null
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }
  
  return new ComputedRefImpl(getter, setter)
}

// ===== 4. watch系统演示 =====

function watch(source, callback, options = {}) {
  let getter
  
  if (typeof source === 'function') {
    getter = source
  } else if (source.__v_isRef) {
    getter = () => source.value
  } else {
    getter = () => traverse(source)
  }
  
  let oldValue
  
  const effectFn = effect(() => {
    const newValue = getter()
    if (oldValue !== undefined) {
      callback(newValue, oldValue)
    }
    oldValue = newValue
  }, { name: 'watch' })
  
  // 立即执行
  if (options.immediate) {
    callback(getter(), undefined)
  }
  
  console.log('👁️ 创建watcher')
  
  // 返回停止函数
  return () => {
    console.log('🛑 停止watcher')
    // 清理依赖
  }
}

function watchEffect(callback, options = {}) {
  const effectFn = effect(callback, { name: 'watchEffect' })
  
  console.log('👀 创建watchEffect')
  
  return () => {
    console.log('🛑 停止watchEffect')
  }
}

// 深度遍历对象
function traverse(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) {
    return value
  }
  
  seen.add(value)
  
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen)
    }
  } else {
    for (const key in value) {
      traverse(value[key], seen)
    }
  }
  
  return value
}

// ===== 5. 生命周期hooks演示 =====

/**
 * 模拟Vue3的生命周期hooks系统
 */
class ComponentLifecycle {
  constructor() {
    this.hooks = {}
    this.currentInstance = null
  }
  
  setCurrentInstance(instance) {
    this.currentInstance = instance
  }
  
  onMounted(callback) {
    this.registerHook('mounted', callback)
  }
  
  onUnmounted(callback) {
    this.registerHook('unmounted', callback)
  }
  
  onBeforeUpdate(callback) {
    this.registerHook('beforeUpdate', callback)
  }
  
  onUpdated(callback) {
    this.registerHook('updated', callback)
  }
  
  registerHook(type, callback) {
    if (!this.currentInstance) {
      console.warn('⚠️ 生命周期钩子只能在setup中使用')
      return
    }
    
    const instance = this.currentInstance
    if (!instance.hooks[type]) {
      instance.hooks[type] = []
    }
    
    instance.hooks[type].push(callback)
    console.log(`🎣 注册生命周期钩子: ${type}`)
  }
  
  invokeHooks(instance, type) {
    const hooks = instance.hooks[type]
    if (hooks && hooks.length > 0) {
      console.log(`🚀 执行生命周期钩子: ${type}`)
      hooks.forEach(hook => {
        try {
          hook()
        } catch (error) {
          console.error(`❌ 生命周期钩子执行错误 (${type}):`, error)
        }
      })
    }
  }
}

const lifecycle = new ComponentLifecycle()

// ===== 6. 依赖注入系统演示 =====

/**
 * 模拟Vue3的provide/inject系统
 */
class DependencyInjection {
  constructor() {
    this.currentInstance = null
    this.providersMap = new WeakMap()
  }
  
  setCurrentInstance(instance) {
    this.currentInstance = instance
  }
  
  provide(key, value) {
    if (!this.currentInstance) {
      console.warn('⚠️ provide只能在setup中使用')
      return
    }
    
    const instance = this.currentInstance
    let provides = this.providersMap.get(instance)
    
    if (!provides) {
      provides = Object.create(
        instance.parent ? this.providersMap.get(instance.parent) : null
      )
      this.providersMap.set(instance, provides)
    }
    
    provides[key] = value
    console.log(`🎁 提供依赖: ${key} =`, value)
  }
  
  inject(key, defaultValue) {
    if (!this.currentInstance) {
      console.warn('⚠️ inject只能在setup中使用')
      return defaultValue
    }
    
    let instance = this.currentInstance
    
    // 向上查找provides
    while (instance) {
      const provides = this.providersMap.get(instance)
      if (provides && key in provides) {
        console.log(`💉 注入依赖: ${key} =`, provides[key])
        return provides[key]
      }
      instance = instance.parent
    }
    
    console.log(`🔍 未找到依赖，使用默认值: ${key} =`, defaultValue)
    return defaultValue
  }
}

const di = new DependencyInjection()

// ===== 7. Composable函数演示 =====

/**
 * 可复用的计数器逻辑
 */
function useCounter(initialValue = 0) {
  const count = ref(initialValue)
  
  const increment = () => {
    count.value++
    console.log(`➕ 计数增加: ${count.value}`)
  }
  
  const decrement = () => {
    count.value--
    console.log(`➖ 计数减少: ${count.value}`)
  }
  
  const reset = () => {
    count.value = initialValue
    console.log(`🔄 计数重置: ${count.value}`)
  }
  
  const doubled = computed(() => count.value * 2)
  
  // 监听计数变化
  watch(count, (newVal, oldVal) => {
    console.log(`👁️ 计数变化: ${oldVal} -> ${newVal}`)
  })
  
  console.log('🔢 创建计数器composable')
  
  return {
    count,
    doubled,
    increment,
    decrement,
    reset
  }
}

/**
 * 可复用的鼠标位置追踪
 */
function useMouse() {
  const x = ref(0)
  const y = ref(0)
  
  const updatePosition = (event) => {
    x.value = event.clientX
    y.value = event.clientY
  }
  
  // 在实际环境中会添加事件监听器
  const startTracking = () => {
    console.log('🖱️ 开始追踪鼠标位置')
    // document.addEventListener('mousemove', updatePosition)
  }
  
  const stopTracking = () => {
    console.log('🛑 停止追踪鼠标位置')
    // document.removeEventListener('mousemove', updatePosition)
  }
  
  lifecycle.onMounted(startTracking)
  lifecycle.onUnmounted(stopTracking)
  
  return { x, y, startTracking, stopTracking }
}

/**
 * 异步数据获取composable
 */
function useAsyncData(fetcher) {
  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)
  
  const execute = async (...args) => {
    loading.value = true
    error.value = null
    
    try {
      console.log('📡 开始获取数据...')
      const result = await fetcher(...args)
      data.value = result
      console.log('✅ 数据获取成功:', result)
      return result
    } catch (err) {
      error.value = err
      console.error('❌ 数据获取失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  return {
    data,
    loading,
    error,
    execute
  }
}

// ===== 8. 组件实例模拟 =====

/**
 * 模拟组件实例
 */
class ComponentInstance {
  constructor(name, parent = null) {
    this.name = name
    this.parent = parent
    this.hooks = {}
    this.setupState = {}
    this.isMounted = false
    
    console.log(`🏗️ 创建组件实例: ${name}`)
  }
  
  setupComponent() {
    console.log(`⚙️ 设置组件: ${this.name}`)
    
    // 设置当前实例
    lifecycle.setCurrentInstance(this)
    di.setCurrentInstance(this)
    
    // 调用setup函数
    const setupResult = this.setup()
    
    // 处理setup返回值
    if (setupResult && typeof setupResult === 'object') {
      this.setupState = setupResult
    }
    
    // 清理当前实例
    lifecycle.setCurrentInstance(null)
    di.setCurrentInstance(null)
  }
  
  setup() {
    // 子类重写此方法
    return {}
  }
  
  mount() {
    console.log(`🎬 挂载组件: ${this.name}`)
    
    lifecycle.invokeHooks(this, 'beforeMount')
    
    this.isMounted = true
    
    lifecycle.invokeHooks(this, 'mounted')
  }
  
  unmount() {
    console.log(`🎭 卸载组件: ${this.name}`)
    
    lifecycle.invokeHooks(this, 'beforeUnmount')
    
    this.isMounted = false
    
    lifecycle.invokeHooks(this, 'unmounted')
  }
}

// ===== 9. 具体组件示例 =====

/**
 * 计数器组件 - 使用Composition API
 */
class CounterComponent extends ComponentInstance {
  setup() {
    console.log('🔧 CounterComponent setup执行')
    
    // 使用composable
    const { count, doubled, increment, decrement, reset } = useCounter(0)
    
    // 生命周期
    lifecycle.onMounted(() => {
      console.log('CounterComponent mounted')
    })
    
    lifecycle.onUnmounted(() => {
      console.log('CounterComponent unmounted')
    })
    
    // 监听器
    watchEffect(() => {
      console.log(`当前计数: ${count.value}, 双倍: ${doubled.value}`)
    })
    
    return {
      count,
      doubled,
      increment,
      decrement,
      reset
    }
  }
}

/**
 * 用户信息组件 - 演示依赖注入
 */
class UserInfoComponent extends ComponentInstance {
  setup() {
    console.log('🔧 UserInfoComponent setup执行')
    
    // 注入依赖
    const currentUser = di.inject('currentUser', { name: 'Guest' })
    const theme = di.inject('theme', 'light')
    
    // 状态
    const userStatus = ref('active')
    
    // 计算属性
    const displayName = computed(() => {
      return `${currentUser.name} (${userStatus.value})`
    })
    
    // 方法
    const updateStatus = (status) => {
      userStatus.value = status
      console.log(`用户状态更新: ${status}`)
    }
    
    return {
      currentUser,
      theme,
      userStatus,
      displayName,
      updateStatus
    }
  }
}

/**
 * 应用根组件 - 提供依赖
 */
class AppComponent extends ComponentInstance {
  setup() {
    console.log('🔧 AppComponent setup执行')
    
    // 提供依赖
    di.provide('currentUser', {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com'
    })
    
    di.provide('theme', 'dark')
    
    // 应用状态
    const appReady = ref(false)
    
    // 生命周期
    lifecycle.onMounted(() => {
      console.log('App mounted')
      setTimeout(() => {
        appReady.value = true
        console.log('App ready')
      }, 1000)
    })
    
    return {
      appReady
    }
  }
}

// ===== 10. 演示运行 =====

function runCompositionAPIDemo() {
  console.log('\n=== 🎯 基础响应式API演示 ===')
  
  // ref演示
  const name = ref('Vue3')
  const age = ref(3)
  
  effect(() => {
    console.log(`姓名: ${name.value}, 年龄: ${age.value}`)
  }, { name: 'userInfo' })
  
  name.value = 'Vue.js 3'
  age.value = 4
  
  // reactive演示
  const user = reactive({
    name: 'Alice',
    profile: {
      age: 25,
      city: 'Shanghai'
    }
  })
  
  effect(() => {
    console.log(`用户: ${user.name}, 年龄: ${user.profile.age}, 城市: ${user.profile.city}`)
  }, { name: 'userReactive' })
  
  user.name = 'Bob'
  user.profile.age = 26
  
  // computed演示
  const fullName = computed(() => `${user.name} (${user.profile.age}岁)`)
  
  effect(() => {
    console.log(`完整信息: ${fullName.value}`)
  }, { name: 'fullNameEffect' })
  
  user.name = 'Charlie'
  
  console.log('\n=== 🎯 组件系统演示 ===')
  
  // 创建组件实例
  const app = new AppComponent('App')
  const counter = new CounterComponent('Counter', app)
  const userInfo = new UserInfoComponent('UserInfo', app)
  
  // 设置组件
  app.setupComponent()
  counter.setupComponent()
  userInfo.setupComponent()
  
  // 挂载组件
  app.mount()
  counter.mount()
  userInfo.mount()
  
  console.log('\n=== 🎯 交互演示 ===')
  
  // 操作计数器
  counter.setupState.increment()
  counter.setupState.increment()
  counter.setupState.decrement()
  counter.setupState.reset()
  
  // 更新用户状态
  userInfo.setupState.updateStatus('offline')
  userInfo.setupState.updateStatus('busy')
  
  console.log('\n=== 🎯 清理演示 ===')
  
  // 卸载组件
  setTimeout(() => {
    counter.unmount()
    userInfo.unmount()
    app.unmount()
    
    console.log('🎉 演示完成')
  }, 2000)
}

// 启动演示
runCompositionAPIDemo()

// ===== 11. 性能对比演示 =====

console.log('\n=== 📊 性能对比演示 ===')

/**
 * Options API风格的组件（模拟）
 */
class OptionsAPIComponent extends ComponentInstance {
  constructor(name, parent) {
    super(name, parent)
    this.data = {}
    this.computed = {}
    this.methods = {}
  }
  
  setupComponent() {
    console.log(`⚙️ Options API组件设置: ${this.name}`)
    
    // 模拟Options API的初始化过程
    this.initData()
    this.initComputed()
    this.initMethods()
    this.initWatchers()
  }
  
  initData() {
    this.data = {
      count: 0,
      items: []
    }
    console.log('📦 初始化data')
  }
  
  initComputed() {
    this.computed.doubled = computed(() => this.data.count * 2)
    console.log('🧮 初始化computed')
  }
  
  initMethods() {
    this.methods.increment = () => {
      this.data.count++
    }
    console.log('⚡ 初始化methods')
  }
  
  initWatchers() {
    watch(() => this.data.count, (newVal) => {
      console.log(`Options API: count变化为 ${newVal}`)
    })
    console.log('👁️ 初始化watchers')
  }
}

/**
 * Composition API风格的组件
 */
class CompositionAPIComponent extends ComponentInstance {
  setup() {
    console.log('🔧 Composition API组件setup')
    
    // 使用composable函数
    const { count, doubled, increment } = useCounter(0)
    
    return { count, doubled, increment }
  }
}

// 性能测试
function performanceTest() {
  console.log('开始性能测试...')
  
  const startTime = Date.now()
  
  // 创建多个Options API组件
  const optionsComponents = []
  for (let i = 0; i < 100; i++) {
    const comp = new OptionsAPIComponent(`Options${i}`)
    comp.setupComponent()
    optionsComponents.push(comp)
  }
  
  const optionsTime = Date.now() - startTime
  
  const startTime2 = Date.now()
  
  // 创建多个Composition API组件
  const compositionComponents = []
  for (let i = 0; i < 100; i++) {
    const comp = new CompositionAPIComponent(`Composition${i}`)
    comp.setupComponent()
    compositionComponents.push(comp)
  }
  
  const compositionTime = Date.now() - startTime2
  
  console.log(`Options API 创建100个组件耗时: ${optionsTime}ms`)
  console.log(`Composition API 创建100个组件耗时: ${compositionTime}ms`)
  console.log(`性能提升: ${((optionsTime - compositionTime) / optionsTime * 100).toFixed(2)}%`)
}

performanceTest()

console.log('\n🎉 Vue3组合式API深度解析演示完成！') 