/**
 * Vue3响应式系统设计哲学演示
 * 对比Vue2和Vue3的响应式实现差异
 */

// =============================================
// 1. Vue2响应式系统的局限性演示
// =============================================

console.log('=== Vue2响应式系统局限性演示 ===')

// 模拟Vue2的defineReactive实现
class Vue2Reactive {
  constructor() {
    this.targetMap = new WeakMap()
  }

  defineReactive(obj, key, val) {
    const dep = new Set() // 简化的依赖收集器
    
    Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: true,
      get() {
        console.log(`Vue2: 访问属性 ${key}`)
        // 这里应该进行依赖收集，但为了演示简化
        return val
      },
      set(newVal) {
        if (newVal === val) return
        console.log(`Vue2: 设置属性 ${key} = ${newVal}`)
        val = newVal
        // 触发更新
        dep.forEach(effect => effect())
      }
    })
  }

  observe(obj) {
    if (typeof obj !== 'object' || obj === null) return
    
    Object.keys(obj).forEach(key => {
      this.defineReactive(obj, key, obj[key])
      // 递归处理嵌套对象
      if (typeof obj[key] === 'object') {
        this.observe(obj[key])
      }
    })
  }
}

// 演示Vue2的局限性
const vue2System = new Vue2Reactive()
const vue2Data = { a: 1, nested: { count: 0 } }
vue2System.observe(vue2Data)

console.log('Vue2数据访问:')
console.log(vue2Data.a) // 可以监听
console.log(vue2Data.nested.count) // 可以监听

console.log('\nVue2数据修改:')
vue2Data.a = 2 // 可以监听
vue2Data.nested.count = 1 // 可以监听

console.log('\nVue2的问题:')
// 问题1: 无法监听新增属性
vue2Data.b = 3 // 无法监听
console.log('新增属性 b:', vue2Data.b)

// 问题2: 无法监听删除属性
delete vue2Data.a // 无法监听
console.log('删除属性 a 后:', vue2Data.a)

// 问题3: 数组索引操作无法监听
const vue2Array = [1, 2, 3]
vue2System.observe(vue2Array)
vue2Array[0] = 10 // 无法监听（这里简化演示）
console.log('数组索引操作:', vue2Array[0])

// =============================================
// 2. Vue3响应式系统的优势演示
// =============================================

console.log('\n=== Vue3响应式系统优势演示 ===')

// 模拟Vue3的reactive实现
class Vue3Reactive {
  constructor() {
    this.targetMap = new WeakMap()
  }

  reactive(target) {
    return new Proxy(target, {
      get(target, key, receiver) {
        console.log(`Vue3: 访问属性 ${key}`)
        const result = Reflect.get(target, key, receiver)
        
        // 惰性响应式：只有在访问时才处理嵌套对象
        if (typeof result === 'object' && result !== null) {
          return new Vue3Reactive().reactive(result)
        }
        
        return result
      },
      
      set(target, key, value, receiver) {
        const oldValue = target[key]
        console.log(`Vue3: 设置属性 ${key} = ${value}`)
        const result = Reflect.set(target, key, value, receiver)
        
        // 触发更新逻辑
        if (oldValue !== value) {
          console.log(`  触发更新: ${key} ${oldValue} -> ${value}`)
        }
        
        return result
      },
      
      deleteProperty(target, key) {
        console.log(`Vue3: 删除属性 ${key}`)
        return Reflect.deleteProperty(target, key)
      },
      
      has(target, key) {
        console.log(`Vue3: 检查属性存在 ${key}`)
        return Reflect.has(target, key)
      },
      
      ownKeys(target) {
        console.log('Vue3: 遍历属性')
        return Reflect.ownKeys(target)
      }
    })
  }
}

// 演示Vue3的优势
const vue3System = new Vue3Reactive()
const vue3Data = vue3System.reactive({ a: 1, nested: { count: 0 } })

console.log('Vue3数据访问:')
console.log(vue3Data.a) // 可以监听
console.log(vue3Data.nested.count) // 可以监听，惰性处理

console.log('\nVue3数据修改:')
vue3Data.a = 2 // 可以监听
vue3Data.nested.count = 1 // 可以监听

console.log('\nVue3的优势:')
// 优势1: 可以监听新增属性
vue3Data.b = 3
console.log('新增属性 b:', vue3Data.b)

// 优势2: 可以监听删除属性
delete vue3Data.a
console.log('删除属性 a 后:', vue3Data.a)

// 优势3: 可以监听所有数组操作
const vue3Array = vue3System.reactive([1, 2, 3])
vue3Array[0] = 10 // 可以监听
vue3Array.push(4) // 可以监听
console.log('数组操作结果:', vue3Array)

// =============================================
// 3. 响应式API的不同级别演示
// =============================================

console.log('\n=== 响应式API不同级别演示 ===')

// 模拟不同类型的响应式API
class ReactivityAPI {
  // 深度响应式
  reactive(target) {
    console.log('创建深度响应式对象')
    return new Proxy(target, {
      get(target, key, receiver) {
        const result = Reflect.get(target, key, receiver)
        if (typeof result === 'object' && result !== null) {
          return new ReactivityAPI().reactive(result) // 递归代理
        }
        return result
      },
      set(target, key, value, receiver) {
        console.log(`深度响应式: 设置 ${key}`)
        return Reflect.set(target, key, value, receiver)
      }
    })
  }

  // 浅层响应式
  shallowReactive(target) {
    console.log('创建浅层响应式对象')
    return new Proxy(target, {
      get(target, key, receiver) {
        return Reflect.get(target, key, receiver) // 不递归代理
      },
      set(target, key, value, receiver) {
        console.log(`浅层响应式: 设置 ${key}`)
        return Reflect.set(target, key, value, receiver)
      }
    })
  }

  // 只读
  readonly(target) {
    console.log('创建只读对象')
    return new Proxy(target, {
      get(target, key, receiver) {
        const result = Reflect.get(target, key, receiver)
        if (typeof result === 'object' && result !== null) {
          return this.readonly(result) // 递归只读
        }
        return result
      },
      set(target, key, value, receiver) {
        console.warn(`只读对象不能设置属性: ${key}`)
        return false
      },
      deleteProperty(target, key) {
        console.warn(`只读对象不能删除属性: ${key}`)
        return false
      }
    })
  }
}

const api = new ReactivityAPI()
const original = { nested: { count: 0 } }

// 深度响应式
const deepReactive = api.reactive({ ...original })
deepReactive.nested.count = 1 // 会触发

// 浅层响应式
const shallowReactive = api.shallowReactive({ ...original })
shallowReactive.nested = { count: 2 } // 会触发
shallowReactive.nested.count = 3 // 不会触发

// 只读
const readonlyData = api.readonly({ ...original })
readonlyData.nested.count = 4 // 会警告

// =============================================
// 4. 性能对比演示
// =============================================

console.log('\n=== 性能对比演示 ===')

// 创建大型嵌套对象
function createLargeObject(depth, breadth) {
  if (depth === 0) return { value: Math.random() }
  
  const obj = {}
  for (let i = 0; i < breadth; i++) {
    obj[`prop${i}`] = createLargeObject(depth - 1, breadth)
  }
  return obj
}

const largeObject = createLargeObject(3, 5) // 3层深度，每层5个属性

// Vue2风格：立即处理所有属性
console.time('Vue2风格初始化')
const vue2Large = new Vue2Reactive()
vue2Large.observe(largeObject) // 立即遍历所有嵌套属性
console.timeEnd('Vue2风格初始化')

// Vue3风格：惰性处理
console.time('Vue3风格初始化')
const vue3Large = new Vue3Reactive()
const reactiveData = vue3Large.reactive({ ...largeObject }) // 只处理第一层
console.timeEnd('Vue3风格初始化')

console.log('Vue3只在访问时处理嵌套对象，初始化更快')

// =============================================
// 5. 组合式使用演示
// =============================================

console.log('\n=== 组合式使用演示 ===')

// 模拟ref实现
function ref(value) {
  return {
    get value() {
      console.log('ref: 访问值')
      return value
    },
    set value(newValue) {
      console.log(`ref: 设置值 ${value} -> ${newValue}`)
      value = newValue
    }
  }
}

// 模拟computed实现
function computed(getter) {
  let value
  let dirty = true
  
  return {
    get value() {
      if (dirty) {
        console.log('computed: 重新计算')
        value = getter()
        dirty = false
      } else {
        console.log('computed: 使用缓存值')
      }
      return value
    }
  }
}

// 组合使用
const count = ref(0)
const doubled = computed(() => count.value * 2)

console.log('初始值:')
console.log('count:', count.value)
console.log('doubled:', doubled.value)

console.log('\n修改count:')
count.value = 5
console.log('doubled:', doubled.value) // 重新计算
console.log('doubled:', doubled.value) // 使用缓存

console.log('\n=== 演示结束 ===')

/**
 * 这个演示展示了：
 * 
 * 1. Vue2响应式系统的局限性
 *    - 无法监听属性的新增和删除
 *    - 数组索引操作的问题
 *    - 初始化时的性能开销
 * 
 * 2. Vue3响应式系统的优势
 *    - 完整的操作拦截
 *    - 惰性响应式处理
 *    - 更好的性能特征
 * 
 * 3. 不同级别的响应式API
 *    - reactive vs shallowReactive
 *    - readonly的保护机制
 * 
 * 4. 性能优化策略
 *    - 按需处理嵌套对象
 *    - 减少初始化开销
 * 
 * 5. 组合式API的设计
 *    - ref的显式值包装
 *    - computed的缓存机制
 */ 