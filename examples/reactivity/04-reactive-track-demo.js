/**
 * Vue3 reactive函数和track触发时机演示
 * 展示依赖收集和触发的完整过程
 */

// ===== 1. 全局状态管理 =====

const effectStack = []
let activeEffect = null
const targetMap = new WeakMap()

// ===== 2. ReactiveEffect类实现 =====

class ReactiveEffect {
  constructor(fn, scheduler = null) {
    this.fn = fn
    this.scheduler = scheduler
    this.deps = []
    this.active = true
  }
  
  run() {
    if (!this.active) {
      return this.fn()
    }
    
    console.log('🔄 Effect开始执行')
    
    // 清理之前的依赖
    cleanupEffect(this)
    
    try {
      // 设置当前活跃effect
      effectStack.push(this)
      activeEffect = this
      console.log(`📌 设置activeEffect: ${this.fn.name || 'anonymous'}`)
      
      // 执行副作用函数，期间会触发依赖收集
      const result = this.fn()
      console.log('✅ Effect执行完成')
      return result
    } finally {
      // 恢复之前的activeEffect
      effectStack.pop()
      activeEffect = effectStack[effectStack.length - 1] || null
      console.log(`🔙 恢复activeEffect: ${activeEffect ? activeEffect.fn.name || 'anonymous' : 'null'}`)
    }
  }
  
  stop() {
    if (this.active) {
      cleanupEffect(this)
      this.active = false
    }
  }
}

// ===== 3. 工具函数 =====

function cleanupEffect(effect) {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

function hasOwn(target, key) {
  return Object.prototype.hasOwnProperty.call(target, key)
}

// ===== 4. effect工厂函数 =====

function effect(fn, options = {}) {
  const _effect = new ReactiveEffect(fn, options.scheduler)
  
  // 立即执行一次，建立依赖关系
  _effect.run()
  
  // 返回runner函数
  const runner = _effect.run.bind(_effect)
  runner.effect = _effect
  return runner
}

// ===== 5. track函数 - 依赖收集 =====

function track(target, type, key) {
  console.log(`🎯 track被调用: ${type} ${String(key)}`)
  
  // 如果没有正在执行的effect，不收集依赖
  if (!activeEffect) {
    console.log('❌ 没有activeEffect，跳过依赖收集')
    return
  }
  
  console.log(`✨ 开始收集依赖: ${activeEffect.fn.name || 'anonymous'} -> ${String(key)}`)
  
  // 获取target对应的依赖映射表
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
    console.log('📝 创建新的depsMap')
  }
  
  // 获取key对应的依赖集合
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
    console.log(`📝 创建新的dep for key: ${String(key)}`)
  }
  
  // 建立双向依赖关系
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
    console.log(`🔗 建立依赖关系: ${String(key)} <-> ${activeEffect.fn.name || 'anonymous'}`)
  } else {
    console.log(`⚠️  依赖关系已存在: ${String(key)} <-> ${activeEffect.fn.name || 'anonymous'}`)
  }
}

// ===== 6. trigger函数 - 依赖触发 =====

function trigger(target, type, key, newValue, oldValue) {
  console.log(`🚀 trigger被调用: ${type} ${String(key)} (${oldValue} -> ${newValue})`)
  
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    console.log('❌ 没有找到depsMap，无需触发')
    return
  }
  
  const effects = new Set()
  
  // 收集需要触发的effect
  if (key !== void 0) {
    const dep = depsMap.get(key)
    if (dep) {
      console.log(`📋 找到${dep.size}个依赖effect`)
      dep.forEach(effect => {
        if (effect !== activeEffect) {
          effects.add(effect)
          console.log(`➕ 添加effect到执行队列: ${effect.fn.name || 'anonymous'}`)
        } else {
          console.log(`⚠️  跳过当前正在执行的effect: ${effect.fn.name || 'anonymous'}`)
        }
      })
    } else {
      console.log(`❌ 没有找到key ${String(key)}的依赖`)
    }
  }
  
  // 执行所有收集到的effect
  console.log(`🔥 开始执行${effects.size}个effect`)
  effects.forEach(effect => {
    if (effect.scheduler) {
      console.log(`📅 使用调度器执行effect: ${effect.fn.name || 'anonymous'}`)
      effect.scheduler(effect)
    } else {
      console.log(`▶️  直接执行effect: ${effect.fn.name || 'anonymous'}`)
      effect.run()
    }
  })
}

// ===== 7. reactive函数实现 =====

function reactive(target) {
  if (typeof target !== 'object' || target === null) {
    console.log('⚠️  非对象类型，直接返回')
    return target
  }
  
  console.log('🎭 创建响应式代理对象')
  
  return new Proxy(target, {
    get(target, key, receiver) {
      console.log(`👀 访问属性: ${String(key)}`)
      
      // 获取属性值
      const result = Reflect.get(target, key, receiver)
      
      // 依赖收集：在这里调用track
      track(target, 'get', key)
      
      // 如果值是对象，递归代理（惰性）
      if (typeof result === 'object' && result !== null) {
        console.log(`🔄 递归代理嵌套对象: ${String(key)}`)
        return reactive(result)
      }
      
      console.log(`📤 返回属性值: ${String(key)} = ${result}`)
      return result
    },
    
    set(target, key, value, receiver) {
      console.log(`✏️  设置属性: ${String(key)} = ${value}`)
      
      // 获取旧值
      const oldValue = target[key]
      
      // 设置新值
      const result = Reflect.set(target, key, value, receiver)
      
      // 依赖触发：在这里调用trigger
      if (oldValue !== value) {
        trigger(target, 'set', key, value, oldValue)
      } else {
        console.log('⚠️  值没有变化，跳过触发')
      }
      
      return result
    },
    
    deleteProperty(target, key) {
      console.log(`🗑️  删除属性: ${String(key)}`)
      
      const hadKey = hasOwn(target, key)
      const oldValue = target[key]
      const result = Reflect.deleteProperty(target, key)
      
      if (result && hadKey) {
        trigger(target, 'delete', key, undefined, oldValue)
      }
      
      return result
    }
  })
}

// ===== 8. 演示函数 =====

function demonstrateReactiveAndTrack() {
  console.log('='.repeat(60))
  console.log('🎬 Vue3 Reactive和Track机制演示')
  console.log('='.repeat(60))
  
  // 演示1: 创建响应式对象
  console.log('\n📋 演示1: 创建响应式对象')
  console.log('-'.repeat(40))
  
  const state = reactive({ 
    count: 0, 
    name: 'Vue3',
    nested: { value: 42 }
  })
  
  // 演示2: 直接访问属性（无effect）
  console.log('\n📋 演示2: 直接访问属性（无activeEffect）')
  console.log('-'.repeat(40))
  
  console.log('访问 state.count:')
  const directValue = state.count
  console.log(`直接访问结果: ${directValue}`)
  
  // 演示3: 在effect中访问属性
  console.log('\n📋 演示3: 在effect中访问属性（会收集依赖）')
  console.log('-'.repeat(40))
  
  const effect1 = effect(function countEffect() {
    console.log(`Count Effect: ${state.count}`)
  })
  
  // 演示4: 创建多个effect
  console.log('\n📋 演示4: 创建多个effect')
  console.log('-'.repeat(40))
  
  const effect2 = effect(function nameEffect() {
    console.log(`Name Effect: ${state.name}`)
  })
  
  const effect3 = effect(function combinedEffect() {
    console.log(`Combined Effect: ${state.name} - ${state.count}`)
  })
  
  // 演示5: 修改属性触发effect
  console.log('\n📋 演示5: 修改属性触发effect')
  console.log('-'.repeat(40))
  
  console.log('修改 state.count = 1:')
  state.count = 1
  
  console.log('\n修改 state.name = "Vue3.0":')
  state.name = 'Vue3.0'
  
  // 演示6: 嵌套对象的响应式
  console.log('\n📋 演示6: 嵌套对象的响应式')
  console.log('-'.repeat(40))
  
  const effect4 = effect(function nestedEffect() {
    console.log(`Nested Effect: ${state.nested.value}`)
  })
  
  console.log('修改 state.nested.value = 100:')
  state.nested.value = 100
  
  // 演示7: 嵌套effect
  console.log('\n📋 演示7: 嵌套effect的处理')
  console.log('-'.repeat(40))
  
  effect(function outerEffect() {
    console.log('外层Effect开始')
    
    effect(function innerEffect() {
      console.log(`内层Effect: ${state.count}`)
    })
    
    console.log('外层Effect结束')
  })
  
  console.log('修改count触发嵌套effect:')
  state.count = 2
  
  // 演示8: 依赖关系查看
  console.log('\n📋 演示8: 查看当前依赖关系')
  console.log('-'.repeat(40))
  
  console.log('当前targetMap结构:')
  const depsMap = targetMap.get(state)
  if (depsMap) {
    depsMap.forEach((dep, key) => {
      console.log(`  ${String(key)}: ${dep.size}个依赖effect`)
    })
  }
}

// ===== 9. 运行演示 =====

if (typeof module !== 'undefined') {
  module.exports = {
    reactive,
    effect,
    track,
    trigger,
    ReactiveEffect,
    demonstrateReactiveAndTrack
  }
}

// 浏览器环境或直接运行
if (typeof window !== 'undefined' || require.main === module) {
  demonstrateReactiveAndTrack()
} 