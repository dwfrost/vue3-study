/**
 * 第10章：组件基础架构 - 完整演示
 * 
 * 本文件演示Vue3组件系统的核心概念：
 * 1. 组件实例的创建和管理
 * 2. 生命周期系统的实现
 * 3. 组件通信机制
 * 4. 组件渲染和更新机制
 */

console.log('🚀 Vue3组件基础架构演示开始')

// ===== 1. 组件实例基础结构 =====

/**
 * 模拟Vue3组件实例
 */
class ComponentInstance {
  constructor(type, parent = null) {
    this.uid = ComponentInstance.uid++
    this.type = type
    this.parent = parent
    this.root = parent ? parent.root : this
    
    // 状态数据
    this.data = {}
    this.props = {}
    this.attrs = {}
    this.slots = {}
    
    // 生命周期状态
    this.isMounted = false
    this.isUnmounted = false
    
    // 渲染相关
    this.subTree = null
    this.update = null
    
    // 生命周期钩子
    this.lifecycleHooks = {}
    
    // 组件通信
    this.emit = this.createEmitFunction()
    
    console.log(`🔧 组件实例创建: ${this.type.name} (uid: ${this.uid})`)
  }
  
  static uid = 0
  
  createEmitFunction() {
    return (event, ...args) => {
      console.log(`📡 发射事件: ${event}`, args)
      const handler = this.props[`on${event.charAt(0).toUpperCase() + event.slice(1)}`]
      if (handler && typeof handler === 'function') {
        handler(...args)
      }
    }
  }
  
  registerLifecycleHook(type, hook) {
    if (!this.lifecycleHooks[type]) {
      this.lifecycleHooks[type] = []
    }
    this.lifecycleHooks[type].push(hook)
    console.log(`🎣 注册生命周期钩子: ${type}`)
  }
  
  invokeLifecycleHooks(type, ...args) {
    const hooks = this.lifecycleHooks[type]
    if (hooks && hooks.length > 0) {
      console.log(`🚀 执行生命周期钩子: ${type}`)
      hooks.forEach(hook => hook.call(this, ...args))
    }
  }
}

/**
 * 组件定义
 */
class ComponentDefinition {
  constructor(options) {
    this.name = options.name || 'AnonymousComponent'
    this.props = options.props || {}
    this.data = options.data || (() => ({}))
    this.methods = options.methods || {}
    this.render = options.render || null
    
    // 生命周期钩子
    this.beforeCreate = options.beforeCreate
    this.created = options.created
    this.beforeMount = options.beforeMount
    this.mounted = options.mounted
    this.beforeUpdate = options.beforeUpdate
    this.updated = options.updated
    this.beforeUnmount = options.beforeUnmount
    this.unmounted = options.unmounted
  }
}

// ===== 2. 组件管理器 =====

class ComponentManager {
  constructor() {
    this.instances = new Map()
  }
  
  createInstance(componentDef, props = {}, parent = null) {
    const instance = new ComponentInstance(componentDef, parent)
    
    // 设置props
    instance.props = props
    
    // 设置数据
    if (typeof componentDef.data === 'function') {
      instance.data = componentDef.data.call(instance)
    }
    
    // 设置方法
    for (const key in componentDef.methods) {
      instance[key] = componentDef.methods[key].bind(instance)
    }
    
    // 注册生命周期钩子
    const hooks = ['beforeCreate', 'created', 'beforeMount', 'mounted', 'beforeUpdate', 'updated', 'beforeUnmount', 'unmounted']
    hooks.forEach(hookName => {
      if (componentDef[hookName]) {
        instance.registerLifecycleHook(hookName, componentDef[hookName])
      }
    })
    
    this.instances.set(instance.uid, instance)
    return instance
  }
  
  mountComponent(instance, container) {
    console.log(`🎬 开始挂载组件: ${instance.type.name}`)
    
    // beforeMount
    instance.invokeLifecycleHooks('beforeMount')
    
    // 创建更新函数
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        console.log(`🎨 首次渲染: ${instance.type.name}`)
        
        // 执行渲染
        const result = this.renderComponent(instance)
        instance.subTree = result
        
        instance.isMounted = true
        
        // mounted
        instance.invokeLifecycleHooks('mounted')
      } else {
        this.updateComponent(instance)
      }
    }
    
    instance.update = componentUpdateFn
    componentUpdateFn()
    
    return instance
  }
  
  renderComponent(instance) {
    console.log(`🎨 渲染组件: ${instance.type.name}`)
    
    // 创建渲染上下文
    const renderContext = this.createRenderContext(instance)
    
    if (instance.type.render) {
      return instance.type.render.call(renderContext, renderContext)
    } else {
      return { text: `Component: ${instance.type.name}` }
    }
  }
  
  createRenderContext(instance) {
    return new Proxy(instance, {
      get(target, key) {
        if (key in target.props) {
          return target.props[key]
        } else if (key in target.data) {
          return target.data[key]
        } else if (typeof target[key] === 'function') {
          return target[key]
        } else {
          return target[key]
        }
      },
      
      set(target, key, value) {
        if (key in target.data) {
          target.data[key] = value
          if (target.update) {
            console.log(`🔄 数据变化触发更新: ${key} = ${value}`)
            setTimeout(target.update, 0)
          }
          return true
        }
        target[key] = value
        return true
      }
    })
  }
  
  updateComponent(instance) {
    console.log(`🔄 更新组件: ${instance.type.name}`)
    
    instance.invokeLifecycleHooks('beforeUpdate')
    
    const newSubTree = this.renderComponent(instance)
    instance.subTree = newSubTree
    
    instance.invokeLifecycleHooks('updated')
  }
  
  unmountComponent(instance) {
    console.log(`🗑️ 卸载组件: ${instance.type.name}`)
    
    instance.invokeLifecycleHooks('beforeUnmount')
    
    instance.subTree = null
    instance.update = null
    instance.isUnmounted = true
    
    instance.invokeLifecycleHooks('unmounted')
    
    this.instances.delete(instance.uid)
  }
}

// ===== 3. 演示组件定义 =====

// 基础组件
const BasicComponent = new ComponentDefinition({
  name: 'BasicComponent',
  data() {
    return {
      message: 'Hello Vue3',
      count: 0
    }
  },
  methods: {
    increment() {
      this.count++
    }
  },
  render(ctx) {
    return {
      text: `${ctx.message} - Count: ${ctx.count}`
    }
  }
})

// 生命周期组件
const LifecycleComponent = new ComponentDefinition({
  name: 'LifecycleComponent',
  data() {
    return {
      message: 'Lifecycle Demo',
      updateCount: 0
    }
  },
  beforeCreate() {
    console.log('🎬 beforeCreate: 组件实例刚创建')
  },
  created() {
    console.log('🎭 created: 组件实例创建完成')
  },
  beforeMount() {
    console.log('🎪 beforeMount: 组件挂载前')
  },
  mounted() {
    console.log('🎨 mounted: 组件挂载完成')
    setTimeout(() => {
      this.message = 'Updated by timer'
    }, 2000)
  },
  beforeUpdate() {
    console.log('🔄 beforeUpdate: 组件更新前')
    this.updateCount++
  },
  updated() {
    console.log('✅ updated: 组件更新完成')
  },
  beforeUnmount() {
    console.log('🚪 beforeUnmount: 组件卸载前')
  },
  unmounted() {
    console.log('👋 unmounted: 组件卸载完成')
  },
  render(ctx) {
    return {
      text: `${ctx.message} (更新${ctx.updateCount}次)`
    }
  }
})

// 父组件
const ParentComponent = new ComponentDefinition({
  name: 'ParentComponent',
  data() {
    return {
      parentMessage: 'From Parent',
      childCount: 0
    }
  },
  methods: {
    onChildUpdate(count) {
      console.log(`父组件接收到子组件事件: ${count}`)
      this.childCount = count
    }
  },
  render(ctx) {
    return {
      text: `Parent: ${ctx.parentMessage}, Child Count: ${ctx.childCount}`
    }
  }
})

// 子组件
const ChildComponent = new ComponentDefinition({
  name: 'ChildComponent',
  props: {
    message: String,
    count: Number
  },
  data() {
    return {
      localCount: 0
    }
  },
  methods: {
    handleClick() {
      this.localCount++
      this.emit('update', this.localCount)
    }
  },
  render(ctx) {
    return {
      text: `Child: ${ctx.message}, Local: ${ctx.localCount}, Prop: ${ctx.count}`
    }
  }
})

// ===== 4. 运行演示 =====

function runDemo() {
  console.log('\n📌 1. 基础组件演示')
  const manager = new ComponentManager()
  
  // 创建基础组件实例
  const basicInstance = manager.createInstance(BasicComponent)
  manager.mountComponent(basicInstance)
  
  // 触发更新
  setTimeout(() => {
    basicInstance.increment()
  }, 1000)
  
  console.log('\n📌 2. 生命周期演示')
  const lifecycleInstance = manager.createInstance(LifecycleComponent)
  manager.mountComponent(lifecycleInstance)
  
  console.log('\n📌 3. 父子组件通信演示')
  const parentInstance = manager.createInstance(ParentComponent)
  const childInstance = manager.createInstance(ChildComponent, {
    message: parentInstance.data.parentMessage,
    count: parentInstance.data.childCount,
    onUpdate: parentInstance.onChildUpdate.bind(parentInstance)
  }, parentInstance)
  
  manager.mountComponent(parentInstance)
  manager.mountComponent(childInstance)
  
  // 触发子组件事件
  setTimeout(() => {
    childInstance.handleClick()
  }, 1500)
  
  console.log('\n📌 4. 组件卸载演示')
  setTimeout(() => {
    manager.unmountComponent(lifecycleInstance)
  }, 4000)
  
  console.log('\n✅ 组件架构演示完成!')
  
  return { manager, basicInstance, lifecycleInstance, parentInstance, childInstance }
}

// 运行演示
const demo = runDemo()

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ComponentInstance,
    ComponentDefinition,
    ComponentManager,
    runDemo
  }
} 