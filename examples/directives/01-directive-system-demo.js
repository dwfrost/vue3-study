/**
 * 第9章：指令系统与自定义指令 - 完整演示
 * 
 * 本文件演示Vue3指令系统的核心概念：
 * 1. 内置指令的实现原理
 * 2. 自定义指令的开发
 * 3. 指令的编译过程
 * 4. 指令优化策略
 */

// ===== 1. 指令系统基础架构 =====

/**
 * 指令定义接口
 */
class DirectiveDefinition {
  constructor(hooks = {}) {
    this.created = hooks.created
    this.beforeMount = hooks.beforeMount
    this.mounted = hooks.mounted
    this.beforeUpdate = hooks.beforeUpdate
    this.updated = hooks.updated
    this.beforeUnmount = hooks.beforeUnmount
    this.unmounted = hooks.unmounted
  }
}

/**
 * 指令绑定信息
 */
class DirectiveBinding {
  constructor(value, oldValue, arg, modifiers, instance, dir) {
    this.value = value
    this.oldValue = oldValue
    this.arg = arg
    this.modifiers = modifiers || {}
    this.instance = instance
    this.dir = dir
  }
}

/**
 * 指令管理器
 */
class DirectiveManager {
  constructor() {
    this.directives = new Map()
    this.elementDirectives = new WeakMap()
  }
  
  // 注册指令
  register(name, directive) {
    if (typeof directive === 'function') {
      directive = { mounted: directive, updated: directive }
    }
    this.directives.set(name, new DirectiveDefinition(directive))
    console.log(`✅ 指令 ${name} 注册成功`)
  }
  
  // 应用指令到元素
  applyDirective(el, name, binding) {
    const directive = this.directives.get(name)
    if (!directive) {
      console.warn(`⚠️ 指令 ${name} 未找到`)
      return
    }
    
    // 保存指令实例
    if (!this.elementDirectives.has(el)) {
      this.elementDirectives.set(el, new Map())
    }
    
    const elementDirs = this.elementDirectives.get(el)
    elementDirs.set(name, { directive, binding })
    
    // 调用生命周期钩子
    this.callHook(directive, 'mounted', el, binding)
  }
  
  // 更新指令
  updateDirective(el, name, newBinding, oldBinding) {
    const elementDirs = this.elementDirectives.get(el)
    if (!elementDirs || !elementDirs.has(name)) return
    
    const { directive } = elementDirs.get(name)
    elementDirs.set(name, { directive, binding: newBinding })
    
    this.callHook(directive, 'updated', el, newBinding, oldBinding)
  }
  
  // 卸载指令
  unmountDirective(el, name) {
    const elementDirs = this.elementDirectives.get(el)
    if (!elementDirs || !elementDirs.has(name)) return
    
    const { directive, binding } = elementDirs.get(name)
    this.callHook(directive, 'unmounted', el, binding)
    
    elementDirs.delete(name)
    if (elementDirs.size === 0) {
      this.elementDirectives.delete(el)
    }
  }
  
  // 调用钩子函数
  callHook(directive, hookName, el, binding, oldBinding = null) {
    const hook = directive[hookName]
    if (hook) {
      try {
        hook(el, binding, null, oldBinding)
      } catch (error) {
        console.error(`❌ 指令钩子 ${hookName} 执行错误:`, error)
      }
    }
  }
}

// 创建全局指令管理器
const directiveManager = new DirectiveManager()

// ===== 2. 内置指令实现原理 =====

/**
 * v-show 指令实现
 */
const vShow = {
  beforeMount(el, { value }) {
    // 保存原始display值
    el._vod = el.style.display === 'none' ? '' : el.style.display
  },
  
  mounted(el, { value }) {
    setDisplay(el, value)
    console.log('🎯 v-show mounted:', { element: el.tagName, value })
  },
  
  updated(el, { value, oldValue }) {
    if (value !== oldValue) {
      setDisplay(el, value)
      console.log('🔄 v-show updated:', { element: el.tagName, value, oldValue })
    }
  }
}

function setDisplay(el, value) {
  el.style.display = value ? el._vod : 'none'
}

/**
 * v-if 指令编译结果模拟
 */
function renderConditional(condition, trueVNode, falseVNode = null) {
  console.log('🔀 条件渲染:', { condition, trueVNode: !!trueVNode, falseVNode: !!falseVNode })
  return condition ? trueVNode : falseVNode
}

/**
 * v-for 指令实现
 */
function renderList(source, renderItem) {
  console.log('📋 列表渲染:', { source, type: typeof source })
  
  let ret = []
  
  if (Array.isArray(source)) {
    // 数组渲染
    ret = new Array(source.length)
    for (let i = 0; i < source.length; i++) {
      ret[i] = renderItem(source[i], i)
    }
  } else if (typeof source === 'number') {
    // 数字渲染
    ret = new Array(source)
    for (let i = 0; i < source; i++) {
      ret[i] = renderItem(i + 1, i)
    }
  } else if (typeof source === 'object' && source !== null) {
    // 对象渲染
    const keys = Object.keys(source)
    ret = new Array(keys.length)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      ret[i] = renderItem(source[key], key, i)
    }
  }
  
  return ret
}

/**
 * v-model 指令实现
 */
const vModel = {
  mounted(el, { value, modifiers }) {
    const { lazy, number, trim } = modifiers
    
    // 确定事件类型
    const eventName = lazy ? 'change' : 'input'
    
    // 设置初始值
    if (el.type === 'checkbox') {
      el.checked = !!value
    } else if (el.type === 'radio') {
      el.checked = el.value === value
    } else {
      el.value = value ?? ''
    }
    
    // 创建事件处理器
    const handler = (e) => {
      let newValue = e.target.value
      
      // 应用修饰符
      if (trim) newValue = newValue.trim()
      if (number) newValue = Number(newValue)
      
      // 触发更新（在真实环境中会更新响应式数据）
      console.log('🔄 v-model 更新:', { oldValue: value, newValue })
      
      // 模拟触发组件更新
      if (el._modelCallback) {
        el._modelCallback(newValue)
      }
    }
    
    el.addEventListener(eventName, handler)
    el._modelHandler = handler
    
    console.log('📝 v-model mounted:', { 
      element: el.tagName, 
      type: el.type, 
      eventName, 
      modifiers 
    })
  },
  
  updated(el, { value, oldValue, modifiers }) {
    if (value !== oldValue) {
      if (el.type === 'checkbox') {
        el.checked = !!value
      } else if (el.type === 'radio') {
        el.checked = el.value === value
      } else {
        el.value = value ?? ''
      }
      console.log('🔄 v-model updated:', { oldValue, newValue: value })
    }
  },
  
  unmounted(el) {
    if (el._modelHandler) {
      el.removeEventListener('input', el._modelHandler)
      el.removeEventListener('change', el._modelHandler)
      delete el._modelHandler
    }
  }
}

// ===== 3. 自定义指令开发 =====

/**
 * v-focus 聚焦指令
 */
const vFocus = {
  mounted(el, { value = true }) {
    if (value && typeof el.focus === 'function') {
      // 使用 nextTick 确保DOM已渲染
      setTimeout(() => {
        el.focus()
        console.log('🎯 v-focus: 元素已聚焦')
      }, 0)
    }
  },
  
  updated(el, { value, oldValue }) {
    if (value !== oldValue && value && typeof el.focus === 'function') {
      el.focus()
      console.log('🎯 v-focus: 元素重新聚焦')
    }
  }
}

/**
 * v-permission 权限指令
 */
const vPermission = {
  mounted(el, { value, arg, modifiers }) {
    const { hide = false } = modifiers
    const hasPermission = checkPermission(value, arg)
    
    if (!hasPermission) {
      if (hide) {
        el.style.display = 'none'
        console.log('🚫 v-permission: 元素已隐藏 (无权限)')
      } else {
        el.remove()
        console.log('🚫 v-permission: 元素已移除 (无权限)')
      }
    } else {
      console.log('✅ v-permission: 权限验证通过')
    }
  },
  
  updated(el, { value, oldValue, arg, modifiers }) {
    if (value !== oldValue) {
      const { hide = false } = modifiers
      const hasPermission = checkPermission(value, arg)
      
      if (!hasPermission) {
        if (hide) {
          el.style.display = 'none'
        } else {
          el.remove()
        }
        console.log('🚫 v-permission: 权限更新，访问被拒绝')
      } else if (hide && el.style.display === 'none') {
        el.style.display = ''
        console.log('✅ v-permission: 权限更新，元素重新显示')
      }
    }
  }
}

// 模拟权限检查函数
function checkPermission(permission, context) {
  const userPermissions = ['read', 'write', 'admin'] // 模拟用户权限
  
  if (Array.isArray(permission)) {
    return permission.some(p => userPermissions.includes(p))
  }
  
  return userPermissions.includes(permission)
}

/**
 * v-loading 加载指令
 */
const vLoading = {
  mounted(el, { value, modifiers }) {
    const { fullscreen = false, lock = true } = modifiers
    
    el._loadingConfig = { fullscreen, lock }
    
    if (value) {
      showLoading(el, el._loadingConfig)
    }
  },
  
  updated(el, { value, oldValue }) {
    if (value !== oldValue) {
      if (value) {
        showLoading(el, el._loadingConfig)
      } else {
        hideLoading(el)
      }
    }
  },
  
  unmounted(el) {
    hideLoading(el)
  }
}

function showLoading(el, config) {
  const { fullscreen, lock } = config
  
  // 创建加载遮罩
  const mask = document.createElement('div')
  mask.className = 'loading-mask'
  mask.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <div class="loading-text">加载中...</div>
    </div>
  `
  
  // 设置样式
  Object.assign(mask.style, {
    position: fullscreen ? 'fixed' : 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '2000'
  })
  
  if (!fullscreen) {
    el.style.position = 'relative'
  }
  
  if (lock) {
    mask.style.pointerEvents = 'auto'
  }
  
  const target = fullscreen ? document.body : el
  target.appendChild(mask)
  
  el._loadingInstance = mask
  
  console.log('⏳ v-loading: 显示加载状态', { fullscreen, lock })
}

function hideLoading(el) {
  if (el._loadingInstance) {
    el._loadingInstance.remove()
    el._loadingInstance = null
    console.log('✅ v-loading: 隐藏加载状态')
  }
}

// 注册所有指令
directiveManager.register('show', vShow)
directiveManager.register('model', vModel)
directiveManager.register('focus', vFocus)
directiveManager.register('permission', vPermission)
directiveManager.register('loading', vLoading)

/**
 * 指令使用演示
 */
function demonstrateDirectives() {
  console.log('\n🚀 指令系统演示开始\n')
  
  // 创建测试元素
  const container = document.createElement('div')
  container.style.cssText = 'padding: 20px; margin: 20px; border: 1px solid #ccc;'
  document.body.appendChild(container)
  
  // 1. v-show 演示
  console.log('📌 1. v-show 指令演示')
  const showElement = document.createElement('div')
  showElement.textContent = 'v-show 测试元素'
  showElement.style.cssText = 'padding: 10px; background: #f0f0f0; margin: 5px;'
  container.appendChild(showElement)
  
  directiveManager.applyDirective(showElement, 'show', 
    new DirectiveBinding(true, null, null, {})
  )
  
  setTimeout(() => {
    directiveManager.updateDirective(showElement, 'show',
      new DirectiveBinding(false, true, null, {}),
      new DirectiveBinding(true, null, null, {})
    )
  }, 1000)
  
  setTimeout(() => {
    directiveManager.updateDirective(showElement, 'show',
      new DirectiveBinding(true, false, null, {}),
      new DirectiveBinding(false, true, null, {})
    )
  }, 2000)
  
  // 2. v-focus 演示
  console.log('\n📌 2. v-focus 指令演示')
  const inputElement = document.createElement('input')
  inputElement.type = 'text'
  inputElement.placeholder = 'v-focus 测试输入框'
  inputElement.style.cssText = 'padding: 5px; margin: 5px; display: block;'
  container.appendChild(inputElement)
  
  directiveManager.applyDirective(inputElement, 'focus',
    new DirectiveBinding(true, null, null, {})
  )
  
  console.log('\n✅ 指令系统演示完成!')
}

// 页面加载完成后运行演示
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demonstrateDirectives)
  } else {
    demonstrateDirectives()
  }
}

console.log('�� 第9章指令系统演示代码加载完成!') 