/**
 * Vue3原理学习系列 - 第4章：响应式核心实现
 * 
 * 本文件包含了Vue3响应式系统核心实现的完整演示代码
 * 涵盖了reactive、ref、computed、effect等核心API的实现原理
 * 
 * 运行方式：
 * 1. 在浏览器中打开HTML文件引入此脚本
 * 2. 在Node.js中直接运行：node 05-reactivity-core-demo.js
 */

console.log('=== Vue3原理学习 - 响应式核心实现演示 ===\n')

// ================================
// 1. 完整的响应式系统实现
// ================================

console.log('1. 完整的响应式系统实现')
console.log('------------------------')

class VueReactivity {
  constructor() {
    // 全局依赖映射：WeakMap<target, Map<key, Set<ReactiveEffect>>>
    this.targetMap = new WeakMap()
    
    // 当前活跃的副作用
    this.activeEffect = null
    
    // 副作用栈，处理嵌套effect
    this.effectStack = []
    
    // 是否应该收集依赖
    this.shouldTrack = true
    
    // 响应式对象缓存
    this.reactiveMap = new WeakMap()
    this.readonlyMap = new WeakMap()
    
    // 操作类型枚举
    this.TrackOpTypes = {
      GET: 'get',
      HAS: 'has',
      ITERATE: 'iterate'
    }
    
    this.TriggerOpTypes = {
      SET: 'set',
      ADD: 'add',
      DELETE: 'delete',
      CLEAR: 'clear'
    }
    
    // 响应式标记
    this.ReactiveFlags = {
      IS_REACTIVE: '__v_isReactive',
      IS_READONLY: '__v_isReadonly',
      RAW: '__v_raw'
    }
  }
  
  // ================================
  // 依赖收集和触发系统
  // ================================
  
  track(target, type, key) {
    if (!this.shouldTrack || !this.activeEffect) {
      return
    }
    
    console.log(`  📊 收集依赖: ${type} ${key}`)
    
    // 获取target对应的依赖映射
    let depsMap = this.targetMap.get(target)
    if (!depsMap) {
      this.targetMap.set(target, (depsMap = new Map()))
    }
    
    // 获取key对应的依赖集合
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = new Set()))
    }
    
    // 收集依赖
    if (!dep.has(this.activeEffect)) {
      dep.add(this.activeEffect)
      this.activeEffect.deps.push(dep)
    }
  }
  
  trigger(target, type, key, newValue, oldValue) {
    console.log(`  🚀 触发更新: ${type} ${key}`)
    
    const depsMap = this.targetMap.get(target)
    if (!depsMap) {
      return
    }
    
    const effects = new Set()
    
    // 收集需要触发的effect
    if (key !== void 0) {
      const dep = depsMap.get(key)
      if (dep) {
        dep.forEach(effect => effects.add(effect))
      }
    }
    
    // 如果是数组长度变化，触发相关索引的effect
    if (type === this.TriggerOpTypes.ADD && Array.isArray(target)) {
      const lengthDep = depsMap.get('length')
      if (lengthDep) {
        lengthDep.forEach(effect => effects.add(effect))
      }
    }
    
    // 触发所有相关的effect
    this.triggerEffects(effects)
  }
  
  triggerEffects(effects) {
    const effectsArray = [...effects]
    
    // 先触发computed的effect
    for (const effect of effectsArray) {
      if (effect.computed) {
        this.triggerEffect(effect)
      }
    }
    
    // 再触发普通的effect
    for (const effect of effectsArray) {
      if (!effect.computed) {
        this.triggerEffect(effect)
      }
    }
  }
  
  triggerEffect(effect) {
    if (effect !== this.activeEffect || effect.allowRecurse) {
      if (effect.scheduler) {
        effect.scheduler()
      } else {
        effect.run()
      }
    }
  }
  
  // ================================
  // ReactiveEffect类实现
  // ================================
  
  createReactiveEffect(fn, options = {}) {
    const effect = {
      fn,
      active: true,
      deps: [],
      computed: options.computed || false,
      scheduler: options.scheduler,
      allowRecurse: options.allowRecurse || false,
      
      run: () => {
        if (!effect.active) {
          return effect.fn()
        }
        
        if (this.effectStack.includes(effect)) {
          return
        }
        
        try {
          this.effectStack.push(effect)
          this.activeEffect = effect
          this.shouldTrack = true
          
          // 清理之前的依赖
          this.cleanupEffect(effect)
          
          return effect.fn()
        } finally {
          this.effectStack.pop()
          this.activeEffect = this.effectStack[this.effectStack.length - 1]
        }
      },
      
      stop: () => {
        if (effect.active) {
          this.cleanupEffect(effect)
          effect.active = false
        }
      }
    }
    
    return effect
  }
  
  cleanupEffect(effect) {
    const { deps } = effect
    if (deps.length) {
      for (let i = 0; i < deps.length; i++) {
        deps[i].delete(effect)
      }
      deps.length = 0
    }
  }
  
  // ================================
  // reactive API实现
  // ================================
  
  reactive(target) {
    if (this.isReadonly(target)) {
      return target
    }
    return this.createReactiveObject(target, false, this.reactiveMap)
  }
  
  readonly(target) {
    return this.createReactiveObject(target, true, this.readonlyMap)
  }
  
  createReactiveObject(target, isReadonly, proxyMap) {
    if (!this.isObject(target)) {
      return target
    }
    
    // 检查缓存
    const existingProxy = proxyMap.get(target)
    if (existingProxy) {
      return existingProxy
    }
    
    // 创建代理
    const proxy = new Proxy(target, this.createHandlers(isReadonly))
    proxyMap.set(target, proxy)
    return proxy
  }
  
  createHandlers(isReadonly) {
    return {
      get: (target, key, receiver) => {
        // 处理特殊标记
        if (key === this.ReactiveFlags.IS_REACTIVE) {
          return !isReadonly
        } else if (key === this.ReactiveFlags.IS_READONLY) {
          return isReadonly
        } else if (key === this.ReactiveFlags.RAW) {
          return target
        }
        
        const result = Reflect.get(target, key, receiver)
        
        // 依赖收集
        if (!isReadonly) {
          this.track(target, this.TrackOpTypes.GET, key)
        }
        
        // 如果是对象，递归创建响应式
        if (this.isObject(result)) {
          return isReadonly ? this.readonly(result) : this.reactive(result)
        }
        
        return result
      },
      
      set: (target, key, value, receiver) => {
        if (isReadonly) {
          console.warn(`Set operation on key "${key}" failed: target is readonly.`)
          return false
        }
        
        const oldValue = target[key]
        const hadKey = Array.isArray(target) && this.isIntegerKey(key) 
          ? Number(key) < target.length 
          : Object.prototype.hasOwnProperty.call(target, key)
        
        const result = Reflect.set(target, key, value, receiver)
        
        // 触发更新
        if (target === this.toRaw(receiver)) {
          if (!hadKey) {
            this.trigger(target, this.TriggerOpTypes.ADD, key, value)
          } else if (this.hasChanged(value, oldValue)) {
            this.trigger(target, this.TriggerOpTypes.SET, key, value, oldValue)
          }
        }
        
        return result
      },
      
      deleteProperty: (target, key) => {
        if (isReadonly) {
          console.warn(`Delete operation on key "${key}" failed: target is readonly.`)
          return false
        }
        
        const hadKey = Object.prototype.hasOwnProperty.call(target, key)
        const oldValue = target[key]
        const result = Reflect.deleteProperty(target, key)
        
        if (result && hadKey) {
          this.trigger(target, this.TriggerOpTypes.DELETE, key, undefined, oldValue)
        }
        
        return result
      },
      
      has: (target, key) => {
        const result = Reflect.has(target, key)
        if (!isReadonly) {
          this.track(target, this.TrackOpTypes.HAS, key)
        }
        return result
      },
      
      ownKeys: (target) => {
        this.track(target, this.TrackOpTypes.ITERATE, Array.isArray(target) ? 'length' : 'iterate')
        return Reflect.ownKeys(target)
      }
    }
  }
  
  // ================================
  // ref API实现
  // ================================
  
  ref(value) {
    return this.createRef(value, false)
  }
  
  shallowRef(value) {
    return this.createRef(value, true)
  }
  
  createRef(rawValue, shallow) {
    if (this.isRef(rawValue)) {
      return rawValue
    }
    return new RefImpl(this, rawValue, shallow)
  }
  
  // ================================
  // computed API实现
  // ================================
  
  computed(getterOrOptions) {
    let getter
    let setter
    
    if (typeof getterOrOptions === 'function') {
      getter = getterOrOptions
      setter = () => {
        console.warn('Write operation failed: computed value is readonly')
      }
    } else {
      getter = getterOrOptions.get
      setter = getterOrOptions.set
    }
    
    return new ComputedRefImpl(this, getter, setter)
  }
  
  // ================================
  // effect API实现
  // ================================
  
  effect(fn, options = {}) {
    const _effect = this.createReactiveEffect(fn, options)
    
    // 立即执行一次
    if (!options.lazy) {
      _effect.run()
    }
    
    // 返回runner函数
    const runner = _effect.run.bind(_effect)
    runner.effect = _effect
    return runner
  }
  
  // ================================
  // 工具函数
  // ================================
  
  isObject(val) {
    return val !== null && typeof val === 'object'
  }
  
  isRef(r) {
    return !!(r && r.__v_isRef === true)
  }
  
  isReactive(value) {
    if (this.isReadonly(value)) {
      return this.isReactive(value[this.ReactiveFlags.RAW])
    }
    return !!(value && value[this.ReactiveFlags.IS_REACTIVE])
  }
  
  isReadonly(value) {
    return !!(value && value[this.ReactiveFlags.IS_READONLY])
  }
  
  toRaw(observed) {
    const raw = observed && observed[this.ReactiveFlags.RAW]
    return raw ? this.toRaw(raw) : observed
  }
  
  hasChanged(value, oldValue) {
    return !Object.is(value, oldValue)
  }
  
  isIntegerKey(key) {
    return typeof key === 'string' && 
           key !== 'NaN' && 
           key[0] !== '-' && 
           '' + parseInt(key, 10) === key
  }
}

// ================================
// RefImpl类实现
// ================================

class RefImpl {
  constructor(reactivity, value, shallow) {
    this._reactivity = reactivity
    this._shallow = shallow
    this.dep = undefined
    this.__v_isRef = true
    
    this._value = shallow ? value : this.toReactive(value)
    this._rawValue = shallow ? value : reactivity.toRaw(value)
  }
  
  get value() {
    this.trackRefValue()
    return this._value
  }
  
  set value(newVal) {
    const useDirectValue = this._shallow || this._reactivity.isReadonly(newVal)
    newVal = useDirectValue ? newVal : this._reactivity.toRaw(newVal)
    
    if (this._reactivity.hasChanged(newVal, this._rawValue)) {
      this._rawValue = newVal
      this._value = useDirectValue ? newVal : this.toReactive(newVal)
      this.triggerRefValue()
    }
  }
  
  toReactive(value) {
    return this._reactivity.isObject(value) ? this._reactivity.reactive(value) : value
  }
  
  trackRefValue() {
    if (this._reactivity.shouldTrack && this._reactivity.activeEffect) {
      if (!this.dep) {
        this.dep = new Set()
      }
      if (!this.dep.has(this._reactivity.activeEffect)) {
        this.dep.add(this._reactivity.activeEffect)
        this._reactivity.activeEffect.deps.push(this.dep)
      }
    }
  }
  
  triggerRefValue() {
    if (this.dep) {
      this._reactivity.triggerEffects(this.dep)
    }
  }
}

// ================================
// ComputedRefImpl类实现
// ================================

class ComputedRefImpl {
  constructor(reactivity, getter, setter) {
    this._reactivity = reactivity
    this._setter = setter
    this.dep = undefined
    this.__v_isRef = true
    this._dirty = true
    
    // 创建effect
    this.effect = reactivity.createReactiveEffect(getter, {
      lazy: true,
      computed: true,
      scheduler: () => {
        if (!this._dirty) {
          this._dirty = true
          this.triggerRefValue()
        }
      }
    })
  }
  
  get value() {
    // 收集computed的依赖
    this.trackRefValue()
    
    // 如果是脏值，重新计算
    if (this._dirty) {
      this._dirty = false
      this._value = this.effect.run()
    }
    
    return this._value
  }
  
  set value(newValue) {
    this._setter(newValue)
  }
  
  trackRefValue() {
    if (this._reactivity.shouldTrack && this._reactivity.activeEffect) {
      if (!this.dep) {
        this.dep = new Set()
      }
      if (!this.dep.has(this._reactivity.activeEffect)) {
        this.dep.add(this._reactivity.activeEffect)
        this._reactivity.activeEffect.deps.push(this.dep)
      }
    }
  }
  
  triggerRefValue() {
    if (this.dep) {
      this._reactivity.triggerEffects(this.dep)
    }
  }
}

// ================================
// 2. 基础功能演示
// ================================

console.log('2. 基础功能演示')
console.log('-------------')

// 创建响应式系统实例
const reactivity = new VueReactivity()

// 测试reactive
console.log('测试 reactive:')
const state = reactivity.reactive({
  count: 0,
  nested: {
    value: 1
  },
  list: [1, 2, 3]
})

console.log('state.count:', state.count)
console.log('state.nested.value:', state.nested.value)
console.log()

// 测试ref
console.log('测试 ref:')
const count = reactivity.ref(0)
const message = reactivity.ref('Hello Vue3')

console.log('count.value:', count.value)
console.log('message.value:', message.value)
console.log()

// 测试computed
console.log('测试 computed:')
const doubleCount = reactivity.computed(() => {
  console.log('  💫 computed getter 执行')
  return count.value * 2
})

console.log('doubleCount.value:', doubleCount.value)
console.log('doubleCount.value (再次访问，应该使用缓存):', doubleCount.value)
console.log()

// ================================
// 3. effect系统演示
// ================================

console.log('3. effect系统演示')
console.log('----------------')

// 基础effect
console.log('基础 effect:')
const runner1 = reactivity.effect(() => {
  console.log(`  💫 Effect1: count = ${count.value}`)
})

const runner2 = reactivity.effect(() => {
  console.log(`  💫 Effect2: doubleCount = ${doubleCount.value}`)
})

// 修改数据触发effect
console.log('\n修改 count.value = 1:')
count.value = 1

console.log('\n修改 count.value = 2:')
count.value = 2

console.log()

// ================================
// 4. 嵌套effect演示
// ================================

console.log('4. 嵌套effect演示')
console.log('---------------')

const nestedState = reactivity.reactive({
  foo: 1,
  bar: 2
})

reactivity.effect(() => {
  console.log(`  💫 外层Effect: foo = ${nestedState.foo}`)
  
  reactivity.effect(() => {
    console.log(`    💫 内层Effect: bar = ${nestedState.bar}`)
  })
})

console.log('\n修改 nestedState.foo = 10:')
nestedState.foo = 10

console.log('\n修改 nestedState.bar = 20:')
nestedState.bar = 20

console.log()

// ================================
// 5. 调度器演示
// ================================

console.log('5. 调度器演示')
console.log('-----------')

const schedulerState = reactivity.reactive({ count: 0 })
const jobs = []

// 带调度器的effect
const schedulerRunner = reactivity.effect(() => {
  console.log(`  💫 调度器Effect: count = ${schedulerState.count}`)
}, {
  scheduler: () => {
    console.log(`  📅 任务加入调度队列`)
    jobs.push(schedulerRunner)
  }
})

// 修改数据，effect不会立即执行
console.log('\n修改 schedulerState.count = 1 (不会立即执行):')
schedulerState.count = 1

console.log('\n修改 schedulerState.count = 2 (不会立即执行):')
schedulerState.count = 2

// 手动执行调度队列
console.log('\n手动执行调度队列:')
jobs.forEach(job => job())

console.log()

// ================================
// 6. 数组响应式演示
// ================================

console.log('6. 数组响应式演示')
console.log('---------------')

const arr = reactivity.reactive([1, 2, 3])

reactivity.effect(() => {
  console.log(`  💫 数组Effect: length = ${arr.length}, 内容 = [${arr.join(', ')}]`)
})

console.log('\n添加元素 arr.push(4):')
arr.push(4)

console.log('\n修改元素 arr[0] = 10:')
arr[0] = 10

console.log('\n删除元素 arr.pop():')
arr.pop()

console.log()

// ================================
// 7. readonly演示
// ================================

console.log('7. readonly演示')
console.log('-------------')

const readonlyState = reactivity.readonly({
  name: 'Vue3',
  version: 3
})

console.log('readonlyState.name:', readonlyState.name)

console.log('\n尝试修改readonly对象:')
readonlyState.name = 'Vue4'  // 应该警告

console.log()

// ================================
// 8. 复杂场景演示
// ================================

console.log('8. 复杂场景演示')
console.log('-------------')

// 创建复杂的响应式数据
const complexState = reactivity.reactive({
  user: {
    name: 'Alice',
    age: 25,
    hobbies: ['reading', 'coding']
  },
  settings: {
    theme: 'dark',
    notifications: true
  }
})

const userInfo = reactivity.computed(() => {
  return `${complexState.user.name} (${complexState.user.age}岁)`
})

const hobbyCount = reactivity.computed(() => {
  return complexState.user.hobbies.length
})

// 监听用户信息变化
reactivity.effect(() => {
  console.log(`  💫 用户信息: ${userInfo.value}`)
})

// 监听爱好数量变化
reactivity.effect(() => {
  console.log(`  💫 爱好数量: ${hobbyCount.value}`)
})

console.log('\n修改用户名:')
complexState.user.name = 'Bob'

console.log('\n修改年龄:')
complexState.user.age = 30

console.log('\n添加爱好:')
complexState.user.hobbies.push('swimming')

console.log()

// ================================
// 9. 性能测试
// ================================

console.log('9. 性能测试')
console.log('---------')

const perfState = reactivity.reactive({ count: 0 })
let effectRunCount = 0

// 临时禁用日志输出
const originalLog = console.log
console.log = () => {}

reactivity.effect(() => {
  effectRunCount++
  perfState.count  // 访问数据
})

console.time('批量更新性能')
for (let i = 0; i < 1000; i++) {
  perfState.count = i
}
console.timeEnd('批量更新性能')

// 恢复日志输出
console.log = originalLog

console.log(`Effect执行次数: ${effectRunCount}`)
console.log()

// ================================
// 10. 内存管理演示
// ================================

console.log('10. 内存管理演示')
console.log('---------------')

const memoryState = reactivity.reactive({ value: 0 })

// 创建effect并立即停止
const runner = reactivity.effect(() => {
  console.log(`  💫 内存测试Effect: ${memoryState.value}`)
})

console.log('\n修改数据 (effect应该执行):')
memoryState.value = 1

console.log('\n停止effect:')
runner.effect.stop()

console.log('\n修改数据 (effect不应该执行):')
memoryState.value = 2

console.log()

// ================================
// 11. 边界情况测试
// ================================

console.log('11. 边界情况测试')
console.log('---------------')

// 测试循环引用
const obj1 = reactivity.reactive({ name: 'obj1' })
const obj2 = reactivity.reactive({ name: 'obj2' })

obj1.ref = obj2
obj2.ref = obj1

reactivity.effect(() => {
  console.log(`  💫 循环引用测试: ${obj1.name} -> ${obj1.ref.name}`)
})

console.log('\n修改obj1.name:')
obj1.name = 'obj1_modified'

// 测试相同值设置
console.log('\n测试相同值设置 (不应该触发effect):')
const sameValueState = reactivity.reactive({ count: 5 })

reactivity.effect(() => {
  console.log(`  💫 相同值测试: ${sameValueState.count}`)
})

console.log('\n设置相同值:')
sameValueState.count = 5  // 不应该触发effect

console.log('\n设置不同值:')
sameValueState.count = 6  // 应该触发effect

console.log()

// ================================
// 12. 总结
// ================================

console.log('=== 第4章学习总结 ===')
console.log('核心收获:')
console.log('1. 🎯 深入理解了Vue3响应式系统的完整架构')
console.log('2. 🔧 掌握了reactive、ref、computed的实现原理')
console.log('3. 📊 理解了依赖收集和触发机制的详细流程')
console.log('4. ⚡ 学会了effect系统的嵌套处理和调度优化')
console.log('5. 🛡️ 了解了边界情况处理和内存管理策略')
console.log('6. 📈 能够手写一个完整的响应式系统')

console.log('\n思考题:')
console.log('1. 为什么Vue3使用WeakMap作为targetMap的数据结构？')
console.log('2. computed和普通effect在触发顺序上有什么区别？为什么？')
console.log('3. 如何避免effect的无限递归执行？')

console.log('\n🎉 第4章演示完成！准备学习第5章：副作用系统深入')