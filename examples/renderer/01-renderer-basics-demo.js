/**
 * Vue3渲染器系统基础架构演示
 * 
 * 本示例演示了：
 * 1. 简单渲染器的实现
 * 2. 虚拟DOM的创建和处理
 * 3. 挂载和更新过程
 * 4. 组件渲染基础
 * 5. 性能优化策略
 */

// ==================== 1. 基础工具函数 ====================

// VNode类型常量
const NodeTypes = {
  TEXT: 'text',
  ELEMENT: 'element',
  COMPONENT: 'component',
  FRAGMENT: 'fragment'
}

// ShapeFlag枚举（简化版）
const ShapeFlags = {
  ELEMENT: 1,           // 0001
  TEXT_CHILDREN: 8,     // 1000
  ARRAY_CHILDREN: 16,   // 10000
  COMPONENT: 6          // 0110
}

// PatchFlag枚举（简化版）
const PatchFlags = {
  TEXT: 1,    // 动态文本
  CLASS: 2,   // 动态class
  STYLE: 4,   // 动态style
  PROPS: 8    // 动态props
}

// 工具函数
function isString(val) {
  return typeof val === 'string'
}

function isArray(val) {
  return Array.isArray(val)
}

function isObject(val) {
  return val !== null && typeof val === 'object'
}

// ==================== 2. 虚拟DOM创建函数 ====================

/**
 * 创建虚拟DOM节点
 * @param {string|Object} type - 节点类型
 * @param {Object} props - 属性对象
 * @param {string|Array} children - 子节点
 * @param {number} patchFlag - 补丁标记
 */
function createVNode(type, props = null, children = null, patchFlag = 0) {
  // 确定shapeFlag
  let shapeFlag = 0
  if (isString(type)) {
    shapeFlag = ShapeFlags.ELEMENT
  } else if (isObject(type)) {
    shapeFlag = ShapeFlags.COMPONENT
  }

  // 处理子节点的shapeFlag
  if (isString(children)) {
    shapeFlag |= ShapeFlags.TEXT_CHILDREN
  } else if (isArray(children)) {
    shapeFlag |= ShapeFlags.ARRAY_CHILDREN
  }

  const vnode = {
    type,
    props,
    children,
    key: props?.key || null,
    ref: props?.ref || null,
    el: null,        // 对应的真实DOM
    component: null, // 组件实例
    shapeFlag,
    patchFlag,
    dynamicProps: null,
    __v_isVNode: true
  }

  // 标准化children
  normalizeChildren(vnode, children)

  return vnode
}

/**
 * 标准化子节点
 */
function normalizeChildren(vnode, children) {
  let type = 0
  if (children == null) {
    children = null
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else if (isObject(children)) {
    // 插槽等复杂情况
    type = ShapeFlags.SLOTS_CHILDREN
  } else if (typeof children === 'function') {
    // 函数式子节点
    children = { default: children, _ctx: currentRenderingInstance }
    type = ShapeFlags.SLOTS_CHILDREN
  } else {
    // 文本子节点
    children = String(children)
    type = ShapeFlags.TEXT_CHILDREN
  }

  vnode.children = children
  vnode.shapeFlag |= type
}

// 创建文本节点
function createTextVNode(text) {
  return createVNode(NodeTypes.TEXT, null, text)
}

// 辅助函数：h函数（hyperscript）
function h(type, propsOrChildren, children) {
  const l = arguments.length
  if (l === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // h('div', { id: 'foo' })
      return createVNode(type, propsOrChildren)
    } else {
      // h('div', 'hello')
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    if (l > 3) {
      children = Array.prototype.slice.call(arguments, 2)
    } else if (l === 3 && isVNode(children)) {
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}

function isVNode(value) {
  return value ? value.__v_isVNode === true : false
}

// ==================== 3. 简单渲染器实现 ====================

/**
 * 创建渲染器
 * @param {Object} options - 平台特定的DOM操作方法
 */
function createRenderer(options) {
  const {
    createElement,
    createText,
    setText,
    setElementText,
    insert,
    remove,
    patchProp
  } = options

  // 渲染函数
  function render(vnode, container) {
    if (vnode == null) {
      // 卸载
      if (container._vnode) {
        unmount(container._vnode)
      }
    } else {
      // 挂载或更新
      patch(container._vnode || null, vnode, container)
    }
    container._vnode = vnode
  }

  // 核心patch函数
  function patch(n1, n2, container, anchor = null) {
    // 如果新旧节点类型不同，直接卸载旧节点
    if (n1 && n1.type !== n2.type) {
      unmount(n1)
      n1 = null
    }

    const { type, shapeFlag } = n2

    switch (type) {
      case NodeTypes.TEXT:
        processText(n1, n2, container, anchor)
        break
      case NodeTypes.FRAGMENT:
        processFragment(n1, n2, container, anchor)
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, anchor)
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          processComponent(n1, n2, container, anchor)
        }
    }
  }

  // 处理文本节点
  function processText(n1, n2, container, anchor) {
    if (n1 == null) {
      // 挂载文本节点
      n2.el = createText(n2.children)
      insert(n2.el, container, anchor)
    } else {
      // 更新文本节点
      const el = (n2.el = n1.el)
      if (n2.children !== n1.children) {
        setText(el, n2.children)
      }
    }
  }

  // 处理Fragment
  function processFragment(n1, n2, container, anchor) {
    if (n1 == null) {
      mountChildren(n2.children, container, anchor)
    } else {
      patchChildren(n1, n2, container, anchor)
    }
  }

  // 处理元素节点
  function processElement(n1, n2, container, anchor) {
    if (n1 == null) {
      mountElement(n2, container, anchor)
    } else {
      patchElement(n1, n2)
    }
  }

  // 挂载元素
  function mountElement(vnode, container, anchor) {
    const { type, props, children, shapeFlag } = vnode

    // 1. 创建DOM元素
    const el = (vnode.el = createElement(type))

    // 2. 处理属性
    if (props) {
      for (const key in props) {
        patchProp(el, key, null, props[key])
      }
    }

    // 3. 处理子节点
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      setElementText(el, children)
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(children, el)
    }

    // 4. 插入到容器中
    insert(el, container, anchor)
  }

  // 更新元素
  function patchElement(n1, n2) {
    const el = (n2.el = n1.el)
    const oldProps = n1.props || {}
    const newProps = n2.props || {}

    // 1. 更新属性
    patchProps(el, n2, oldProps, newProps)

    // 2. 更新子节点
    patchChildren(n1, n2, el)
  }

  // 更新属性
  function patchProps(el, vnode, oldProps, newProps) {
    // 快速路径：使用patchFlag优化
    const { patchFlag, dynamicProps } = vnode

    if (patchFlag > 0) {
      // 有补丁标记，只更新动态属性
      if (patchFlag & PatchFlags.CLASS) {
        if (oldProps.class !== newProps.class) {
          patchProp(el, 'class', oldProps.class, newProps.class)
        }
      }
      if (patchFlag & PatchFlags.STYLE) {
        patchProp(el, 'style', oldProps.style, newProps.style)
      }
      if (patchFlag & PatchFlags.PROPS) {
        // 只更新动态props
        const propsToUpdate = dynamicProps || []
        for (let i = 0; i < propsToUpdate.length; i++) {
          const key = propsToUpdate[i]
          patchProp(el, key, oldProps[key], newProps[key])
        }
      }
    } else {
      // 全量比较
      for (const key in newProps) {
        if (oldProps[key] !== newProps[key]) {
          patchProp(el, key, oldProps[key], newProps[key])
        }
      }
      for (const key in oldProps) {
        if (!(key in newProps)) {
          patchProp(el, key, oldProps[key], null)
        }
      }
    }
  }

  // 挂载子节点
  function mountChildren(children, container, anchor = null) {
    for (let i = 0; i < children.length; i++) {
      patch(null, children[i], container, anchor)
    }
  }

  // 更新子节点
  function patchChildren(n1, n2, container, anchor = null) {
    const c1 = n1 && n1.children
    const c2 = n2.children
    const prevShapeFlag = n1 ? n1.shapeFlag : 0
    const shapeFlag = n2.shapeFlag

    // 新子节点是文本
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1)
      }
      if (c2 !== c1) {
        setElementText(container, c2)
      }
    } else {
      // 新子节点是数组或null
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 新旧都是数组 - 核心Diff算法
          patchKeyedChildren(c1, c2, container, anchor)
        } else {
          // 旧数组，新null - 卸载所有
          unmountChildren(c1)
        }
      } else {
        // 旧文本或null，新数组
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          setElementText(container, '')
        }
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(c2, container, anchor)
        }
      }
    }
  }

  // 简化版Diff算法
  function patchKeyedChildren(c1, c2, container, anchor) {
    let i = 0
    const l2 = c2.length
    let e1 = c1.length - 1
    let e2 = l2 - 1

    // 1. 从头开始同步
    while (i <= e1 && i <= e2) {
      const n1 = c1[i]
      const n2 = c2[i]
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, anchor)
      } else {
        break
      }
      i++
    }

    // 2. 从尾开始同步
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1]
      const n2 = c2[e2]
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, anchor)
      } else {
        break
      }
      e1--
      e2--
    }

    // 3. 处理简单情况
    if (i > e1) {
      if (i <= e2) {
        // 有新增节点
        const nextPos = e2 + 1
        const anchor = nextPos < l2 ? c2[nextPos].el : null
        while (i <= e2) {
          patch(null, c2[i], container, anchor)
          i++
        }
      }
    } else if (i > e2) {
      // 有删除节点
      while (i <= e1) {
        unmount(c1[i])
        i++
      }
    } else {
      // 复杂情况 - 移动、新增、删除的混合
      patchComplexChildren(c1, c2, i, e1, e2, container, anchor)
    }
  }

  // 处理复杂的子节点更新
  function patchComplexChildren(c1, c2, i, e1, e2, container, anchor) {
    // 简化实现：重新挂载所有剩余节点
    // 实际Vue3中这里是最长递增子序列算法
    while (i <= e1) {
      unmount(c1[i])
      i++
    }
    
    let start = i
    while (start <= e2) {
      patch(null, c2[start], container, anchor)
      start++
    }
  }

  // 判断是否为相同类型的VNode
  function isSameVNodeType(n1, n2) {
    return n1.type === n2.type && n1.key === n2.key
  }

  // 卸载节点
  function unmount(vnode) {
    if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
      unmountComponent(vnode.component)
    } else {
      remove(vnode.el)
    }
  }

  // 卸载子节点
  function unmountChildren(children) {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i])
    }
  }

  // 处理组件（简化实现）
  function processComponent(n1, n2, container, anchor) {
    if (n1 == null) {
      mountComponent(n2, container, anchor)
    } else {
      updateComponent(n1, n2)
    }
  }

  // 挂载组件（简化实现）
  function mountComponent(vnode, container, anchor) {
    const instance = createComponentInstance(vnode)
    vnode.component = instance

    // 设置组件实例
    setupComponent(instance)

    // 设置渲染效果
    setupRenderEffect(instance, vnode, container, anchor)
  }

  // 更新组件（简化实现）
  function updateComponent(n1, n2) {
    const instance = (n2.component = n1.component)
    instance.next = n2
    instance.update()
  }

  // 卸载组件（简化实现）
  function unmountComponent(instance) {
    // 清理逻辑
    if (instance.subTree) {
      unmount(instance.subTree)
    }
  }

  return { render }
}

// ==================== 4. 组件系统基础 ====================

let currentRenderingInstance = null

// 创建组件实例
function createComponentInstance(vnode) {
  const instance = {
    vnode,
    type: vnode.type,
    subTree: null,
    update: null,
    isMounted: false,
    render: null,
    setupState: {},
    props: {},
    emit: null
  }

  return instance
}

// 设置组件实例
function setupComponent(instance) {
  const { type, props } = instance.vnode

  // 处理props
  instance.props = props || {}

  // 处理render函数
  if (typeof type === 'function') {
    // 函数式组件
    instance.render = type
  } else if (type.render) {
    // 选项式组件
    instance.render = type.render
  }
}

// 设置渲染效果
function setupRenderEffect(instance, vnode, container, anchor) {
  const componentUpdateFn = () => {
    if (!instance.isMounted) {
      // 首次挂载
      currentRenderingInstance = instance
      const subTree = (instance.subTree = instance.render.call(instance.props))
      currentRenderingInstance = null

      patch(null, subTree, container, anchor)
      vnode.el = subTree.el
      instance.isMounted = true
    } else {
      // 更新
      const nextTree = instance.render.call(instance.props)
      const prevTree = instance.subTree
      instance.subTree = nextTree

      patch(prevTree, nextTree, container, anchor)
    }
  }

  // 创建更新函数
  instance.update = componentUpdateFn
  componentUpdateFn()
}

// ==================== 5. Web平台渲染器配置 ====================

const webRendererOptions = {
  createElement(tag) {
    return document.createElement(tag)
  },

  createText(text) {
    return document.createTextNode(text)
  },

  setText(node, text) {
    node.nodeValue = text
  },

  setElementText(el, text) {
    el.textContent = text
  },

  insert(child, parent, anchor) {
    parent.insertBefore(child, anchor || null)
  },

  remove(child) {
    const parent = child.parentNode
    if (parent) {
      parent.removeChild(child)
    }
  },

  patchProp(el, key, prevValue, nextValue) {
    if (key === 'class') {
      el.className = nextValue || ''
    } else if (key === 'style') {
      if (nextValue) {
        if (typeof nextValue === 'string') {
          el.style.cssText = nextValue
        } else {
          for (const styleName in nextValue) {
            el.style[styleName] = nextValue[styleName]
          }
        }
      } else {
        el.removeAttribute('style')
      }
    } else if (key.startsWith('on')) {
      // 事件处理
      const eventName = key.slice(2).toLowerCase()
      if (prevValue) {
        el.removeEventListener(eventName, prevValue)
      }
      if (nextValue) {
        el.addEventListener(eventName, nextValue)
      }
    } else {
      // 普通属性
      if (nextValue == null) {
        el.removeAttribute(key)
      } else {
        el.setAttribute(key, nextValue)
      }
    }
  }
}

// 创建Web平台渲染器
const webRenderer = createRenderer(webRendererOptions)

// ==================== 6. 使用示例 ====================

// 示例1：基本元素渲染
function basicElementDemo() {
  console.log('=== 基本元素渲染演示 ===')
  
  const container = document.createElement('div')
  document.body.appendChild(container)

  // 创建虚拟DOM
  const vnode1 = h('div', {
    id: 'app',
    class: 'container'
  }, [
    h('h1', null, 'Hello Vue3 Renderer!'),
    h('p', { style: 'color: blue;' }, 'This is a paragraph.'),
    h('button', {
      onclick: () => console.log('Button clicked!')
    }, 'Click me')
  ])

  console.log('Initial VNode:', vnode1)
  webRenderer.render(vnode1, container)

  // 更新演示
  setTimeout(() => {
    const vnode2 = h('div', {
      id: 'app',
      class: 'container updated'
    }, [
      h('h1', null, 'Updated Title!'),
      h('p', { style: 'color: red;' }, 'Updated paragraph.'),
      h('span', null, 'New span element'),
      h('button', {
        onclick: () => console.log('Updated button clicked!')
      }, 'Updated Button')
    ])

    console.log('Updated VNode:', vnode2)
    webRenderer.render(vnode2, container)
  }, 2000)

  // 卸载演示
  setTimeout(() => {
    console.log('Unmounting...')
    webRenderer.render(null, container)
  }, 4000)
}

// 示例2：组件渲染
function componentDemo() {
  console.log('\n=== 组件渲染演示 ===')
  
  const container = document.createElement('div')
  document.body.appendChild(container)

  // 函数式组件
  const MyButton = (props) => {
    return h('button', {
      style: `background: ${props.color}; padding: 8px 16px;`,
      onclick: props.onClick
    }, props.text)
  }

  // 使用组件
  const vnode = h('div', null, [
    h('h2', null, 'Component Demo'),
    h(MyButton, {
      color: 'blue',
      text: 'Blue Button',
      onClick: () => console.log('Blue button clicked!')
    }),
    h(MyButton, {
      color: 'green',
      text: 'Green Button',
      onClick: () => console.log('Green button clicked!')
    })
  ])

  webRenderer.render(vnode, container)
}

// 示例3：性能优化演示
function optimizationDemo() {
  console.log('\n=== 性能优化演示 ===')
  
  const container = document.createElement('div')
  document.body.appendChild(container)

  let counter = 0

  function createOptimizedVNode(count) {
    // 静态部分（可以被提升）
    const staticHeader = h('h3', null, 'Optimization Demo')
    
    // 动态部分（带有patchFlag）
    const dynamicText = createVNode('p', null, `Count: ${count}`, PatchFlags.TEXT)
    const dynamicClass = createVNode('div', {
      class: count % 2 === 0 ? 'even' : 'odd'
    }, 'Dynamic class', PatchFlags.CLASS)

    return h('div', null, [
      staticHeader,
      dynamicText,
      dynamicClass,
      h('button', {
        onclick: updateCount
      }, 'Increment')
    ])
  }

  function updateCount() {
    counter++
    const vnode = createOptimizedVNode(counter)
    webRenderer.render(vnode, container)
    console.log(`Updated to count: ${counter}`)
  }

  // 初始渲染
  const initialVNode = createOptimizedVNode(counter)
  webRenderer.render(initialVNode, container)
}

// 示例4：Diff算法演示
function diffDemo() {
  console.log('\n=== Diff算法演示 ===')
  
  const container = document.createElement('div')
  document.body.appendChild(container)

  // 初始列表
  const list1 = ['A', 'B', 'C', 'D']
  const vnode1 = h('div', null, [
    h('h3', null, 'Diff Algorithm Demo'),
    h('ul', null, list1.map(item => 
      h('li', { key: item }, item)
    ))
  ])

  webRenderer.render(vnode1, container)

  // 更新列表（重排序）
  setTimeout(() => {
    const list2 = ['B', 'A', 'D', 'C', 'E']
    const vnode2 = h('div', null, [
      h('h3', null, 'Diff Algorithm Demo'),
      h('ul', null, list2.map(item => 
        h('li', { key: item }, item)
      ))
    ])

    console.log('Updating list from', list1, 'to', list2)
    webRenderer.render(vnode2, container)
  }, 2000)
}

// ==================== 7. 性能测试 ====================

function performanceTest() {
  console.log('\n=== 性能测试 ===')
  
  const container = document.createElement('div')
  document.body.appendChild(container)

  const itemCount = 1000

  console.time('Large list render')
  
  const vnode = h('div', null, [
    h('h3', null, `Performance Test - ${itemCount} items`),
    h('ul', null, 
      Array.from({ length: itemCount }, (_, i) => 
        h('li', { key: i }, `Item ${i}`)
      )
    )
  ])

  webRenderer.render(vnode, container)
  console.timeEnd('Large list render')

  // 更新测试
  setTimeout(() => {
    console.time('Large list update')
    
    const updatedVNode = h('div', null, [
      h('h3', null, `Performance Test - ${itemCount} items (Updated)`),
      h('ul', null, 
        Array.from({ length: itemCount }, (_, i) => 
          h('li', { 
            key: i,
            style: i % 2 === 0 ? 'color: blue;' : 'color: red;'
          }, `Updated Item ${i}`)
        )
      )
    ])

    webRenderer.render(updatedVNode, container)
    console.timeEnd('Large list update')
  }, 1000)
}

// ==================== 8. 运行所有演示 ====================

console.log('Vue3 渲染器系统基础架构演示')
console.log('=====================================')

// 依次运行演示
basicElementDemo()

setTimeout(() => componentDemo(), 5000)
setTimeout(() => optimizationDemo(), 7000)
setTimeout(() => diffDemo(), 9000)
setTimeout(() => performanceTest(), 12000)

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createRenderer,
    createVNode,
    h,
    webRenderer,
    ShapeFlags,
    PatchFlags,
    NodeTypes
  }
} 