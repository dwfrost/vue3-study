# 第3章面试问题：Proxy与Reflect基础

## 🎯 基础概念题（1-4题）

### 1. 什么是Proxy？它解决了什么问题？

**标准答案：**
Proxy是ES6引入的一个特性，允许你拦截并自定义对象的基本操作（如属性查找、赋值、枚举、函数调用等）。

**解决的问题：**
- **完整的操作拦截**：可以拦截对象的所有操作，包括属性新增、删除、枚举等
- **动态代理**：不需要预先知道对象的所有属性，可以动态处理任意属性
- **数组支持**：完美支持数组索引和length属性的监听
- **原型链支持**：可以拦截原型链上的属性访问

**答题技巧：** 对比Object.defineProperty的局限性，突出Proxy的优势

### 2. Proxy的13种拦截器分别是什么？各有什么作用？

**标准答案：**

**属性相关（4个）：**
- `get(target, property, receiver)` - 拦截属性读取
- `set(target, property, value, receiver)` - 拦截属性设置
- `has(target, property)` - 拦截`in`操作符
- `deleteProperty(target, property)` - 拦截`delete`操作

**属性描述符相关（2个）：**
- `defineProperty(target, property, descriptor)` - 拦截`Object.defineProperty`
- `getOwnPropertyDescriptor(target, property)` - 拦截描述符获取

**对象结构相关（3个）：**
- `ownKeys(target)` - 拦截`Object.keys()`等键枚举操作
- `getPrototypeOf(target)` - 拦截原型获取
- `setPrototypeOf(target, prototype)` - 拦截原型设置

**对象状态相关（2个）：**
- `isExtensible(target)` - 拦截扩展性检查
- `preventExtensions(target)` - 拦截扩展阻止

**函数调用相关（2个）：**
- `apply(target, thisArg, argumentsList)` - 拦截函数调用
- `construct(target, argumentsList, newTarget)` - 拦截`new`操作

**答题技巧：** 按功能分类记忆，举具体例子说明用途

### 3. 什么是Reflect？为什么要配合Proxy使用？

**标准答案：**
Reflect是ES6引入的内置对象，提供拦截JavaScript操作的方法，这些方法与Proxy的handler方法一一对应。

**配合使用的原因：**
1. **确保默认行为**：在自定义逻辑后能正确执行原有操作
2. **统一返回值**：Reflect方法返回布尔值，更适合条件判断
3. **函数式API**：将命令式操作转为函数调用
4. **this指向正确**：receiver参数确保this指向正确

```javascript
// 不使用Reflect的问题
const proxy = new Proxy(obj, {
  set(target, property, value) {
    // 自定义逻辑
    console.log(`设置${property}`)
    
    // 直接赋值可能有问题
    target[property] = value
    return true
  }
})

// 使用Reflect的正确方式
const proxy = new Proxy(obj, {
  set(target, property, value, receiver) {
    console.log(`设置${property}`)
    
    // 确保默认行为正确执行
    return Reflect.set(target, property, value, receiver)
  }
})
```

**答题技巧：** 强调receiver参数的重要性，举例说明this指向问题

### 4. receiver参数有什么作用？不使用会有什么问题？

**标准答案：**
receiver参数表示原始的操作所针对的对象，通常是Proxy对象本身，它确保在访问器属性中this指向正确。

**不使用receiver的问题：**

```javascript
const parent = {
  name: 'parent',
  get info() {
    return `name: ${this.name}`
  }
}

const child = {
  name: 'child'
}

Object.setPrototypeOf(child, parent)

// 不使用receiver
const proxy1 = new Proxy(child, {
  get(target, property) {
    return Reflect.get(target, property) // this可能指向错误
  }
})

// 使用receiver
const proxy2 = new Proxy(child, {
  get(target, property, receiver) {
    return Reflect.get(target, property, receiver) // this指向正确
  }
})

console.log(proxy1.info) // 可能输出: name: parent
console.log(proxy2.info) // 输出: name: child
```

**答题技巧：** 用继承场景的例子说明this指向问题

## 🔧 实现原理题（5-8题）

### 5. 如何用Proxy实现一个简单的响应式系统？

**标准答案：**

```javascript
// 依赖收集系统
const targetMap = new WeakMap()
let activeEffect = null

function track(target, key) {
  if (!activeEffect) return
  
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  
  dep.add(activeEffect)
}

function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  
  const dep = depsMap.get(key)
  if (dep) {
    dep.forEach(effect => effect())
  }
}

// 响应式代理
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver)
      
      // 依赖收集
      track(target, key)
      
      // 递归代理嵌套对象
      if (typeof result === 'object' && result !== null) {
        return reactive(result)
      }
      
      return result
    },
    
    set(target, key, value, receiver) {
      const oldValue = target[key]
      const result = Reflect.set(target, key, value, receiver)
      
      // 值变化时触发更新
      if (oldValue !== value) {
        trigger(target, key)
      }
      
      return result
    }
  })
}

// 副作用函数
function effect(fn) {
  const effectFn = () => {
    activeEffect = effectFn
    fn()
    activeEffect = null
  }
  
  effectFn()
  return effectFn
}
```

**关键点：**
- WeakMap存储依赖关系，防止内存泄漏
- 全局activeEffect跟踪当前执行的副作用
- 递归代理嵌套对象
- 值比较避免不必要的更新

**答题技巧：** 从数据结构设计开始，逐步构建完整系统

### 6. Proxy如何处理数组？有什么特殊考虑？

**标准答案：**

**数组的特殊性：**
1. **索引访问**：数组元素通过数字索引访问
2. **length属性**：修改数组会影响length属性
3. **数组方法**：push、pop等方法会触发多次set操作

**Vue3的处理方式：**

```javascript
// 数组方法的特殊处理
const arrayInstrumentations = {}

;['push', 'pop', 'shift', 'unshift', 'splice'].forEach(key => {
  arrayInstrumentations[key] = function(...args) {
    // 暂停依赖收集，避免无限循环
    pauseTracking()
    const res = toRaw(this)[key].apply(this, args)
    resetTracking()
    return res
  }
})

// 查找方法的特殊处理
;['includes', 'indexOf', 'lastIndexOf'].forEach(key => {
  arrayInstrumentations[key] = function(...args) {
    const arr = toRaw(this)
    
    // 先用原始值搜索
    const res = arr[key](...args)
    if (res === -1 || res === false) {
      // 再用响应式值搜索
      return arr[key](...args.map(toRaw))
    }
    return res
  }
})

// 代理中的处理
function createGetter() {
  return function get(target, key, receiver) {
    // 拦截数组方法
    if (isArray(target) && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver)
    }
    
    const res = Reflect.get(target, key, receiver)
    track(target, 'get', key)
    return res
  }
}
```

**关键考虑：**
- 避免push等方法触发的循环依赖
- 处理includes等查找方法的响应式对象查找
- length属性的特殊处理

**答题技巧：** 解释为什么需要特殊处理，举具体例子

### 7. 如何实现一个数据验证代理？

**标准答案：**

```javascript
function createValidator(schema) {
  const data = {}
  const errors = {}
  
  return new Proxy(data, {
    set(target, property, value, receiver) {
      const rule = schema[property]
      
      // 清除之前的错误
      delete errors[property]
      
      if (rule) {
        try {
          // 类型验证
          if (rule.type && typeof value !== rule.type) {
            throw new TypeError(`${property} must be ${rule.type}`)
          }
          
          // 范围验证
          if (rule.min !== undefined && value < rule.min) {
            throw new RangeError(`${property} must be >= ${rule.min}`)
          }
          
          if (rule.max !== undefined && value > rule.max) {
            throw new RangeError(`${property} must be <= ${rule.max}`)
          }
          
          // 自定义验证
          if (rule.validator && !rule.validator(value)) {
            throw new Error(`${property} validation failed`)
          }
          
        } catch (error) {
          errors[property] = error.message
          return false // 阻止设置
        }
      }
      
      return Reflect.set(target, property, value, receiver)
    },
    
    get(target, property, receiver) {
      // 特殊属性
      if (property === '$errors') {
        return { ...errors }
      }
      if (property === '$isValid') {
        return Object.keys(errors).length === 0
      }
      
      return Reflect.get(target, property, receiver)
    }
  })
}

// 使用示例
const userValidator = createValidator({
  name: { 
    type: 'string',
    validator: value => value.length >= 2
  },
  age: { 
    type: 'number', 
    min: 0, 
    max: 150 
  },
  email: { 
    type: 'string',
    validator: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }
})
```

**设计要点：**
- 在set拦截器中进行验证
- 提供$errors和$isValid特殊属性
- 支持多种验证规则：类型、范围、自定义函数
- 验证失败时阻止属性设置

**答题技巧：** 从需求分析开始，展示设计思路

### 8. Proxy的性能如何？有什么优化策略？

**标准答案：**

**性能特点：**
1. **拦截开销**：每次操作都会经过handler函数
2. **内存占用**：需要额外存储handler对象
3. **相对高效**：相比Object.defineProperty，功能更完整

**优化策略：**

```javascript
// 1. 缓存代理对象，避免重复创建
const reactiveMap = new WeakMap()

function reactive(target) {
  const existingProxy = reactiveMap.get(target)
  if (existingProxy) {
    return existingProxy
  }
  
  const proxy = new Proxy(target, handlers)
  reactiveMap.set(target, proxy)
  return proxy
}

// 2. 惰性代理，只在需要时创建嵌套对象的代理
function get(target, key, receiver) {
  const res = Reflect.get(target, key, receiver)
  
  // 只有在访问时才创建嵌套对象的代理
  if (isObject(res)) {
    return reactive(res)
  }
  
  return res
}

// 3. 减少不必要的拦截
function set(target, key, value, receiver) {
  const oldValue = target[key]
  const result = Reflect.set(target, key, value, receiver)
  
  // 只有值真的变化才触发更新
  if (oldValue !== value && !Number.isNaN(value) && !Number.isNaN(oldValue)) {
    trigger(target, key)
  }
  
  return result
}

// 4. 使用WeakMap避免内存泄漏
const targetMap = new WeakMap() // 而不是Map
```

**关键优化：**
- 代理对象缓存
- 惰性嵌套代理
- 避免无效触发
- 合理的数据结构选择

**答题技巧：** 结合Vue3实际实现说明优化思路

## 🚀 应用场景题（9-12题）

### 9. 在Vue3中，Proxy是如何支持响应式数据的？

**标准答案：**

**Vue3响应式架构：**
```javascript
// 1. reactive API
function reactive(target) {
  return createReactiveObject(
    target,
    false, // isReadonly
    mutableHandlers,
    mutableCollectionHandlers
  )
}

// 2. 处理器对象
const mutableHandlers = {
  get: createGetter(false, false),
  set: createSetter(false),
  deleteProperty: deletePropertyHandler,
  has: hasHandler,
  ownKeys: ownKeysHandler
}

// 3. getter创建函数
function createGetter(isReadonly = false, shallow = false) {
  return function get(target, key, receiver) {
    // 处理特殊key
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    }
    
    const res = Reflect.get(target, key, receiver)
    
    // 依赖收集
    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }
    
    // 浅层响应式直接返回
    if (shallow) {
      return res
    }
    
    // 递归处理对象
    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res)
    }
    
    return res
  }
}

// 4. setter创建函数
function createSetter(shallow = false) {
  return function set(target, key, value, receiver) {
    let oldValue = target[key]
    
    const result = Reflect.set(target, key, value, receiver)
    
    // 触发更新
    if (target === toRaw(receiver)) {
      if (hasChanged(value, oldValue)) {
        if (hasOwn(target, key)) {
          trigger(target, TriggerOpTypes.SET, key, value, oldValue)
        } else {
          trigger(target, TriggerOpTypes.ADD, key, value)
        }
      }
    }
    
    return result
  }
}
```

**关键特性：**
- 完整的操作拦截（get、set、delete、has等）
- 惰性响应式（只在访问时创建嵌套代理）
- 精确的依赖收集和触发
- 特殊处理（数组、Map、Set等）

**答题技巧：** 从API使用到内部实现，层层深入

### 10. 如何用Proxy实现一个观察者模式？

**标准答案：**

```javascript
class Observable {
  constructor(data = {}) {
    this.observers = new Set()
    this.data = this.createProxy(data)
  }
  
  createProxy(target) {
    return new Proxy(target, {
      get: (obj, prop, receiver) => {
        const result = Reflect.get(obj, prop, receiver)
        
        // 如果是对象，递归创建代理
        if (typeof result === 'object' && result !== null) {
          return this.createProxy(result)
        }
        
        return result
      },
      
      set: (obj, prop, value, receiver) => {
        const oldValue = obj[prop]
        const result = Reflect.set(obj, prop, value, receiver)
        
        // 值变化时通知观察者
        if (oldValue !== value) {
          this.notify(prop, value, oldValue)
        }
        
        return result
      },
      
      deleteProperty: (obj, prop) => {
        const oldValue = obj[prop]
        const result = Reflect.deleteProperty(obj, prop)
        
        if (result) {
          this.notify(prop, undefined, oldValue)
        }
        
        return result
      }
    })
  }
  
  // 添加观察者
  subscribe(observer) {
    this.observers.add(observer)
    return () => this.observers.delete(observer) // 返回取消订阅函数
  }
  
  // 通知所有观察者
  notify(property, newValue, oldValue) {
    this.observers.forEach(observer => {
      observer({
        type: newValue === undefined ? 'delete' : 'change',
        property,
        newValue,
        oldValue,
        target: this.data
      })
    })
  }
}

// 使用示例
const observable = new Observable({
  user: {
    name: 'Vue',
    age: 25
  }
})

// 订阅变化
const unsubscribe = observable.subscribe(change => {
  console.log(`属性 ${change.property} 发生变化:`, 
    change.oldValue, '->', change.newValue)
})

// 触发变化
observable.data.user.name = 'Vue3'  // 输出变化信息
observable.data.user.age = 26       // 输出变化信息

// 取消订阅
unsubscribe()
```

**设计要点：**
- 使用Set管理观察者
- 递归代理嵌套对象
- 提供取消订阅机制
- 详细的变化信息

**答题技巧：** 从观察者模式的需求出发，展示Proxy的优势

### 11. 如何实现一个安全的对象访问代理？

**标准答案：**

```javascript
function createSecureProxy(target, permissions = {}) {
  const {
    readableProps = [],
    writableProps = [],
    deletableProps = [],
    hiddenProps = [],
    readOnly = false
  } = permissions
  
  return new Proxy(target, {
    get(target, property, receiver) {
      // 检查属性是否被隐藏
      if (hiddenProps.includes(property)) {
        return undefined
      }
      
      // 检查读取权限
      if (readableProps.length > 0 && !readableProps.includes(property)) {
        throw new Error(`无权限读取属性: ${property}`)
      }
      
      return Reflect.get(target, property, receiver)
    },
    
    set(target, property, value, receiver) {
      // 只读模式
      if (readOnly) {
        throw new Error('对象为只读模式')
      }
      
      // 检查写入权限
      if (writableProps.length > 0 && !writableProps.includes(property)) {
        throw new Error(`无权限修改属性: ${property}`)
      }
      
      return Reflect.set(target, property, value, receiver)
    },
    
    deleteProperty(target, property) {
      // 只读模式
      if (readOnly) {
        throw new Error('对象为只读模式')
      }
      
      // 检查删除权限
      if (deletableProps.length > 0 && !deletableProps.includes(property)) {
        throw new Error(`无权限删除属性: ${property}`)
      }
      
      return Reflect.deleteProperty(target, property)
    },
    
    has(target, property) {
      // 隐藏的属性不存在
      if (hiddenProps.includes(property)) {
        return false
      }
      
      return Reflect.has(target, property)
    },
    
    ownKeys(target) {
      // 过滤隐藏属性
      const keys = Reflect.ownKeys(target)
      return keys.filter(key => !hiddenProps.includes(key))
    }
  })
}

// 使用示例
const sensitiveData = {
  publicInfo: '公开信息',
  userEmail: 'user@example.com',
  password: 'secret123',
  apiKey: 'sk-xxx'
}

const secureProxy = createSecureProxy(sensitiveData, {
  readableProps: ['publicInfo', 'userEmail'],
  writableProps: ['publicInfo'],
  hiddenProps: ['password', 'apiKey']
})

console.log(secureProxy.publicInfo)  // OK
console.log(secureProxy.userEmail)   // OK
console.log(secureProxy.password)    // undefined (隐藏)

secureProxy.publicInfo = '新信息'    // OK
// secureProxy.userEmail = 'new@'    // 错误：无权限修改

console.log(Object.keys(secureProxy)) // ['publicInfo', 'userEmail']
```

**安全特性：**
- 属性访问权限控制
- 属性修改权限控制
- 属性删除权限控制
- 属性隐藏功能
- 只读模式支持

**答题技巧：** 结合实际安全需求，展示权限控制的必要性

### 12. 如何使用Proxy实现一个缓存系统？

**标准答案：**

```javascript
function createCacheProxy(target, options = {}) {
  const {
    maxSize = 100,
    ttl = 60000, // 默认1分钟过期
    enableStats = true
  } = options
  
  const cache = new Map()
  const timestamps = new Map()
  const stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0
  }
  
  // 清理过期缓存
  function cleanExpired() {
    const now = Date.now()
    for (const [key, time] of timestamps) {
      if (now - time > ttl) {
        cache.delete(key)
        timestamps.delete(key)
      }
    }
  }
  
  // LRU淘汰策略
  function evictLRU() {
    if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value
      cache.delete(oldestKey)
      timestamps.delete(oldestKey)
      enableStats && stats.deletes++
    }
  }
  
  return new Proxy(target, {
    get(target, property, receiver) {
      // 特殊属性
      if (property === '$cache') {
        return {
          size: cache.size,
          stats: enableStats ? { ...stats } : null,
          clear: () => {
            cache.clear()
            timestamps.clear()
          }
        }
      }
      
      // 检查缓存
      cleanExpired()
      
      if (cache.has(property)) {
        // 缓存命中，更新访问时间
        const value = cache.get(property)
        timestamps.set(property, Date.now())
        
        // 移到最后（LRU）
        cache.delete(property)
        cache.set(property, value)
        
        enableStats && stats.hits++
        return value
      }
      
      // 缓存未命中，获取实际值
      const value = Reflect.get(target, property, receiver)
      
      // 如果是函数，不缓存
      if (typeof value === 'function') {
        return value
      }
      
      // 添加到缓存
      evictLRU()
      cache.set(property, value)
      timestamps.set(property, Date.now())
      
      enableStats && stats.misses++
      return value
    },
    
    set(target, property, value, receiver) {
      const result = Reflect.set(target, property, value, receiver)
      
      // 更新缓存
      if (result) {
        cache.set(property, value)
        timestamps.set(property, Date.now())
        enableStats && stats.sets++
      }
      
      return result
    },
    
    deleteProperty(target, property) {
      const result = Reflect.deleteProperty(target, property)
      
      if (result) {
        cache.delete(property)
        timestamps.delete(property)
        enableStats && stats.deletes++
      }
      
      return result
    }
  })
}

// 使用示例：缓存计算结果
const expensiveOperations = {
  fibonacci(n) {
    if (n <= 1) return n
    return this.fibonacci(n - 1) + this.fibonacci(n - 2)
  },
  
  factorial(n) {
    if (n <= 1) return 1
    return n * this.factorial(n - 1)
  }
}

const cachedOps = createCacheProxy(expensiveOperations, {
  maxSize: 50,
  ttl: 30000, // 30秒过期
  enableStats: true
})

// 第一次计算（慢）
console.time('第一次计算')
console.log(cachedOps.fibonacci(40))
console.timeEnd('第一次计算')

// 第二次计算（快，来自缓存）
console.time('第二次计算')
console.log(cachedOps.fibonacci(40))
console.timeEnd('第二次计算')

// 查看缓存统计
console.log(cachedOps.$cache.stats)
```

**缓存特性：**
- LRU淘汰策略
- TTL过期机制
- 缓存统计功能
- 缓存大小限制
- 缓存清理功能

**答题技巧：** 从缓存需求出发，展示Proxy在透明缓存方面的优势

## 🤔 深度思考题（13-15题）

### 13. 为什么Vue3选择Proxy而不是继续优化Object.defineProperty？

**标准答案：**

**Object.defineProperty的局限性：**

1. **无法检测属性的新增和删除**
```javascript
// Vue2的问题
const data = { name: 'Vue' }
Object.defineProperty(data, 'name', { /* ... */ })

// 无法检测到
data.age = 25        // 新增属性
delete data.name     // 删除属性

// Vue2需要特殊API
Vue.set(data, 'age', 25)
Vue.delete(data, 'name')
```

2. **数组处理复杂**
```javascript
// Vue2对数组的特殊处理
const arrayProto = Array.prototype
const arrayMethods = Object.create(arrayProto)

;['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse']
.forEach(method => {
  arrayMethods[method] = function(...args) {
    const result = arrayProto[method].apply(this, args)
    // 手动触发更新
    notify()
    return result
  }
})
```

3. **需要递归遍历所有属性**
```javascript
// Vue2需要预先遍历所有属性
function defineReactive(obj) {
  Object.keys(obj).forEach(key => {
    Object.defineProperty(obj, key, {
      get() { /* 收集依赖 */ },
      set() { /* 触发更新 */ }
    })
    
    // 递归处理嵌套对象
    if (typeof obj[key] === 'object') {
      defineReactive(obj[key])
    }
  })
}
```

**Proxy的优势：**

1. **完整的操作拦截**
```javascript
// Proxy可以拦截所有操作
const proxy = new Proxy(target, {
  get() { /* 属性访问 */ },
  set() { /* 属性设置，包括新增 */ },
  deleteProperty() { /* 属性删除 */ },
  has() { /* in 操作符 */ },
  ownKeys() { /* Object.keys等 */ }
  // ... 其他12种操作
})
```

2. **原生数组支持**
```javascript
// Proxy天然支持数组
const arr = reactive([1, 2, 3])
arr.push(4)      // 自动触发更新
arr[0] = 10      // 自动触发更新
arr.length = 0   // 自动触发更新
```

3. **惰性响应式**
```javascript
// Proxy支持惰性响应式
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver)
      
      // 只有在访问时才进行响应式处理
      if (isObject(result)) {
        return reactive(result)
      }
      
      return result
    }
  })
}
```

**性能对比：**
- Object.defineProperty：初始化时需要遍历所有属性，运行时开销小
- Proxy：初始化快，运行时每次操作都有拦截开销，但总体更高效

**答题技巧：** 从具体问题出发，对比两种方案的优劣

### 14. 在什么情况下你会选择不使用Reflect而直接操作target？

**标准答案：**

**不使用Reflect的场景：**

1. **简单的属性访问，不涉及继承**
```javascript
const proxy = new Proxy(simpleObj, {
  get(target, property) {
    // 简单对象，没有getter/setter，可以直接访问
    return target[property]
  }
})
```

2. **完全自定义的行为，不需要默认操作**
```javascript
const virtualObject = new Proxy({}, {
  get(target, property) {
    // 完全虚拟的属性，不存储在target中
    if (property === 'random') {
      return Math.random()
    }
    if (property === 'timestamp') {
      return Date.now()
    }
    return undefined // 不需要访问target
  }
})
```

3. **性能敏感场景的微优化**
```javascript
const performanceCritical = new Proxy(target, {
  get(target, property) {
    // 在极端性能要求下，减少一层函数调用
    track(target, property)
    return target[property] // 而不是 Reflect.get(target, property)
  }
})
```

**必须使用Reflect的场景：**

1. **涉及继承和原型链**
```javascript
const proxy = new Proxy(child, {
  get(target, property, receiver) {
    // 必须使用receiver确保this指向正确
    return Reflect.get(target, property, receiver)
  }
})
```

2. **处理访问器属性**
```javascript
const obj = {
  _value: 0,
  get value() {
    return this._value
  },
  set value(v) {
    this._value = v
  }
}

const proxy = new Proxy(obj, {
  get(target, property, receiver) {
    // 访问器属性必须使用Reflect确保this正确
    return Reflect.get(target, property, receiver)
  }
})
```

3. **需要返回值判断操作是否成功**
```javascript
const proxy = new Proxy(target, {
  set(target, property, value, receiver) {
    // Reflect.set返回布尔值，表示操作是否成功
    const success = Reflect.set(target, property, value, receiver)
    if (success) {
      trigger(target, property)
    }
    return success
  }
})
```

**最佳实践：**
- 默认使用Reflect，确保行为正确
- 在确定不需要默认行为时，可以直接操作target
- 性能敏感且经过测试验证的场景，可以考虑直接操作

**答题技巧：** 从正确性、性能、可维护性三个角度分析

### 15. 如何设计一个高性能的Proxy处理器？

**标准答案：**

**性能优化策略：**

1. **减少不必要的拦截**
```javascript
function createOptimizedProxy(target, options = {}) {
  const {
    trackReads = true,
    trackWrites = true,
    trackDeletes = false,
    trackEnumeration = false
  } = options
  
  const handlers = {}
  
  // 只添加需要的拦截器
  if (trackReads) {
    handlers.get = function(target, property, receiver) {
      track(target, property)
      return Reflect.get(target, property, receiver)
    }
  }
  
  if (trackWrites) {
    handlers.set = function(target, property, value, receiver) {
      const oldValue = target[property]
      const result = Reflect.set(target, property, value, receiver)
      
      if (oldValue !== value) {
        trigger(target, property)
      }
      
      return result
    }
  }
  
  // 按需添加其他拦截器...
  
  return new Proxy(target, handlers)
}
```

2. **缓存热点数据**
```javascript
function createCachedProxy(target) {
  const cache = new Map()
  const accessCount = new Map()
  
  return new Proxy(target, {
    get(target, property, receiver) {
      // 统计访问频率
      accessCount.set(property, (accessCount.get(property) || 0) + 1)
      
      // 热点数据缓存
      if (accessCount.get(property) > 10 && cache.has(property)) {
        return cache.get(property)
      }
      
      const result = Reflect.get(target, property, receiver)
      
      // 缓存非函数值
      if (accessCount.get(property) > 10 && typeof result !== 'function') {
        cache.set(property, result)
      }
      
      return result
    },
    
    set(target, property, value, receiver) {
      // 清除缓存
      cache.delete(property)
      return Reflect.set(target, property, value, receiver)
    }
  })
}
```

3. **避免不必要的对象创建**
```javascript
// 复用handler对象
const readonlyHandlers = {
  get(target, property, receiver) {
    track(target, property)
    return Reflect.get(target, property, receiver)
  },
  
  set() {
    console.warn('Cannot set on readonly object')
    return false
  }
}

// 复用而不是每次创建新的handler
function readonly(target) {
  return new Proxy(target, readonlyHandlers)
}
```

4. **批量操作优化**
```javascript
function createBatchedProxy(target) {
  let batchedUpdates = []
  let flushPending = false
  
  function flushUpdates() {
    if (batchedUpdates.length > 0) {
      // 批量处理更新
      const updates = batchedUpdates.splice(0)
      updates.forEach(update => {
        trigger(update.target, update.property)
      })
    }
    flushPending = false
  }
  
  return new Proxy(target, {
    set(target, property, value, receiver) {
      const result = Reflect.set(target, property, value, receiver)
      
      // 批量收集更新
      batchedUpdates.push({ target, property, value })
      
      if (!flushPending) {
        flushPending = true
        // 微任务中批量处理
        Promise.resolve().then(flushUpdates)
      }
      
      return result
    }
  })
}
```

5. **类型特定优化**
```javascript
function createTypedProxy(target) {
  // 根据target类型选择不同的优化策略
  if (Array.isArray(target)) {
    return createArrayProxy(target)
  } else if (target instanceof Map) {
    return createMapProxy(target)
  } else if (target instanceof Set) {
    return createSetProxy(target)
  } else {
    return createObjectProxy(target)
  }
}

function createArrayProxy(target) {
  return new Proxy(target, {
    get(target, property, receiver) {
      // 数组特定优化
      if (property === 'length' || isArrayIndex(property)) {
        track(target, property)
      }
      
      // 处理数组方法
      if (arrayMethods.hasOwnProperty(property)) {
        return arrayMethods[property]
      }
      
      return Reflect.get(target, property, receiver)
    }
  })
}
```

**性能测试和监控：**
```javascript
function createMonitoredProxy(target, name) {
  const stats = {
    gets: 0,
    sets: 0,
    time: 0
  }
  
  return new Proxy(target, {
    get(target, property, receiver) {
      const start = performance.now()
      stats.gets++
      
      const result = Reflect.get(target, property, receiver)
      
      stats.time += performance.now() - start
      return result
    },
    
    set(target, property, value, receiver) {
      const start = performance.now()
      stats.sets++
      
      const result = Reflect.set(target, property, value, receiver)
      
      stats.time += performance.now() - start
      return result
    }
  })
}
```

**关键优化原则：**
1. 按需拦截，避免不必要的handler
2. 缓存频繁访问的数据
3. 批量处理更新，减少触发频率
4. 根据数据类型进行特定优化
5. 监控性能，持续优化

**答题技巧：** 从实际性能瓶颈出发，提供具体的优化方案和代码示例

---

## 📚 答题总结

### 回答技巧

1. **结构清晰**：按功能分类，先说概念再举例子
2. **对比说明**：与Object.defineProperty对比突出优势
3. **实际应用**：结合Vue3实现说明实际用途
4. **注意陷阱**：说明常见问题和解决方案
5. **性能考虑**：不回避性能问题，提供优化思路

### 准备建议

1. **动手实践**：自己实现简单的响应式系统
2. **阅读源码**：研究Vue3响应式模块的实现
3. **性能测试**：实际测试Proxy的性能特征
4. **扩展应用**：尝试用Proxy解决其他问题

### 高分要点

- 能清楚解释13种拦截器的作用和使用场景
- 理解receiver参数的重要性和this指向问题
- 知道Vue3选择Proxy的深层原因
- 能设计实际可用的Proxy应用案例
- 了解性能特点并提供优化方案 