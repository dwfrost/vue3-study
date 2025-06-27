/**
 * Vue3挂载与更新机制演示
 * 本示例展示：
 * 1. 组件挂载流程模拟
 * 2. 响应式更新机制
 * 3. 生命周期钩子系统
 * 4. 调度系统实现
 * 5. 性能优化策略
 */

// ===== 1. 组件实例结构模拟 =====

let uid = 0

// 组件实例接口
class ComponentInstance {
  constructor(vnode, parent = null) {
    this.uid = uid++
    this.vnode = vnode
    this.type = vnode.type
    this.parent = parent
    this.root = parent ? parent.root : this
    
    // 状态
    this.data = {}
    this.props = {}
    this.attrs = {}
    this.slots = {}
    this.refs = {}
    this.setupState = {}
    
    // 生命周期状态
    this.isMounted = false
    this.isUnmounted = false
    this.isUpdating = false
    
    // 生命周期钩子数组
    this.bm = [] // beforeMount
    this.m = []  // mounted
    this.bu = [] // beforeUpdate
    this.u = []  // updated
    this.bum = [] // beforeUnmount
    this.um = [] // unmounted
    
    // 渲染相关
    this.render = null
    this.subTree = null
    this.next = null
    this.update = null
    this.effect = null
    
    // 错误处理
    this.errorCapturedHooks = []
    
    // 依赖追踪
    this.effects = []
    this.scope = new EffectScope()
  }
  
  // 添加生命周期钩子
  addLifecycleHook(type, hook) {
    if (this[type]) {
      this[type].push(hook)
    }
  }
  
  // 调用生命周期钩子
  invokeLifecycleHooks(type) {
    const hooks = this[type]
    if (hooks && hooks.length) {
      hooks.forEach(hook => {
        try {
          hook.call(this)
        } catch (error) {
          console.error(`生命周期钩子 ${type} 执行错误:`, error)
        }
      })
    }
  }
}

// ===== 2. 简化的响应式系统 =====

class ReactiveEffect {
  constructor(fn, scheduler = null) {
    this.fn = fn
    this.scheduler = scheduler
    this.active = true
    this.deps = []
    this.computed = false
    this.allowRecurse = false
  }
  
  run() {
    if (!this.active) {
      return this.fn()
    }
    
    let parent = activeEffect
    let lastShouldTrack = shouldTrack
    
    try {
      activeEffect = this
      shouldTrack = true
      return this.fn()
    } finally {
      activeEffect = parent
      shouldTrack = lastShouldTrack
    }
  }
  
  stop() {
    if (this.active) {
      this.active = false
      this.deps.forEach(dep => dep.delete(this))
      this.deps.length = 0
    }
  }
}

class EffectScope {
  constructor(detached = false) {
    this.detached = detached
    this.active = true
    this.effects = []
    this.cleanups = []
    this.parent = null
    this.scopes = []
  }
  
  run(fn) {
    if (this.active) {
      const currentEffectScope = activeEffectScope
      try {
        activeEffectScope = this
        return fn()
      } finally {
        activeEffectScope = currentEffectScope
      }
    }
  }
  
  stop() {
    if (this.active) {
      this.effects.forEach(effect => effect.stop())
      this.cleanups.forEach(cleanup => cleanup())
      this.scopes.forEach(scope => scope.stop())
      this.active = false
    }
  }
}

let activeEffect = null
let shouldTrack = true
let activeEffectScope = null

// 依赖收集
const targetMap = new WeakMap()

function track(target, key) {
  if (!shouldTrack || !activeEffect) {
    return
  }
  
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}

// 触发更新
function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }
  
  const dep = depsMap.get(key)
  if (dep) {
    const effects = [...dep]
    effects.forEach(effect => {
      if (effect !== activeEffect || effect.allowRecurse) {
        if (effect.scheduler) {
          effect.scheduler()
        } else {
          effect.run()
        }
      }
    })
  }
}

// 简化的ref实现
function ref(value) {
  return new RefImpl(value)
}

class RefImpl {
  constructor(value) {
    this._value = value
    this.__v_isRef = true
  }
  
  get value() {
    track(this, 'value')
    return this._value
  }
  
  set value(newValue) {
    if (newValue !== this._value) {
      this._value = newValue
      trigger(this, 'value')
    }
  }
}

// ===== 3. 调度系统实现 =====

class Scheduler {
  constructor() {
    this.queue = []
    this.pendingPostFlushCbs = []
    this.activePostFlushCbs = null
    this.postFlushIndex = 0
    
    this.isFlushing = false
    this.isFlushPending = false
    this.flushIndex = 0
    
    this.resolvedPromise = Promise.resolve()
    this.currentFlushPromise = null
  }
  
  // 队列任务
  queueJob(job) {
    if (!this.queue.includes(job)) {
      if (job.id == null) {
        this.queue.push(job)
      } else {
        // 按id排序插入
        const index = this.findInsertionIndex(job.id)
        this.queue.splice(index, 0, job)
      }
      this.queueFlush()
    }
  }
  
  // 查找插入位置
  findInsertionIndex(id) {
    let start = this.isFlushing ? this.flushIndex + 1 : 0
    let end = this.queue.length
    
    while (start < end) {
      const middle = (start + end) >>> 1
      const middleJobId = this.getId(this.queue[middle])
      if (middleJobId < id) {
        start = middle + 1
      } else {
        end = middle
      }
    }
    
    return start
  }
  
  getId(job) {
    return job.id == null ? Infinity : job.id
  }
  
  // 队列刷新
  queueFlush() {
    if (!this.isFlushing && !this.isFlushPending) {
      this.isFlushPending = true
      this.currentFlushPromise = this.resolvedPromise.then(() => this.flushJobs())
    }
  }
  
  // 执行队列
  flushJobs() {
    this.isFlushPending = false
    this.isFlushing = true
    
    // 排序确保正确的执行顺序
    this.queue.sort((a, b) => this.getId(a) - this.getId(b))
    
    try {
      for (this.flushIndex = 0; this.flushIndex < this.queue.length; this.flushIndex++) {
        const job = this.queue[this.flushIndex]
        if (job && job.active !== false) {
          try {
            job()
          } catch (error) {
            console.error('调度任务执行错误:', error)
          }
        }
      }
    } finally {
      this.flushIndex = 0
      this.queue.length = 0
      
      this.flushPostFlushCbs()
      
      this.isFlushing = false
      this.currentFlushPromise = null
      
      // 递归处理新增任务
      if (this.queue.length || this.pendingPostFlushCbs.length) {
        this.flushJobs()
      }
    }
  }
  
  // Post-flush回调
  queuePostFlushCb(cb) {
    if (!Array.isArray(cb)) {
      if (!this.activePostFlushCbs || !this.activePostFlushCbs.includes(cb)) {
        this.pendingPostFlushCbs.push(cb)
      }
    } else {
      this.pendingPostFlushCbs.push(...cb)
    }
    this.queueFlush()
  }
  
  flushPostFlushCbs() {
    if (this.pendingPostFlushCbs.length) {
      const deduped = [...new Set(this.pendingPostFlushCbs)]
      this.pendingPostFlushCbs.length = 0
      
      if (this.activePostFlushCbs) {
        this.activePostFlushCbs.push(...deduped)
        return
      }
      
      this.activePostFlushCbs = deduped
      this.activePostFlushCbs.sort((a, b) => this.getId(a) - this.getId(b))
      
      for (this.postFlushIndex = 0; this.postFlushIndex < this.activePostFlushCbs.length; this.postFlushIndex++) {
        try {
          this.activePostFlushCbs[this.postFlushIndex]()
        } catch (error) {
          console.error('Post-flush回调执行错误:', error)
        }
      }
      
      this.activePostFlushCbs = null
      this.postFlushIndex = 0
    }
  }
  
  // nextTick实现
  nextTick(fn) {
    const p = this.currentFlushPromise || this.resolvedPromise
    return fn ? p.then(fn) : p
  }
}

const scheduler = new Scheduler()

// ===== 4. 组件挂载和更新流程 =====

class ComponentRenderer {
  constructor() {
    this.scheduler = scheduler
  }
  
  // 挂载组件
  mountComponent(vnode, container) {
    console.log('🚀 开始挂载组件:', vnode.type.name)
    
    // 1. 创建组件实例
    const instance = this.createComponentInstance(vnode)
    
    // 2. 设置组件
    this.setupComponent(instance)
    
    // 3. 设置渲染effect
    this.setupRenderEffect(instance, container)
    
    return instance
  }
  
  // 创建组件实例
  createComponentInstance(vnode) {
    const instance = new ComponentInstance(vnode)
    
    console.log(`📦 创建组件实例 #${instance.uid}:`, instance.type.name)
    
    return instance
  }
  
  // 设置组件
  setupComponent(instance) {
    const { type } = instance
    
    // 初始化props
    this.initProps(instance, instance.vnode.props)
    
    // 调用setup函数
    if (type.setup) {
      const setupContext = this.createSetupContext(instance)
      const setupResult = type.setup(instance.props, setupContext)
      
      if (typeof setupResult === 'function') {
        instance.render = setupResult
      } else if (setupResult) {
        instance.setupState = setupResult
      }
    }
    
    // 设置render函数
    if (!instance.render) {
      instance.render = type.render
    }
    
    console.log('⚙️ 组件设置完成:', instance.type.name)
  }
  
  // 初始化props
  initProps(instance, props) {
    instance.props = props || {}
  }
  
  // 创建setup上下文
  createSetupContext(instance) {
    return {
      attrs: instance.attrs,
      slots: instance.slots,
      emit: (event, ...args) => {
        console.log(`📡 组件 ${instance.type.name} 触发事件:`, event, args)
      },
      expose: (exposed) => {
        instance.exposed = exposed
      }
    }
  }
  
  // 设置渲染effect
  setupRenderEffect(instance, container) {
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        // 初始挂载
        console.log('🎯 初始挂载:', instance.type.name)
        
        // beforeMount钩子
        instance.invokeLifecycleHooks('bm')
        
        // 渲染
        const subTree = instance.subTree = this.renderComponentRoot(instance)
        console.log('🎨 渲染子树:', subTree)
        
        // 挂载子树到DOM
        this.patch(null, subTree, container)
        
        instance.isMounted = true
        
        // mounted钩子（异步执行）
        if (instance.m.length) {
          this.scheduler.queuePostFlushCb(() => {
            instance.invokeLifecycleHooks('m')
          })
        }
        
        console.log('✅ 挂载完成:', instance.type.name)
      } else {
        // 组件更新
        console.log('🔄 组件更新:', instance.type.name)
        
        instance.isUpdating = true
        
        // beforeUpdate钩子
        instance.invokeLifecycleHooks('bu')
        
        // 渲染新的子树
        const nextTree = this.renderComponentRoot(instance)
        const prevTree = instance.subTree
        instance.subTree = nextTree
        
        console.log('🎨 重新渲染:', { prevTree, nextTree })
        
        // 执行patch
        this.patch(prevTree, nextTree, container)
        
        instance.isUpdating = false
        
        // updated钩子（异步执行）
        if (instance.u.length) {
          this.scheduler.queuePostFlushCb(() => {
            instance.invokeLifecycleHooks('u')
          })
        }
        
        console.log('✅ 更新完成:', instance.type.name)
      }
    }
    
    // 创建响应式effect
    const effect = instance.effect = new ReactiveEffect(
      componentUpdateFn,
      () => {
        // 调度器函数
        const job = () => {
          if (instance.isMounted) {
            componentUpdateFn()
          }
        }
        job.id = instance.uid
        this.scheduler.queueJob(job)
      }
    )
    
    const update = instance.update = () => effect.run()
    update.id = instance.uid
    
    // 首次执行挂载
    update()
  }
  
  // 渲染组件根节点
  renderComponentRoot(instance) {
    const { render, setupState, props } = instance
    
    if (render) {
      // 创建渲染上下文
      const renderContext = new Proxy({ ...setupState, ...props }, {
        get(target, key) {
          return target[key]
        }
      })
      
      // 执行render函数
      return render.call(renderContext)
    }
    
    return null
  }
  
  // 简化的patch函数
  patch(n1, n2, container) {
    if (n1 === n2) {
      return
    }
    
    if (n1 && n1.type !== n2.type) {
      // 类型不同，卸载旧节点
      this.unmount(n1)
      n1 = null
    }
    
    if (n1 == null) {
      // 挂载新节点
      this.mount(n2, container)
    } else {
      // 更新节点
      this.update(n1, n2)
    }
  }
  
  // 挂载节点
  mount(vnode, container) {
    if (typeof vnode === 'string') {
      console.log('📝 挂载文本节点:', vnode)
    } else if (vnode && typeof vnode === 'object') {
      if (typeof vnode.type === 'string') {
        console.log('🏷️ 挂载元素节点:', vnode.type)
      } else {
        console.log('📦 挂载组件节点:', vnode.type.name)
        return this.mountComponent(vnode, container)
      }
    }
  }
  
  // 更新节点
  update(n1, n2) {
    console.log('🔄 更新节点:', n1, '->', n2)
  }
  
  // 卸载节点
  unmount(vnode) {
    console.log('🗑️ 卸载节点:', vnode)
  }
  
  // 卸载组件
  unmountComponent(instance) {
    console.log('🗑️ 开始卸载组件:', instance.type.name)
    
    // beforeUnmount钩子
    instance.invokeLifecycleHooks('bum')
    
    // 停止effects
    if (instance.scope) {
      instance.scope.stop()
    }
    
    // 卸载子树
    if (instance.subTree) {
      this.unmount(instance.subTree)
    }
    
    instance.isUnmounted = true
    
    // unmounted钩子
    instance.invokeLifecycleHooks('um')
    
    console.log('✅ 卸载完成:', instance.type.name)
  }
}

// ===== 5. 生命周期钩子API =====

let currentInstance = null

function getCurrentInstance() {
  return currentInstance
}

function setCurrentInstance(instance) {
  currentInstance = instance
}

// 生命周期钩子注册函数
function injectHook(type, hook) {
  if (currentInstance) {
    currentInstance.addLifecycleHook(type, hook)
  } else {
    console.warn(`生命周期钩子 ${type} 只能在setup函数中调用`)
  }
}

const onBeforeMount = (hook) => injectHook('bm', hook)
const onMounted = (hook) => injectHook('m', hook)
const onBeforeUpdate = (hook) => injectHook('bu', hook)
const onUpdated = (hook) => injectHook('u', hook)
const onBeforeUnmount = (hook) => injectHook('bum', hook)
const onUnmounted = (hook) => injectHook('um', hook)

// ===== 6. 演示组件定义 =====

// 计数器组件
const CounterComponent = {
  name: 'Counter',
  setup(props, { emit }) {
    console.log('🔧 Counter setup 开始')
    
    const count = ref(0)
    const doubleCount = ref(0)
    
    // 计算double count的effect
    const computedEffect = new ReactiveEffect(() => {
      doubleCount.value = count.value * 2
    })
    computedEffect.computed = true
    computedEffect.run()
    
    // 生命周期钩子
    onBeforeMount(() => {
      console.log('🎣 Counter beforeMount')
    })
    
    onMounted(() => {
      console.log('🎣 Counter mounted')
    })
    
    onBeforeUpdate(() => {
      console.log('🎣 Counter beforeUpdate')
    })
    
    onUpdated(() => {
      console.log('🎣 Counter updated')
    })
    
    const increment = () => {
      console.log('🖱️ 点击增加按钮')
      count.value++
      console.log(`📊 count: ${count.value}`)
    }
    
    const decrement = () => {
      console.log('🖱️ 点击减少按钮')
      count.value--
      console.log(`📊 count: ${count.value}`)
    }
    
    console.log('✅ Counter setup 完成')
    
    return {
      count,
      doubleCount,
      increment,
      decrement
    }
  },
  
  render() {
    return {
      type: 'div',
      children: [
        `Count: ${this.count}`,
        `Double: ${this.doubleCount}`,
        { type: 'button', onClick: this.increment, children: '+' },
        { type: 'button', onClick: this.decrement, children: '-' }
      ]
    }
  }
}

// 父组件
const ParentComponent = {
  name: 'Parent',
  setup() {
    console.log('🔧 Parent setup 开始')
    
    const showCounter = ref(true)
    
    onMounted(() => {
      console.log('🎣 Parent mounted')
    })
    
    const toggleCounter = () => {
      showCounter.value = !showCounter.value
      console.log(`👀 showCounter: ${showCounter.value}`)
    }
    
    console.log('✅ Parent setup 完成')
    
    return {
      showCounter,
      toggleCounter
    }
  },
  
  render() {
    return {
      type: 'div',
      children: [
        { type: 'button', onClick: this.toggleCounter, children: 'Toggle Counter' },
        this.showCounter ? { type: CounterComponent } : 'Counter is hidden'
      ]
    }
  }
}

// ===== 7. 性能监控工具 =====

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      mountTime: 0,
      updateTime: 0,
      renderCount: 0,
      effectCount: 0
    }
  }
  
  startMeasure(name) {
    this.metrics[`${name}Start`] = performance.now()
  }
  
  endMeasure(name) {
    const start = this.metrics[`${name}Start`]
    if (start) {
      const duration = performance.now() - start
      this.metrics[`${name}Time`] = duration
      console.log(`⏱️ ${name} 耗时: ${duration.toFixed(2)}ms`)
      return duration
    }
  }
  
  incrementCounter(name) {
    this.metrics[name] = (this.metrics[name] || 0) + 1
  }
  
  getReport() {
    return { ...this.metrics }
  }
  
  reset() {
    this.metrics = {
      mountTime: 0,
      updateTime: 0,
      renderCount: 0,
      effectCount: 0
    }
  }
}

// ===== 8. 批量更新演示 =====

function demoBatchUpdates() {
  console.log('\n📦 批量更新演示')
  
  const count1 = ref(0)
  const count2 = ref(0)
  const count3 = ref(0)
  
  // 监听所有变化
  const effect1 = new ReactiveEffect(() => {
    console.log(`Effect1 执行: count1=${count1.value}`)
  })
  
  const effect2 = new ReactiveEffect(() => {
    console.log(`Effect2 执行: count2=${count2.value}`)
  })
  
  const effect3 = new ReactiveEffect(() => {
    console.log(`Effect3 执行: count1=${count1.value}, count2=${count2.value}, count3=${count3.value}`)
  })
  
  // 初始化
  effect1.run()
  effect2.run()
  effect3.run()
  
  console.log('\n🔄 同步批量更新:')
  count1.value = 10
  count2.value = 20
  count3.value = 30
  
  console.log('\n⏭️ 等待下一个tick...')
  scheduler.nextTick(() => {
    console.log('✅ NextTick 回调执行')
  })
}

// ===== 9. 主要演示函数 =====

function runMountUpdateDemo() {
  console.log('=== Vue3挂载与更新机制演示 ===\n')
  
  const renderer = new ComponentRenderer()
  const monitor = new PerformanceMonitor()
  
  // 创建虚拟容器
  const container = { name: 'root-container' }
  
  console.log('1. 组件挂载演示')
  console.log('==================')
  
  // 挂载父组件
  monitor.startMeasure('mount')
  setCurrentInstance(null) // 重置当前实例
  
  const parentVNode = {
    type: ParentComponent,
    props: {}
  }
  
  const parentInstance = renderer.mountComponent(parentVNode, container)
  monitor.endMeasure('mount')
  
  console.log('\n2. 响应式更新演示')
  console.log('==================')
  
  // 模拟用户交互触发更新
  setTimeout(() => {
    console.log('\n🖱️ 模拟用户点击 Toggle 按钮')
    parentInstance.setupState.toggleCounter()
  }, 100)
  
  setTimeout(() => {
    console.log('\n🖱️ 模拟用户再次点击 Toggle 按钮')
    parentInstance.setupState.toggleCounter()
  }, 200)
  
  // 批量更新演示
  setTimeout(() => {
    demoBatchUpdates()
  }, 300)
  
  // 性能报告
  setTimeout(() => {
    console.log('\n📊 性能报告')
    console.log('==================')
    console.log(monitor.getReport())
  }, 500)
  
  // 调度系统状态
  setTimeout(() => {
    console.log('\n🕐 调度系统状态')
    console.log('==================')
    console.log('队列长度:', scheduler.queue.length)
    console.log('是否正在刷新:', scheduler.isFlushing)
    console.log('是否有待处理刷新:', scheduler.isFlushPending)
  }, 600)
}

// ===== 10. nextTick演示 =====

function demoNextTick() {
  console.log('\n⏭️ NextTick 演示')
  console.log('==================')
  
  const state = ref('initial')
  
  // 创建一个effect来监听状态变化
  const effect = new ReactiveEffect(() => {
    console.log('📊 Effect执行，state =', state.value)
  }, () => {
    console.log('📅 Effect被调度到下一个tick')
    scheduler.queueJob(() => {
      effect.run()
    })
  })
  
  // 初始执行
  effect.run()
  
  console.log('🔄 开始连续更新状态...')
  state.value = 'update1'
  console.log('📝 设置 state = update1')
  
  state.value = 'update2'
  console.log('📝 设置 state = update2')
  
  state.value = 'update3'
  console.log('📝 设置 state = update3')
  
  console.log('⏳ 等待nextTick...')
  
  scheduler.nextTick(() => {
    console.log('✅ nextTick回调执行，最终 state =', state.value)
  })
}

// ===== 11. 错误处理演示 =====

function demoErrorHandling() {
  console.log('\n❌ 错误处理演示')
  console.log('==================')
  
  const ErrorComponent = {
    name: 'ErrorComponent',
    setup() {
      onMounted(() => {
        throw new Error('故意抛出的错误用于演示')
      })
      
      return {}
    },
    render() {
      return 'Error Component Content'
    }
  }
  
  const ErrorBoundary = {
    name: 'ErrorBoundary',
    setup() {
      const hasError = ref(false)
      const errorMessage = ref('')
      
      // 错误捕获钩子
      const onErrorCaptured = (error, instance, info) => {
        console.log('🛡️ ErrorBoundary 捕获错误:', error.message)
        console.log('📍 错误位置:', info)
        hasError.value = true
        errorMessage.value = error.message
        return false // 阻止错误向上传播
      }
      
      // 模拟注册错误捕获
      if (currentInstance) {
        currentInstance.errorCapturedHooks.push(onErrorCaptured)
      }
      
      return {
        hasError,
        errorMessage
      }
    },
    render() {
      if (this.hasError) {
        return `Error: ${this.errorMessage}`
      }
      return { type: ErrorComponent }
    }
  }
  
  const renderer = new ComponentRenderer()
  const container = { name: 'error-container' }
  
  try {
    const errorBoundaryVNode = {
      type: ErrorBoundary,
      props: {}
    }
    renderer.mountComponent(errorBoundaryVNode, container)
  } catch (error) {
    console.log('🚨 全局错误处理:', error.message)
  }
}

// 导出主要函数
if (typeof module !== 'undefined') {
  module.exports = {
    ComponentInstance,
    ReactiveEffect,
    Scheduler,
    ComponentRenderer,
    ref,
    onBeforeMount,
    onMounted,
    onBeforeUpdate,
    onUpdated,
    onBeforeUnmount,
    onUnmounted,
    runMountUpdateDemo,
    demoNextTick,
    demoErrorHandling
  }
}

// 浏览器环境自动运行
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    runMountUpdateDemo()
    
    // 延迟运行其他演示
    setTimeout(() => demoNextTick(), 1000)
    setTimeout(() => demoErrorHandling(), 1500)
  })
} 