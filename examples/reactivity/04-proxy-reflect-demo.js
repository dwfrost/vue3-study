/**
 * Vue3原理学习系列 - 第3章：Proxy与Reflect基础
 * 
 * 本文件包含了Proxy和Reflect的完整演示代码
 * 涵盖了13种拦截器的使用方法和实际应用案例
 * 
 * 运行方式：
 * 1. 在浏览器中打开HTML文件引入此脚本
 * 2. 在Node.js中直接运行：node 04-proxy-reflect-demo.js
 */

console.log('=== Vue3原理学习 - Proxy与Reflect基础演示 ===\n')

// ================================
// 1. Proxy基础概念演示
// ================================

console.log('1. Proxy基础概念演示')
console.log('-------------------')

// 基础代理示例
const basicTarget = {
  name: 'Vue',
  version: 3
}

const basicProxy = new Proxy(basicTarget, {
  get(target, property, receiver) {
    console.log(`🔍 访问属性: ${property}`)
    return Reflect.get(target, property, receiver)
  },
  
  set(target, property, value, receiver) {
    console.log(`📝 设置属性: ${property} = ${value}`)
    return Reflect.set(target, property, value, receiver)
  }
})

// 测试基础代理
console.log('访问 basicProxy.name:', basicProxy.name)
basicProxy.author = 'Evan You'
console.log('basicProxy 最终状态:', basicProxy)
console.log()

// ================================
// 2. 13种拦截器完整演示
// ================================

console.log('2. 13种拦截器完整演示')
console.log('--------------------')

// 创建一个包含所有拦截器的代理
function createFullProxy(target) {
  return new Proxy(target, {
    // 1. get - 拦截属性读取
    get(target, property, receiver) {
      console.log(`  GET: ${property}`)
      
      // 特殊属性处理
      if (property === 'magic') {
        return '✨ 这是魔法属性'
      }
      
      return Reflect.get(target, property, receiver)
    },
    
    // 2. set - 拦截属性设置
    set(target, property, value, receiver) {
      console.log(`  SET: ${property} = ${value}`)
      
      // 属性验证
      if (property === 'age' && (typeof value !== 'number' || value < 0)) {
        console.log(`  ❌ 验证失败: age必须是非负数`)
        return false
      }
      
      return Reflect.set(target, property, value, receiver)
    },
    
    // 3. has - 拦截 in 操作符
    has(target, property) {
      console.log(`  HAS: ${property}`)
      
      // 隐藏私有属性
      if (property.startsWith('_')) {
        return false
      }
      
      return Reflect.has(target, property)
    },
    
    // 4. deleteProperty - 拦截 delete 操作
    deleteProperty(target, property) {
      console.log(`  DELETE: ${property}`)
      
      // 保护重要属性
      if (property === 'name') {
        console.log(`  🔒 受保护的属性不能删除`)
        return false
      }
      
      return Reflect.deleteProperty(target, property)
    },
    
    // 5. defineProperty - 拦截 Object.defineProperty
    defineProperty(target, property, descriptor) {
      console.log(`  DEFINE: ${property}`)
      
      // 强制所有属性可枚举
      descriptor.enumerable = true
      
      return Reflect.defineProperty(target, property, descriptor)
    },
    
    // 6. getOwnPropertyDescriptor - 拦截属性描述符获取
    getOwnPropertyDescriptor(target, property) {
      console.log(`  GET_DESCRIPTOR: ${property}`)
      return Reflect.getOwnPropertyDescriptor(target, property)
    },
    
    // 7. ownKeys - 拦截键枚举
    ownKeys(target) {
      console.log(`  OWN_KEYS`)
      
      // 过滤私有属性
      const keys = Reflect.ownKeys(target)
      return keys.filter(key => !key.toString().startsWith('_'))
    },
    
    // 8. getPrototypeOf - 拦截原型获取
    getPrototypeOf(target) {
      console.log(`  GET_PROTOTYPE`)
      return Reflect.getPrototypeOf(target)
    },
    
    // 9. setPrototypeOf - 拦截原型设置
    setPrototypeOf(target, prototype) {
      console.log(`  SET_PROTOTYPE`)
      return Reflect.setPrototypeOf(target, prototype)
    },
    
    // 10. isExtensible - 拦截扩展性检查
    isExtensible(target) {
      console.log(`  IS_EXTENSIBLE`)
      return Reflect.isExtensible(target)
    },
    
    // 11. preventExtensions - 拦截扩展阻止
    preventExtensions(target) {
      console.log(`  PREVENT_EXTENSIONS`)
      return Reflect.preventExtensions(target)
    }
  })
}

// 测试完整代理
const fullTarget = {
  name: 'Vue',
  version: 3,
  _internal: 'internal data'
}

const fullProxy = createFullProxy(fullTarget)

console.log('测试各种操作:')
console.log('fullProxy.name:', fullProxy.name)
console.log('fullProxy.magic:', fullProxy.magic)
fullProxy.age = 25
fullProxy.age = -5  // 应该失败
console.log('"name" in fullProxy:', 'name' in fullProxy)
console.log('"_internal" in fullProxy:', '_internal' in fullProxy)
console.log('Object.keys(fullProxy):', Object.keys(fullProxy))
console.log()

// ================================
// 3. 函数代理演示
// ================================

console.log('3. 函数代理演示')
console.log('-------------')

// apply 拦截器演示
function sum(a, b) {
  return a + b
}

const proxiedSum = new Proxy(sum, {
  apply(target, thisArg, argumentsList) {
    console.log(`📞 调用函数，参数: [${argumentsList.join(', ')}]`)
    
    // 参数验证
    if (argumentsList.some(arg => typeof arg !== 'number')) {
      throw new TypeError('所有参数必须是数字')
    }
    
    const result = Reflect.apply(target, thisArg, argumentsList)
    console.log(`📞 函数返回: ${result}`)
    return result
  }
})

// construct 拦截器演示
function Person(name, age) {
  this.name = name
  this.age = age
}

const ProxiedPerson = new Proxy(Person, {
  construct(target, argumentsList, newTarget) {
    console.log(`🏗️  创建实例，参数: [${argumentsList.join(', ')}]`)
    
    // 参数验证
    if (!argumentsList[0]) {
      throw new Error('name参数是必需的')
    }
    
    return Reflect.construct(target, argumentsList, newTarget)
  }
})

// 测试函数代理
console.log('测试函数代理:')
try {
  const result = proxiedSum(10, 20)
  console.log('sum结果:', result)
  
  const person = new ProxiedPerson('Alice', 30)
  console.log('创建的person:', person)
} catch (error) {
  console.error('错误:', error.message)
}
console.log()

// ================================
// 4. Reflect详细演示
// ================================

console.log('4. Reflect详细演示')
console.log('----------------')

const reflectTarget = {
  name: 'Vue',
  version: 3
}

// Reflect的13个方法演示
console.log('Reflect方法演示:')

// 1. Reflect.get
console.log('Reflect.get(obj, "name"):', Reflect.get(reflectTarget, 'name'))

// 2. Reflect.set
console.log('Reflect.set(obj, "author", "Evan"):', 
  Reflect.set(reflectTarget, 'author', 'Evan You'))

// 3. Reflect.has
console.log('Reflect.has(obj, "name"):', Reflect.has(reflectTarget, 'name'))

// 4. Reflect.deleteProperty
console.log('Reflect.deleteProperty(obj, "author"):', 
  Reflect.deleteProperty(reflectTarget, 'author'))

// 5. Reflect.defineProperty
console.log('Reflect.defineProperty(obj, "type", {value: "framework"}):', 
  Reflect.defineProperty(reflectTarget, 'type', {
    value: 'framework',
    writable: true,
    enumerable: true,
    configurable: true
  }))

// 6. Reflect.getOwnPropertyDescriptor
console.log('Reflect.getOwnPropertyDescriptor(obj, "name"):')
console.log(Reflect.getOwnPropertyDescriptor(reflectTarget, 'name'))

// 7. Reflect.ownKeys
console.log('Reflect.ownKeys(obj):', Reflect.ownKeys(reflectTarget))

// 8-11. 原型相关方法
const proto = { isPrototype: true }
console.log('Reflect.setPrototypeOf(obj, proto):', 
  Reflect.setPrototypeOf(reflectTarget, proto))
console.log('Reflect.getPrototypeOf(obj):', 
  Reflect.getPrototypeOf(reflectTarget))
console.log('Reflect.isExtensible(obj):', 
  Reflect.isExtensible(reflectTarget))

// 12-13. 函数相关方法
function greet(greeting) {
  return `${greeting}, ${this.name}!`
}

console.log('Reflect.apply(greet, obj, ["Hello"]):', 
  Reflect.apply(greet, reflectTarget, ['Hello']))

function Constructor(value) {
  this.value = value
}

console.log('Reflect.construct(Constructor, ["test"]):', 
  Reflect.construct(Constructor, ['test']))

console.log()

// ================================
// 5. Vue3响应式系统简化实现
// ================================

console.log('5. Vue3响应式系统简化实现')
console.log('------------------------')

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
  console.log(`  📊 收集依赖: ${key}`)
}

function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  
  const dep = depsMap.get(key)
  if (dep) {
    console.log(`  🚀 触发更新: ${key}`)
    dep.forEach(effect => effect())
  }
}

// 简化的reactive实现
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver)
      
      // 依赖收集
      track(target, key)
      
      // 如果是对象，递归代理
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

// 简化的effect实现
function effect(fn) {
  const effectFn = () => {
    activeEffect = effectFn
    fn()
    activeEffect = null
  }
  
  effectFn()
  return effectFn
}

// 测试响应式系统
console.log('测试响应式系统:')

const state = reactive({
  count: 0,
  message: 'Hello Vue3'
})

// 创建副作用
effect(() => {
  console.log(`  💫 Effect执行: count = ${state.count}`)
})

effect(() => {
  console.log(`  💫 Effect执行: message = ${state.message}`)
})

// 触发更新
console.log('\n修改 state.count:')
state.count = 1

console.log('\n修改 state.message:')
state.message = 'Hello Proxy'

console.log('\n修改 state.count (相同值):')
state.count = 1  // 不应该触发更新

console.log()

// ================================
// 6. 实战案例：数据验证器
// ================================

console.log('6. 实战案例：数据验证器')
console.log('---------------------')

function createValidator(schema) {
  const data = {}
  const errors = {}
  
  const proxy = new Proxy(data, {
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
          
          console.log(`  ✅ ${property} 验证通过: ${value}`)
          
        } catch (error) {
          console.log(`  ❌ ${property} 验证失败: ${error.message}`)
          errors[property] = error.message
          return false
        }
      }
      
      return Reflect.set(target, property, value, receiver)
    },
    
    get(target, property, receiver) {
      if (property === '$errors') {
        return { ...errors }
      }
      if (property === '$isValid') {
        return Object.keys(errors).length === 0
      }
      return Reflect.get(target, property, receiver)
    }
  })
  
  return proxy
}

// 创建用户数据验证器
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

// 测试验证器
console.log('测试数据验证器:')

userValidator.name = 'Vue'
userValidator.age = 25
userValidator.email = 'vue@example.com'

console.log('有效数据设置完成')
console.log('userValidator.$isValid:', userValidator.$isValid)
console.log('userValidator.$errors:', userValidator.$errors)

// 测试无效数据
console.log('\n测试无效数据:')
userValidator.name = 'A'  // 太短
userValidator.age = -5    // 负数
userValidator.email = 'invalid'  // 无效邮箱

console.log('userValidator.$isValid:', userValidator.$isValid)
console.log('userValidator.$errors:', userValidator.$errors)

console.log()

// ================================
// 7. 性能对比测试
// ================================

console.log('7. 性能对比测试')
console.log('-------------')

// 准备测试数据
const directObj = { count: 0 }
const proxyObj = new Proxy({ count: 0 }, {
  get(target, property) {
    return Reflect.get(target, property)
  },
  set(target, property, value) {
    return Reflect.set(target, property, value)
  }
})

const iterations = 100000

// 直接访问性能测试
console.time('直接访问')
for (let i = 0; i < iterations; i++) {
  directObj.count++
}
console.timeEnd('直接访问')

// 代理访问性能测试
proxyObj.count = 0
console.time('代理访问')
for (let i = 0; i < iterations; i++) {
  proxyObj.count++
}
console.timeEnd('代理访问')

console.log(`\n性能对比完成，直接访问更快，但代理访问提供了更多功能`)

// ================================
// 8. 总结和思考
// ================================

console.log('\n=== 第3章学习总结 ===')
console.log('核心收获:')
console.log('1. 🎯 Proxy提供了完整的对象操作拦截能力')
console.log('2. 🔧 Reflect确保默认行为的正确执行')
console.log('3. 📊 13种拦截器覆盖对象操作的方方面面')
console.log('4. ⚡ Vue3响应式系统基于Proxy和Reflect构建')
console.log('5. 🛡️ 可以实现数据验证、访问控制等高级功能')
console.log('6. 📈 性能开销相对较小，功能强大')

console.log('\n思考题:')
console.log('1. 为什么Vue3选择Proxy而不是继续优化Object.defineProperty？')
console.log('2. 在什么情况下你会选择不使用Reflect而直接操作target？')
console.log('3. 如何设计一个高性能的Proxy处理器？')

console.log('\n🎉 第3章演示完成！准备学习第4章：响应式核心实现') 