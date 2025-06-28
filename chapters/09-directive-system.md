# 第9章：指令系统与自定义指令

## 本章概述

Vue3的指令系统是模板语法的核心组成部分，提供了一套声明式的DOM操作方案。本章将深入探讨指令的设计原理、内置指令的实现机制、自定义指令的开发以及指令在编译过程中的处理流程。

## 学习目标

- 理解Vue3指令系统的设计理念和架构
- 掌握内置指令的实现原理（v-if、v-for、v-model等）
- 学会开发和使用自定义指令
- 了解指令的编译过程和优化策略
- 掌握指令的生命周期和钩子函数

## 9.1 指令系统架构

### 9.1.1 指令的设计理念

Vue指令遵循**声明式编程**的理念，提供了简洁的语法来描述DOM的行为：

```typescript
// 指令的核心概念
interface Directive {
  // 指令名称
  name: string
  
  // 指令值
  value: any
  
  // 指令参数
  arg?: string
  
  // 指令修饰符
  modifiers: Record<string, boolean>
  
  // 指令表达式
  expression: string
}

// 示例：v-on:click.prevent="handleClick"
// name: 'on'
// arg: 'click'
// modifiers: { prevent: true }
// value: handleClick函数
// expression: 'handleClick'
```

### 9.1.2 指令分类

```typescript
// 1. 内置指令 - Vue核心指令
const builtInDirectives = {
  'v-if': vIf,
  'v-else': vElse,
  'v-else-if': vElseIf,
  'v-for': vFor,
  'v-on': vOn,
  'v-bind': vBind,
  'v-model': vModel,
  'v-show': vShow,
  'v-html': vHtml,
  'v-text': vText,
  'v-pre': vPre,
  'v-once': vOnce,
  'v-memo': vMemo,
  'v-cloak': vCloak
}

// 2. 自定义指令 - 用户定义
const customDirectives = {
  'v-focus': vFocus,
  'v-permission': vPermission,
  'v-loading': vLoading
}
```

### 9.1.3 指令处理流程

```javascript
// 指令处理的完整流程
function processDirectives(el, context) {
  const { props, directives } = el
  
  // 1. 提取指令信息
  const directiveList = extractDirectives(props)
  
  // 2. 转换指令
  directiveList.forEach(directive => {
    const transform = getDirectiveTransform(directive.name)
    if (transform) {
      // 编译时转换
      transform(directive, el, context)
    } else {
      // 运行时指令
      addRuntimeDirective(el, directive)
    }
  })
  
  // 3. 优化处理
  optimizeDirectives(el, context)
}
```

## 9.2 内置指令深度解析

### 9.2.1 条件渲染指令 (v-if/v-else/v-show)

```typescript
// v-if 指令的实现原理
export const transformIf = (node: ElementNode, context: TransformContext) => {
  if (node.type === NodeTypes.ELEMENT) {
    const ifProp = findProp(node, 'if')
    if (ifProp) {
      // 创建条件节点
      const branch = createConditionalBranch(node, ifProp)
      const ifNode = createIfNode([branch])
      
      // 处理 v-else-if 和 v-else
      processElseBranches(ifNode, context)
      
      // 替换原节点
      context.replaceNode(ifNode)
    }
  }
}

// 编译结果对比
// 模板
`<div v-if="show">Content</div>`

// 编译后
function render() {
  return _ctx.show 
    ? _createElementVNode("div", null, "Content")
    : _createCommentVNode("v-if", true)
}

// v-show 的实现
export const vShow = {
  beforeMount(el: Element, { value }: DirectiveBinding) {
    el._vod = el.style.display === 'none' ? '' : el.style.display
  },
  mounted(el: Element, { value }: DirectiveBinding) {
    setDisplay(el, value)
  },
  updated(el: Element, { value }: DirectiveBinding) {
    setDisplay(el, value)
  }
}

function setDisplay(el: Element, value: unknown): void {
  el.style.display = value ? el._vod : 'none'
}
```

### 9.2.2 列表渲染指令 (v-for)

```typescript
// v-for 指令的转换逻辑
export const transformFor = (node: ElementNode, context: TransformContext) => {
  const forProp = findProp(node, 'for')
  if (!forProp || forProp.type !== NodeTypes.DIRECTIVE) return
  
  // 解析 v-for 表达式
  const parseResult = parseForExpression(forProp.exp)
  if (!parseResult) return
  
  const { source, value, key, index } = parseResult
  
  // 创建 FOR 节点
  const forNode = createForNode({
    source,
    valueAlias: value,
    keyAlias: key,
    indexAlias: index,
    children: [node]
  })
  
  context.replaceNode(forNode)
}

// v-for 的编译示例
// 模板
`<li v-for="(item, index) in list" :key="item.id">
  {{ item.name }}
</li>`

// 编译后
function render() {
  return (_openBlock(true), _createElementBlock(_Fragment, null, 
    _renderList(_ctx.list, (item, index) => {
      return (_openBlock(), _createElementBlock("li", {
        key: item.id
      }, _toDisplayString(item.name), 1))
    }), 128))
}

// _renderList 的实现
export function renderList(
  source: any,
  renderItem: (value: any, key: any, index?: number) => VNode
): VNode[] {
  let ret: VNode[]
  
  if (isArray(source) || isString(source)) {
    ret = new Array(source.length)
    for (let i = 0; i < source.length; i++) {
      ret[i] = renderItem(source[i], i)
    }
  } else if (typeof source === 'number') {
    ret = new Array(source)
    for (let i = 0; i < source; i++) {
      ret[i] = renderItem(i + 1, i)
    }
  } else if (isObject(source)) {
    if (source[Symbol.iterator]) {
      ret = Array.from(source as Iterable<any>, renderItem)
    } else {
      const keys = Object.keys(source)
      ret = new Array(keys.length)
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        ret[i] = renderItem(source[key], key, i)
      }
    }
  } else {
    ret = []
  }
  
  return ret
}
```

### 9.2.3 事件绑定指令 (v-on)

```typescript
// v-on 指令的转换
export const transformOn = (dir: DirectiveNode, node: ElementNode, context: TransformContext) => {
  const { arg, exp, modifiers } = dir
  
  // 处理事件名称
  let eventName: string
  if (arg) {
    if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
      eventName = arg.content
    } else {
      // 动态事件名 @[eventName]="handler"
      eventName = arg
    }
  }
  
  // 处理修饰符
  let handler = exp
  if (modifiers.length) {
    handler = wrapHandler(handler, modifiers)
  }
  
  // 添加事件属性
  const prop = createObjectProperty(
    createSimpleExpression(toHandlerKey(eventName)),
    handler
  )
  
  node.props.push(prop)
}

// 修饰符处理
function wrapHandler(handler: Expression, modifiers: string[]) {
  let wrapper = handler
  
  // .prevent 修饰符
  if (modifiers.includes('prevent')) {
    wrapper = createCompoundExpression([
      `($event) => { $event.preventDefault(); `,
      wrapper,
      `($event) }`
    ])
  }
  
  // .stop 修饰符
  if (modifiers.includes('stop')) {
    wrapper = createCompoundExpression([
      `($event) => { $event.stopPropagation(); `,
      wrapper,
      `($event) }`
    ])
  }
  
  // .once 修饰符
  if (modifiers.includes('once')) {
    wrapper = createCallExpression('withOnce', [wrapper])
  }
  
  return wrapper
}

// 事件修饰符示例
// 模板: @click.prevent.stop="handleClick"
// 编译后:
onClick: ($event) => {
  $event.preventDefault()
  $event.stopPropagation()
  return _ctx.handleClick($event)
}
```

### 9.2.4 双向绑定指令 (v-model)

```typescript
// v-model 的转换逻辑
export const transformModel = (dir: DirectiveNode, node: ElementNode, context: TransformContext) => {
  const { exp, arg, modifiers } = dir
  const tag = node.tag
  
  // 根据元素类型选择不同的处理方式
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    transformModelOnElement(dir, node, context)
  } else {
    // 组件上的 v-model
    transformModelOnComponent(dir, node, context)
  }
}

// 表单元素的 v-model
function transformModelOnElement(dir: DirectiveNode, node: ElementNode, context: TransformContext) {
  const { exp, modifiers } = dir
  const tag = node.tag
  const type = findProp(node, 'type')
  
  let eventName: string
  let valueName: string
  
  // 根据元素类型确定事件和属性
  if (tag === 'input' && type?.value === 'checkbox') {
    eventName = 'change'
    valueName = 'checked'
  } else if (tag === 'input' && type?.value === 'radio') {
    eventName = 'change'
    valueName = 'checked'
  } else {
    eventName = modifiers.includes('lazy') ? 'change' : 'input'
    valueName = 'value'
  }
  
  // 添加 value 属性
  node.props.push(createObjectProperty(
    createSimpleExpression(valueName),
    exp
  ))
  
  // 添加事件监听器
  const handler = createCompoundExpression([
    `$event => (`,
    exp,
    ` = $event.target.${valueName})`
  ])
  
  node.props.push(createObjectProperty(
    createSimpleExpression(toHandlerKey(eventName)),
    handler
  ))
}

// 组件上的 v-model
function transformModelOnComponent(dir: DirectiveNode, node: ElementNode, context: TransformContext) {
  const { exp, arg } = dir
  const propName = arg?.content || 'modelValue'
  const eventName = `onUpdate:${propName}`
  
  // 添加 props
  node.props.push(createObjectProperty(
    createSimpleExpression(propName),
    exp
  ))
  
  // 添加事件处理器
  node.props.push(createObjectProperty(
    createSimpleExpression(eventName),
    createCompoundExpression([
      `$event => (`,
      exp,
      ` = $event)`
    ])
  ))
}

// v-model 编译示例
// 模板: <input v-model="message" />
// 编译后:
h('input', {
  value: _ctx.message,
  onInput: $event => (_ctx.message = $event.target.value)
})

// 组件 v-model: <MyComponent v-model="value" />
// 编译后:
h(MyComponent, {
  modelValue: _ctx.value,
  'onUpdate:modelValue': $event => (_ctx.value = $event)
})
```

## 9.3 自定义指令开发

### 9.3.1 指令生命周期

```typescript
// 指令对象的完整接口
interface DirectiveHooks {
  // 指令绑定到元素前调用
  created?(el: Element, binding: DirectiveBinding, vnode: VNode, prevVNode: VNode | null): void
  
  // 指令绑定到元素前调用
  beforeMount?(el: Element, binding: DirectiveBinding, vnode: VNode, prevVNode: VNode | null): void
  
  // 指令绑定到元素后调用
  mounted?(el: Element, binding: DirectiveBinding, vnode: VNode, prevVNode: VNode | null): void
  
  // 包含指令的组件更新前调用
  beforeUpdate?(el: Element, binding: DirectiveBinding, vnode: VNode, prevVNode: VNode): void
  
  // 包含指令的组件更新后调用
  updated?(el: Element, binding: DirectiveBinding, vnode: VNode, prevVNode: VNode): void
  
  // 指令从元素上解绑前调用
  beforeUnmount?(el: Element, binding: DirectiveBinding, vnode: VNode, prevVNode: VNode | null): void
  
  // 指令从元素上解绑后调用
  unmounted?(el: Element, binding: DirectiveBinding, vnode: VNode, prevVNode: VNode | null): void
}

// 指令绑定对象
interface DirectiveBinding {
  value: any           // 指令绑定值
  oldValue: any        // 上一个绑定值
  arg?: string         // 指令参数
  modifiers: Record<string, boolean>  // 修饰符对象
  instance: ComponentInternalInstance | null  // 组件实例
  dir: Directive       // 指令定义对象
}
```

### 9.3.2 自定义指令示例

```typescript
// 1. 焦点指令
const vFocus = {
  mounted(el: HTMLElement) {
    el.focus()
  },
  updated(el: HTMLElement, { value }: DirectiveBinding) {
    if (value) {
      el.focus()
    }
  }
}

// 使用方式
// <input v-focus />
// <input v-focus="shouldFocus" />

// 2. 权限指令
const vPermission = {
  mounted(el: Element, { value }: DirectiveBinding) {
    const permissions = getUserPermissions()
    if (!permissions.includes(value)) {
      el.remove()
    }
  },
  updated(el: Element, { value, oldValue }: DirectiveBinding) {
    if (value !== oldValue) {
      const permissions = getUserPermissions()
      if (!permissions.includes(value)) {
        el.remove()
      }
    }
  }
}

// 使用方式
// <button v-permission="'admin'">删除</button>

// 3. 加载指令
const vLoading = {
  mounted(el: Element, { value }: DirectiveBinding) {
    el._loadingInstance = null
    if (value) {
      showLoading(el)
    }
  },
  updated(el: Element, { value, oldValue }: DirectiveBinding) {
    if (value !== oldValue) {
      if (value) {
        showLoading(el)
      } else {
        hideLoading(el)
      }
    }
  },
  unmounted(el: Element) {
    hideLoading(el)
  }
}

function showLoading(el: Element) {
  const loading = document.createElement('div')
  loading.className = 'loading-mask'
  loading.innerHTML = '<div class="loading-spinner"></div>'
  
  el.style.position = 'relative'
  el.appendChild(loading)
  el._loadingInstance = loading
}

function hideLoading(el: Element) {
  if (el._loadingInstance) {
    el._loadingInstance.remove()
    el._loadingInstance = null
  }
}

// 使用方式
// <div v-loading="isLoading">内容</div>

// 4. 复杂的拖拽指令
const vDraggable = {
  mounted(el: HTMLElement, { value, modifiers }: DirectiveBinding) {
    let isDragging = false
    let startX = 0
    let startY = 0
    let initialX = 0
    let initialY = 0
    
    const options = {
      axis: modifiers.x ? 'x' : modifiers.y ? 'y' : 'both',
      disabled: false,
      ...value
    }
    
    const onMouseDown = (e: MouseEvent) => {
      if (options.disabled) return
      
      isDragging = true
      startX = e.clientX
      startY = e.clientY
      
      const rect = el.getBoundingClientRect()
      initialX = rect.left
      initialY = rect.top
      
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      
      el.style.cursor = 'grabbing'
      e.preventDefault()
    }
    
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      
      const deltaX = e.clientX - startX
      const deltaY = e.clientY - startY
      
      let newX = initialX + deltaX
      let newY = initialY + deltaY
      
      if (options.axis === 'x') {
        el.style.left = `${newX}px`
      } else if (options.axis === 'y') {
        el.style.top = `${newY}px`
      } else {
        el.style.left = `${newX}px`
        el.style.top = `${newY}px`
      }
      
      // 触发拖拽事件
      if (options.onDrag) {
        options.onDrag({ x: newX, y: newY, deltaX, deltaY })
      }
    }
    
    const onMouseUp = () => {
      isDragging = false
      el.style.cursor = 'grab'
      
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      
      if (options.onDragEnd) {
        options.onDragEnd()
      }
    }
    
    el.addEventListener('mousedown', onMouseDown)
    el.style.cursor = 'grab'
    el.style.position = 'absolute'
    
    // 保存清理函数
    el._dragCleanup = () => {
      el.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  },
  
  beforeUnmount(el: HTMLElement) {
    if (el._dragCleanup) {
      el._dragCleanup()
    }
  }
}

// 使用方式
// <div v-draggable>可拖拽元素</div>
// <div v-draggable.x="{ onDrag: handleDrag }">水平拖拽</div>
```

### 9.3.3 指令注册与使用

```typescript
// 全局注册指令
const app = createApp(App)

app.directive('focus', vFocus)
app.directive('permission', vPermission)
app.directive('loading', vLoading)
app.directive('draggable', vDraggable)

// 局部注册指令
export default {
  directives: {
    focus: vFocus,
    permission: vPermission
  },
  template: `
    <input v-focus />
    <button v-permission="'admin'">删除</button>
  `
}

// 组合式API中使用指令
import { vFocus } from './directives'

export default {
  setup() {
    return {
      // 指令需要以v开头
      vFocus
    }
  }
}
```

## 9.4 指令编译优化

### 9.4.1 编译时优化

```typescript
// 静态提升
// 模板
`<div>
  <span v-once>{{ expensive() }}</span>
  <p v-text="staticText"></p>
</div>`

// 优化后 - 静态内容被提升
const _hoisted_1 = /*#__PURE__*/ _createElementVNode("p", null, "Static Text")

function render() {
  return _createElementVNode("div", null, [
    _createElementVNode("span", null, _toDisplayString(_ctx.expensive()), 1),
    _hoisted_1
  ])
}

// 预字符串化
// 大量静态内容会被预字符串化
const _hoisted_1 = /*#__PURE__*/ _createStaticVNode(
  "<div><p>Static 1</p><p>Static 2</p><p>Static 3</p></div>"
)
```

### 9.4.2 运行时优化

```typescript
// 缓存指令实例
const directiveCache = new WeakMap()

function applyDirective(el: Element, directive: Directive, binding: DirectiveBinding) {
  let instance = directiveCache.get(el)
  
  if (!instance) {
    instance = createDirectiveInstance(directive, el)
    directiveCache.set(el, instance)
  }
  
  instance.update(binding)
}

// 批量更新指令
class DirectiveBatcher {
  private pendingDirectives = new Set<DirectiveInstance>()
  private isFlushPending = false
  
  schedule(directive: DirectiveInstance) {
    this.pendingDirectives.add(directive)
    
    if (!this.isFlushPending) {
      this.isFlushPending = true
      Promise.resolve().then(() => this.flush())
    }
  }
  
  flush() {
    for (const directive of this.pendingDirectives) {
      directive.flush()
    }
    
    this.pendingDirectives.clear()
    this.isFlushPending = false
  }
}
```

## 9.5 指令系统最佳实践

### 9.5.1 设计原则

```typescript
// 1. 单一职责 - 一个指令只做一件事
// ❌ 不好的设计
const vBadDirective = {
  mounted(el, { value }) {
    // 处理样式
    el.style.color = value.color
    // 处理事件
    el.addEventListener('click', value.onClick)
    // 处理验证
    validateElement(el, value.rules)
  }
}

// ✅ 好的设计
const vColor = {
  mounted(el, { value }) {
    el.style.color = value
  }
}

const vValidate = {
  mounted(el, { value }) {
    validateElement(el, value)
  }
}

// 2. 可组合性 - 指令应该可以组合使用
// <input v-model="value" v-validate="rules" v-debounce="300" />

// 3. 性能考虑 - 避免频繁DOM操作
const vOptimized = {
  mounted(el, { value }) {
    // 缓存DOM查询结果
    el._cachedElements = el.querySelectorAll('.item')
  },
  updated(el, { value, oldValue }) {
    // 只在值实际改变时更新
    if (value !== oldValue) {
      updateElement(el, value)
    }
  }
}
```

### 9.5.2 测试策略

```typescript
// 指令测试示例
import { mount } from '@vue/test-utils'
import { vFocus } from '@/directives'

describe('v-focus directive', () => {
  it('should focus element on mount', () => {
    const wrapper = mount({
      template: '<input v-focus />',
      directives: { focus: vFocus }
    })
    
    const input = wrapper.find('input').element as HTMLInputElement
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
    
    const input = wrapper.find('input').element as HTMLInputElement
    expect(document.activeElement).toBe(input)
  })
})
```

### 9.5.3 类型安全

```typescript
// 为自定义指令添加类型定义
declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    vFocus: typeof vFocus
    vPermission: typeof vPermission
    vLoading: typeof vLoading
  }
}

// 指令值的类型定义
interface LoadingDirectiveBinding {
  value: boolean
  modifiers: {
    fullscreen?: boolean
    lock?: boolean
  }
}

const vLoading: Directive<Element, boolean> = {
  mounted(el, binding: LoadingDirectiveBinding) {
    // 类型安全的实现
  }
}
```

## 9.6 本章总结

### 9.6.1 核心要点

1. **指令系统架构**：
   - 声明式编程理念
   - 编译时 + 运行时处理
   - 完整的生命周期钩子

2. **内置指令原理**：
   - v-if/v-show：条件渲染的不同策略
   - v-for：列表渲染和key优化
   - v-on：事件绑定和修饰符处理
   - v-model：双向绑定的语法糖

3. **自定义指令开发**：
   - 生命周期钩子的合理使用
   - 性能优化和内存管理
   - 可复用性和组合性设计

4. **编译优化**：
   - 静态提升
   - 指令缓存
   - 批量更新

### 9.6.2 最佳实践

- 遵循单一职责原则
- 注意性能和内存泄漏
- 提供完整的类型支持
- 编写充分的测试用例
- 保持API的简洁和一致性

### 9.6.3 进阶方向

- 学习Vue DevTools中的指令调试
- 深入理解指令的编译过程
- 研究复杂指令的设计模式
- 探索指令与组件的结合使用

通过本章学习，你应该已经掌握了Vue3指令系统的完整知识体系，能够熟练使用内置指令并开发高质量的自定义指令。 