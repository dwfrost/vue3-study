# 第9章面试问题：指令系统与自定义指令

## 基础概念类 (⭐)

### 1. 什么是Vue指令？请解释指令的基本概念和作用

**考查点：** 基础概念理解

**参考答案：**
Vue指令是一种特殊的HTML属性，以`v-`开头，用于在模板中声明式地描述DOM元素的行为。

**核心特点：**
- **声明式编程**：通过指令描述"做什么"而不是"怎么做"
- **响应式绑定**：自动响应数据变化
- **生命周期管理**：提供完整的钩子函数

**基本语法：**
```html
<!-- 基本指令 -->
<div v-show="visible">内容</div>

<!-- 带参数指令 -->
<div v-bind:class="className">内容</div>

<!-- 带修饰符指令 -->
<button @click.prevent="handleClick">按钮</button>

<!-- 动态参数 -->
<div v-bind:[attributeName]="value">内容</div>
```

### 2. Vue3中指令有哪些生命周期钩子？分别在什么时候调用？

**考查点：** 指令生命周期理解

**参考答案：**
Vue3指令提供7个生命周期钩子：

```typescript
interface DirectiveHooks {
  created?    // 元素创建后，属性或事件监听器应用前
  beforeMount? // 元素挂载到父节点前
  mounted?    // 元素挂载到父节点后
  beforeUpdate? // 所在组件VNode更新前
  updated?    // 所在组件VNode及其子组件VNode更新后
  beforeUnmount? // 元素卸载前
  unmounted?  // 元素卸载后
}
```

**调用时机：**
- `created`: 仅调用一次，元素初次创建时
- `beforeMount/mounted`: 初次挂载时调用
- `beforeUpdate/updated`: 组件更新时调用
- `beforeUnmount/unmounted`: 元素移除时调用

### 3. v-if和v-show的区别是什么？性能上有什么差异？

**考查点：** 条件渲染原理和性能对比

**参考答案：**

**实现原理差异：**
- `v-if`: 控制元素是否渲染到DOM中
- `v-show`: 控制元素的CSS display属性

**编译结果对比：**
```javascript
// v-if 编译结果
function render() {
  return _ctx.show 
    ? _createElementVNode("div", null, "Content")
    : _createCommentVNode("v-if", true)
}

// v-show 编译结果  
function render() {
  return _withDirectives(_createElementVNode("div", null, "Content"), [
    [_vShow, _ctx.show]
  ])
}
```

**性能对比：**
- `v-if`: 切换开销高，初始渲染开销低
- `v-show`: 切换开销低，初始渲染开销高

**使用场景：**
- 频繁切换使用`v-show`
- 条件很少改变使用`v-if`

## 内置指令实现类 (⭐⭐)

### 4. v-model是如何实现双向绑定的？在不同表单元素上有什么区别？

**考查点：** v-model实现原理和表单处理

**参考答案：**

**实现原理：**
v-model是语法糖，结合了属性绑定和事件监听：

```javascript
// 模板: <input v-model="message" />
// 等价于:
<input 
  :value="message" 
  @input="message = $event.target.value"
/>
```

**不同表单元素的处理：**

```javascript
// text/textarea - 使用value属性和input事件
<input v-model="text" />
// 编译为:
<input :value="text" @input="text = $event.target.value" />

// checkbox - 使用checked属性和change事件
<input type="checkbox" v-model="checked" />
// 编译为:
<input :checked="checked" @change="checked = $event.target.checked" />

// radio - 使用checked属性和change事件
<input type="radio" value="option1" v-model="selected" />
// 编译为:
<input :checked="selected === 'option1'" @change="selected = $event.target.value" />

// select - 使用value属性和change事件
<select v-model="selected">
  <option value="a">A</option>
</select>
```

**修饰符处理：**
- `.lazy`: 使用change事件代替input事件
- `.number`: 自动将输入转换为数字类型
- `.trim`: 自动过滤首尾空白字符

### 5. v-for指令是如何实现列表渲染的？key的作用是什么？

**考查点：** 列表渲染原理和diff算法

**参考答案：**

**实现原理：**
```javascript
// 模板
<li v-for="(item, index) in list" :key="item.id">
  {{ item.name }}
</li>

// 编译结果
function render() {
  return (_openBlock(true), _createElementBlock(_Fragment, null, 
    _renderList(_ctx.list, (item, index) => {
      return (_openBlock(), _createElementBlock("li", {
        key: item.id
      }, _toDisplayString(item.name), 1))
    }), 128))
}

// _renderList 实现
export function renderList(source, renderItem) {
  let ret
  if (isArray(source)) {
    ret = new Array(source.length)
    for (let i = 0; i < source.length; i++) {
      ret[i] = renderItem(source[i], i)
    }
  }
  // ... 处理其他类型
  return ret
}
```

**key的作用：**
1. **唯一标识**：为每个节点提供唯一标识
2. **优化diff**：帮助diff算法识别节点变化
3. **复用元素**：相同key的元素会被复用而不是重新创建

**key选择原则：**
- 使用稳定、唯一、可预测的值
- 避免使用index作为key（数组顺序变化时有问题）
- 推荐使用数据的唯一id

## 自定义指令开发类 (⭐⭐⭐)

### 6. 如何开发一个自定义指令？请实现一个v-focus指令

**考查点：** 自定义指令开发能力

**参考答案：**

```typescript
// 指令定义
const vFocus = {
  // 元素挂载后自动聚焦
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    if (binding.value !== false) {
      el.focus()
    }
  },
  
  // 绑定值更新时重新处理聚焦
  updated(el: HTMLElement, binding: DirectiveBinding) {
    if (binding.value && !binding.oldValue) {
      el.focus()
    }
  }
}

// 全局注册
app.directive('focus', vFocus)

// 局部注册
export default {
  directives: {
    focus: vFocus
  }
}

// 使用方式
<input v-focus />                    // 自动聚焦
<input v-focus="shouldFocus" />      // 条件聚焦
```

**进阶实现（支持延迟聚焦）：**
```typescript
const vFocus = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const { value, modifiers } = binding
    const delay = modifiers.delay ? 100 : 0
    
    if (value !== false) {
      setTimeout(() => el.focus(), delay)
    }
  }
}

// 使用：<input v-focus.delay="true" />
```

### 7. 请实现一个v-permission权限指令

**考查点：** 实际业务场景的指令开发

**参考答案：**

```typescript
// 权限检查函数
function hasPermission(permission: string | string[]): boolean {
  const userPermissions = store.getters.permissions // 从状态管理获取权限
  
  if (Array.isArray(permission)) {
    return permission.some(p => userPermissions.includes(p))
  }
  
  return userPermissions.includes(permission)
}

// 权限指令实现
const vPermission = {
  mounted(el: Element, binding: DirectiveBinding) {
    const { value, modifiers } = binding
    const { hide } = modifiers
    
    if (!hasPermission(value)) {
      if (hide) {
        // 隐藏元素
        el.style.display = 'none'
      } else {
        // 移除元素
        el.parentNode?.removeChild(el)
      }
    }
  },
  
  updated(el: Element, binding: DirectiveBinding) {
    const { value, oldValue, modifiers } = binding
    
    if (value !== oldValue) {
      const { hide } = modifiers
      const permitted = hasPermission(value)
      
      if (!permitted) {
        if (hide) {
          el.style.display = 'none'
        } else {
          el.parentNode?.removeChild(el)
        }
      } else if (hide && el.style.display === 'none') {
        el.style.display = ''
      }
    }
  }
}

// 使用方式
<button v-permission="'admin'">管理员功能</button>
<div v-permission.hide="['admin', 'editor']">编辑功能</div>
```

### 8. 请实现一个v-loading加载指令

**考查点：** 复杂指令的设计和实现

**参考答案：**

```typescript
interface LoadingOptions {
  text?: string
  background?: string
  size?: 'small' | 'medium' | 'large'
}

const vLoading = {
  mounted(el: Element, binding: DirectiveBinding<boolean | LoadingOptions>) {
    createLoadingElement(el, binding)
  },
  
  updated(el: Element, binding: DirectiveBinding<boolean | LoadingOptions>) {
    const { value, oldValue } = binding
    
    if (value !== oldValue) {
      if (value) {
        showLoading(el, binding)
      } else {
        hideLoading(el)
      }
    }
  },
  
  unmounted(el: Element) {
    hideLoading(el)
  }
}

function createLoadingElement(el: Element, binding: DirectiveBinding) {
  const { value, modifiers } = binding
  const { fullscreen } = modifiers
  
  // 创建loading遮罩
  const mask = document.createElement('div')
  mask.className = 'v-loading-mask'
  
  // 创建loading内容
  const spinner = document.createElement('div')
  spinner.className = 'v-loading-spinner'
  
  const text = document.createElement('div')
  text.className = 'v-loading-text'
  text.textContent = getLoadingText(binding)
  
  mask.appendChild(spinner)
  mask.appendChild(text)
  
  // 设置样式
  setLoadingStyle(mask, el, fullscreen)
  
  // 保存loading实例
  el._loadingInstance = {
    mask,
    originalPosition: el.style.position
  }
  
  if (value) {
    showLoading(el, binding)
  }
}

function showLoading(el: Element, binding: DirectiveBinding) {
  const { modifiers } = binding
  const { fullscreen } = modifiers
  const instance = el._loadingInstance
  
  if (!instance) return
  
  // 设置父元素定位
  if (!fullscreen && el.style.position === '') {
    el.style.position = 'relative'
  }
  
  // 添加遮罩
  const target = fullscreen ? document.body : el
  target.appendChild(instance.mask)
}

function hideLoading(el: Element) {
  const instance = el._loadingInstance
  if (!instance) return
  
  // 移除遮罩
  if (instance.mask.parentNode) {
    instance.mask.parentNode.removeChild(instance.mask)
  }
  
  // 恢复原始样式
  if (instance.originalPosition !== undefined) {
    el.style.position = instance.originalPosition
  }
}

// CSS样式（需要在全局样式中定义）
const loadingStyles = `
.v-loading-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.v-loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #409EFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`

// 使用方式
<div v-loading="isLoading">内容区域</div>
<div v-loading.fullscreen="isLoading">全屏加载</div>
```

## 性能优化类 (⭐⭐⭐)

### 9. 指令在编译时和运行时是如何优化的？

**考查点：** 深度理解和性能优化

**参考答案：**

**编译时优化：**

1. **静态提升**：
```javascript
// 模板
<div>
  <p v-once>{{ expensive() }}</p>
  <span v-text="staticText"></span>
</div>

// 优化后 - 静态内容被提升
const _hoisted_1 = _createElementVNode("span", null, "Static Text")

function render() {
  return _createElementVNode("div", null, [
    _createElementVNode("p", null, _toDisplayString(_ctx.expensive()), 1),
    _hoisted_1
  ])
}
```

2. **预字符串化**：
```javascript
// 大量静态内容会被预字符串化
const _hoisted_1 = _createStaticVNode(
  "<div><p>Static 1</p><p>Static 2</p><p>Static 3</p></div>"
)
```

3. **死代码消除**：
```javascript
// v-if 条件为静态值时
// <div v-if="true">Content</div>
// 编译时直接输出内容，移除条件判断
```

**运行时优化：**

1. **指令缓存**：
```javascript
const directiveCache = new WeakMap()

function applyDirective(el, directive, binding) {
  let instance = directiveCache.get(el)
  if (!instance) {
    instance = createDirectiveInstance(directive)
    directiveCache.set(el, instance)
  }
  instance.update(binding)
}
```

2. **批量更新**：
```javascript
class DirectiveBatcher {
  private pendingDirectives = new Set()
  
  schedule(directive) {
    this.pendingDirectives.add(directive)
    nextTick(() => this.flush())
  }
  
  flush() {
    for (const directive of this.pendingDirectives) {
      directive.flush()
    }
    this.pendingDirectives.clear()
  }
}
```

### 10. 如何调试和测试自定义指令？

**考查点：** 工程化能力和调试技巧

**参考答案：**

**调试技巧：**

1. **开发时调试**：
```typescript
const vDebug = {
  created(el, binding) {
    console.log('Directive created:', { el, binding })
  },
  mounted(el, binding) {
    console.log('Directive mounted:', { el, binding })
    // 在元素上添加调试信息
    el.dataset.directiveDebug = JSON.stringify(binding)
  },
  updated(el, binding) {
    console.log('Directive updated:', { 
      el, 
      newBinding: binding, 
      changed: binding.value !== binding.oldValue 
    })
  }
}
```

2. **Vue DevTools**：
```javascript
// 使用Vue DevTools的自定义检查器
if (__DEV__) {
  app.config.globalProperties.$inspectDirective = function(directiveName) {
    // 检查指令状态
    return this.$el._directives?.[directiveName]
  }
}
```

**单元测试：**

```typescript
// 使用 @vue/test-utils 测试指令
import { mount } from '@vue/test-utils'
import { vFocus } from '@/directives'

describe('v-focus directive', () => {
  it('should focus element on mount', () => {
    const wrapper = mount({
      template: '<input v-focus />',
      directives: { focus: vFocus }
    })
    
    const input = wrapper.find('input').element
    expect(document.activeElement).toBe(input)
  })
  
  it('should focus when value becomes true', async () => {
    const wrapper = mount({
      template: '<input v-focus="shouldFocus" />',
      directives: { focus: vFocus },
      data() {
        return { shouldFocus: false }
      }
    })
    
    await wrapper.setData({ shouldFocus: true })
    
    const input = wrapper.find('input').element
    expect(document.activeElement).toBe(input)
  })
})
```

**E2E测试：**

```javascript
// 使用 Cypress 进行端到端测试
describe('Custom Directives', () => {
  it('should apply loading directive correctly', () => {
    cy.visit('/test-page')
    cy.get('[data-testid="loading-area"]').should('be.visible')
    cy.get('.v-loading-mask').should('not.exist')
    
    cy.get('[data-testid="toggle-loading"]').click()
    cy.get('.v-loading-mask').should('be.visible')
    cy.get('.v-loading-spinner').should('be.visible')
    
    cy.get('[data-testid="toggle-loading"]').click()
    cy.get('.v-loading-mask').should('not.exist')
  })
})
```

## 总结

第9章的核心知识点：

1. **基础概念**：指令的定义、分类、生命周期
2. **内置指令**：v-if/v-show、v-for、v-model等的实现原理
3. **自定义指令**：开发方法、最佳实践、常见模式
4. **性能优化**：编译时和运行时的优化策略
5. **工程化**：调试、测试、类型安全等

**面试重点：**
- 深入理解指令的实现原理
- 能够开发复杂的自定义指令
- 了解性能优化的具体方法
- 具备工程化开发和调试能力 