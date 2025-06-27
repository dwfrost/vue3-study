/**
 * Vue3虚拟DOM与Diff算法演示
 * 本示例展示：
 * 1. VNode数据结构设计
 * 2. 简化版Diff算法实现
 * 3. Vue2 vs Vue3性能对比
 * 4. 编译时优化演示
 */

// ===== 1. VNode数据结构定义 =====

// ShapeFlag枚举
const ShapeFlags = {
  ELEMENT: 1,                    // 0001 - 元素
  FUNCTIONAL_COMPONENT: 1 << 1,  // 0010 - 函数组件
  STATEFUL_COMPONENT: 1 << 2,    // 0100 - 有状态组件
  TEXT_CHILDREN: 1 << 3,         // 1000 - 文本子节点
  ARRAY_CHILDREN: 1 << 4,        // 10000 - 数组子节点
  SLOTS_CHILDREN: 1 << 5,        // 100000 - 插槽子节点
  COMPONENT: (1 << 2) | (1 << 1) // 组件标记
}

// PatchFlag枚举
const PatchFlags = {
  TEXT: 1,                    // 文本内容动态
  CLASS: 1 << 1,             // class动态
  STYLE: 1 << 2,             // style动态
  PROPS: 1 << 3,             // 其他属性动态
  FULL_PROPS: 1 << 4,        // 包含动态key的属性
  STABLE_FRAGMENT: 1 << 6,   // 稳定的Fragment
  KEYED_FRAGMENT: 1 << 7,    // 带key的Fragment
  HOISTED: -1,               // 静态提升
  BAIL: -2                   // diff算法无法优化
}

// VNode创建工厂函数
function createVNode(type, props = null, children = null, patchFlag = 0) {
  const vnode = {
    type,
    props,
    children,
    key: props && props.key,
    ref: props && props.ref,
    el: null,
    
    // 优化标记
    patchFlag,
    shapeFlag: getShapeFlag(type, children),
    dynamicChildren: null,
    staticCount: 0
  }
  
  // 标准化children并计算shapeFlag
  normalizeChildren(vnode, children)
  
  return vnode
}

function getShapeFlag(type, children) {
  let shapeFlag = 0
  
  if (typeof type === 'string') {
    shapeFlag = ShapeFlags.ELEMENT
  } else if (typeof type === 'object') {
    shapeFlag = ShapeFlags.STATEFUL_COMPONENT
  } else if (typeof type === 'function') {
    shapeFlag = ShapeFlags.FUNCTIONAL_COMPONENT
  }
  
  return shapeFlag
}

function normalizeChildren(vnode, children) {
  if (children == null) {
    children = null
  } else if (Array.isArray(children)) {
    vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN
  } else if (typeof children === 'string') {
    vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN
    children = String(children)
  }
  
  vnode.children = children
}

// ===== 2. DOM操作工具函数 =====

const nodeOps = {
  createElement: (tag) => document.createElement(tag),
  createText: (text) => document.createTextNode(text),
  createComment: (text) => document.createComment(text),
  setText: (node, text) => { node.nodeValue = text },
  setElementText: (el, text) => { el.textContent = text },
  parentNode: (node) => node.parentNode,
  nextSibling: (node) => node.nextSibling,
  querySelector: (selector) => document.querySelector(selector),
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null)
  },
  remove: (child) => {
    const parent = child.parentNode
    if (parent) {
      parent.removeChild(child)
    }
  }
}

// ===== 3. 属性操作函数 =====

function patchProp(el, key, prevValue, nextValue) {
  if (key === 'class') {
    el.className = nextValue || ''
  } else if (key === 'style') {
    if (nextValue) {
      if (typeof nextValue === 'string') {
        el.style.cssText = nextValue
      } else {
        Object.assign(el.style, nextValue)
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
    if (nextValue == null || nextValue === false) {
      el.removeAttribute(key)
    } else {
      el.setAttribute(key, nextValue)
    }
  }
}

// ===== 4. 核心Diff算法实现 =====

function patch(n1, n2, container, anchor = null) {
  // 如果新旧节点类型不同，直接替换
  if (n1 && n1.type !== n2.type) {
    unmount(n1)
    n1 = null
  }
  
  const { type, shapeFlag } = n2
  
  if (typeof type === 'string') {
    // 元素节点
    if (n1 == null) {
      mountElement(n2, container, anchor)
    } else {
      patchElement(n1, n2)
    }
  } else if (shapeFlag & ShapeFlags.COMPONENT) {
    // 组件节点
    if (n1 == null) {
      mountComponent(n2, container, anchor)
    } else {
      patchComponent(n1, n2)
    }
  }
}

function mountElement(vnode, container, anchor) {
  const { type, props, children, shapeFlag } = vnode
  
  // 创建元素
  const el = vnode.el = nodeOps.createElement(type)
  
  // 设置属性
  if (props) {
    for (const key in props) {
      patchProp(el, key, null, props[key])
    }
  }
  
  // 处理子节点
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    nodeOps.setElementText(el, children)
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    mountChildren(children, el)
  }
  
  // 插入到容器
  nodeOps.insert(el, container, anchor)
}

function patchElement(n1, n2) {
  const el = n2.el = n1.el
  const oldProps = n1.props || {}
  const newProps = n2.props || {}
  
  // 更新属性
  patchProps(oldProps, newProps, el)
  
  // 更新子节点
  patchChildren(n1, n2, el)
}

function patchProps(oldProps, newProps, el) {
  // 更新新增和修改的属性
  for (const key in newProps) {
    if (oldProps[key] !== newProps[key]) {
      patchProp(el, key, oldProps[key], newProps[key])
    }
  }
  
  // 删除不存在的属性
  for (const key in oldProps) {
    if (!(key in newProps)) {
      patchProp(el, key, oldProps[key], null)
    }
  }
}

function patchChildren(n1, n2, container) {
  const c1 = n1.children
  const c2 = n2.children
  const prevShapeFlag = n1.shapeFlag
  const shapeFlag = n2.shapeFlag
  
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    // 新子节点是文本
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 卸载所有旧子节点
      unmountChildren(c1)
    }
    if (c2 !== c1) {
      nodeOps.setElementText(container, c2)
    }
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 新旧都是数组，执行核心diff算法
      patchKeyedChildren(c1, c2, container)
    } else {
      // 旧子节点是文本，新子节点是数组
      nodeOps.setElementText(container, '')
      mountChildren(c2, container)
    }
  } else {
    // 新子节点为空
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(c1)
    } else if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      nodeOps.setElementText(container, '')
    }
  }
}

// ===== 5. 双端对比算法核心实现 =====

function patchKeyedChildren(c1, c2, container) {
  let i = 0
  const l2 = c2.length
  let e1 = c1.length - 1
  let e2 = l2 - 1
  
  // 1. sync from start
  // (a b) c
  // (a b) d e
  while (i <= e1 && i <= e2) {
    const n1 = c1[i]
    const n2 = c2[i]
    if (isSameVNodeType(n1, n2)) {
      patch(n1, n2, container)
    } else {
      break
    }
    i++
  }
  
  // 2. sync from end
  // a (b c)
  // d e (b c)
  while (i <= e1 && i <= e2) {
    const n1 = c1[e1]
    const n2 = c2[e2]
    if (isSameVNodeType(n1, n2)) {
      patch(n1, n2, container)
    } else {
      break
    }
    e1--
    e2--
  }
  
  // 3. common sequence + mount
  // (a b)
  // (a b) c
  // i = 2, e1 = 1, e2 = 2
  if (i > e1) {
    if (i <= e2) {
      const nextPos = e2 + 1
      const anchor = nextPos < l2 ? c2[nextPos].el : null
      while (i <= e2) {
        patch(null, c2[i], container, anchor)
        i++
      }
    }
  }
  
  // 4. common sequence + unmount
  // (a b) c
  // (a b)
  // i = 2, e1 = 2, e2 = 1
  else if (i > e2) {
    while (i <= e1) {
      unmount(c1[i])
      i++
    }
  }
  
  // 5. unknown sequence
  // [i ... e1 + 1]: a b [c d e] f g
  // [i ... e2 + 1]: a b [e d c h] f g
  // i = 2, e1 = 4, e2 = 5
  else {
    const s1 = i // prev starting index
    const s2 = i // next starting index
    
    // 5.1 build key:index map for newChildren
    const keyToNewIndexMap = new Map()
    for (i = s2; i <= e2; i++) {
      const nextChild = c2[i]
      if (nextChild.key != null) {
        keyToNewIndexMap.set(nextChild.key, i)
      }
    }
    
    // 5.2 loop through old children left to be patched and try to patch
    let j
    let patched = 0
    const toBePatched = e2 - s2 + 1
    let moved = false
    let maxNewIndexSoFar = 0
    
    // used to track whether any node has moved
    const newIndexToOldIndexMap = new Array(toBePatched)
    for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0
    
    for (i = s1; i <= e1; i++) {
      const prevChild = c1[i]
      if (patched >= toBePatched) {
        unmount(prevChild)
        continue
      }
      let newIndex
      if (prevChild.key != null) {
        newIndex = keyToNewIndexMap.get(prevChild.key)
      } else {
        // key-less node, try to locate a key-less node of the same type
        for (j = s2; j <= e2; j++) {
          if (
            newIndexToOldIndexMap[j - s2] === 0 &&
            isSameVNodeType(prevChild, c2[j])
          ) {
            newIndex = j
            break
          }
        }
      }
      if (newIndex === undefined) {
        unmount(prevChild)
      } else {
        newIndexToOldIndexMap[newIndex - s2] = i + 1
        if (newIndex >= maxNewIndexSoFar) {
          maxNewIndexSoFar = newIndex
        } else {
          moved = true
        }
        patch(prevChild, c2[newIndex], container)
        patched++
      }
    }
    
    // 5.3 move and mount
    const increasingNewIndexSequence = moved
      ? getSequence(newIndexToOldIndexMap)
      : []
    j = increasingNewIndexSequence.length - 1
    
    for (i = toBePatched - 1; i >= 0; i--) {
      const nextIndex = s2 + i
      const nextChild = c2[nextIndex]
      const anchor = nextIndex + 1 < l2 ? c2[nextIndex + 1].el : null
      if (newIndexToOldIndexMap[i] === 0) {
        // mount new
        patch(null, nextChild, container, anchor)
      } else if (moved) {
        if (j < 0 || i !== increasingNewIndexSequence[j]) {
          move(nextChild, container, anchor)
        } else {
          j--
        }
      }
    }
  }
}

// 最长递增子序列算法
function getSequence(arr) {
  const p = arr.slice()
  const result = [0]
  let i, j, u, v, c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      while (u < v) {
        c = ((u + v) / 2) | 0
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[result.length - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}

// ===== 6. 辅助函数 =====

function isSameVNodeType(n1, n2) {
  return n1.type === n2.type && n1.key === n2.key
}

function mountChildren(children, container, anchor = null) {
  for (let i = 0; i < children.length; i++) {
    patch(null, children[i], container, anchor)
  }
}

function unmountChildren(children) {
  for (let i = 0; i < children.length; i++) {
    unmount(children[i])
  }
}

function unmount(vnode) {
  if (vnode.el) {
    nodeOps.remove(vnode.el)
  }
}

function move(vnode, container, anchor) {
  nodeOps.insert(vnode.el, container, anchor)
}

function mountComponent(vnode, container, anchor) {
  // 简化版组件挂载
  console.log('Mount component:', vnode.type.name)
}

function patchComponent(n1, n2) {
  // 简化版组件更新
  console.log('Patch component:', n2.type.name)
}

// ===== 7. 性能测试与对比 =====

class PerformanceMonitor {
  constructor() {
    this.results = []
  }
  
  measure(name, fn) {
    const start = performance.now()
    const result = fn()
    const end = performance.now()
    const time = end - start
    
    this.results.push({ name, time })
    console.log(`${name}: ${time.toFixed(2)}ms`)
    return result
  }
  
  getReport() {
    return this.results
  }
  
  clear() {
    this.results = []
  }
}

// ===== 8. 实际演示示例 =====

function runVirtualDOMDemo() {
  console.log('=== Vue3虚拟DOM与Diff算法演示 ===\n')
  
  const monitor = new PerformanceMonitor()
  
  // 1. VNode创建演示
  console.log('1. VNode创建演示:')
  const vnode1 = createVNode('div', 
    { class: 'container', id: 'app' },
    [
      createVNode('h1', null, 'Hello Vue3'),
      createVNode('p', null, 'Virtual DOM Example')
    ]
  )
  console.log('VNode结构:', JSON.stringify(vnode1, null, 2))
  
  // 2. 编译时优化演示
  console.log('\n2. 编译时优化演示:')
  
  // 普通VNode（无优化）
  const normalVNode = createVNode('div', { class: 'static' }, [
    createVNode('p', null, 'Static content'),
    createVNode('span', { id: 'dynamic' }, 'Dynamic content')
  ])
  
  // 优化后的VNode（带PatchFlag）
  const optimizedVNode = createVNode('div', { class: 'static' }, [
    createVNode('p', null, 'Static content', PatchFlags.HOISTED),
    createVNode('span', { id: 'dynamic' }, 'Dynamic content', PatchFlags.TEXT | PatchFlags.PROPS)
  ])
  
  console.log('普通VNode:', normalVNode.patchFlag)
  console.log('优化VNode:', optimizedVNode.patchFlag)
  
  // 3. Diff算法性能测试
  console.log('\n3. Diff算法性能测试:')
  
  const container = document.createElement('div')
  
  // 创建大量节点进行测试
  const createLargeList = (size) => {
    return Array.from({ length: size }, (_, i) => 
      createVNode('div', { key: i }, `Item ${i}`)
    )
  }
  
  monitor.measure('创建1000个VNode', () => {
    return createLargeList(1000)
  })
  
  const oldList = createLargeList(1000)
  const newList = [
    ...createLargeList(500),
    createVNode('div', { key: 'new' }, 'New Item'),
    ...createLargeList(500).slice(500, 1000)
  ]
  
  monitor.measure('Diff 1000个节点', () => {
    const oldVNode = createVNode('div', null, oldList)
    const newVNode = createVNode('div', null, newList)
    
    // 挂载旧节点
    mountElement(oldVNode, container)
    
    // 执行diff
    patchElement(oldVNode, newVNode)
  })
  
  // 4. 最长递增子序列算法演示
  console.log('\n4. 最长递增子序列算法演示:')
  const testArray = [2, 1, 5, 3, 6, 4, 8, 9, 7]
  const lis = getSequence(testArray)
  console.log('原数组:', testArray)
  console.log('最长递增子序列索引:', lis)
  console.log('对应的值:', lis.map(i => testArray[i]))
  
  // 5. Block Tree优化演示
  console.log('\n5. Block Tree优化演示:')
  
  // 模拟动态节点收集
  let currentBlock = []
  
  function createBlock(type, props, children) {
    const block = createVNode(type, props, children)
    block.dynamicChildren = currentBlock.slice()
    currentBlock = []
    return block
  }
  
  function trackDynamicNode(vnode) {
    if (vnode.patchFlag > 0) {
      currentBlock.push(vnode)
    }
  }
  
  // 创建带动态子节点的块
  const dynamicChild1 = createVNode('p', null, 'Dynamic 1', PatchFlags.TEXT)
  const dynamicChild2 = createVNode('span', { class: 'dynamic' }, 'Dynamic 2', PatchFlags.PROPS)
  
  trackDynamicNode(dynamicChild1)
  trackDynamicNode(dynamicChild2)
  
  const block = createBlock('div', null, [
    createVNode('h1', null, 'Static Title'),
    dynamicChild1,
    createVNode('p', null, 'Static Content'),
    dynamicChild2
  ])
  
  console.log('Block dynamicChildren:', block.dynamicChildren.length)
  
  console.log('\n=== 性能报告 ===')
  monitor.getReport().forEach(result => {
    console.log(`${result.name}: ${result.time.toFixed(2)}ms`)
  })
}

// ===== 9. 实用工具函数 =====

// VNode分析工具
function analyzeVNode(vnode, depth = 0) {
  const indent = '  '.repeat(depth)
  console.log(`${indent}Type: ${vnode.type}`)
  console.log(`${indent}PatchFlag: ${vnode.patchFlag}`)
  console.log(`${indent}ShapeFlag: ${vnode.shapeFlag}`)
  
  if (Array.isArray(vnode.children)) {
    console.log(`${indent}Children: ${vnode.children.length} items`)
    vnode.children.forEach(child => {
      if (typeof child === 'object') {
        analyzeVNode(child, depth + 1)
      }
    })
  }
}

// 渲染性能监控
function measureRenderTime(name, fn) {
  const start = performance.now()
  const result = fn()
  const end = performance.now()
  console.log(`${name} 渲染耗时: ${(end - start).toFixed(2)}ms`)
  return result
}

// 导出主要函数供外部使用
if (typeof module !== 'undefined') {
  module.exports = {
    createVNode,
    patch,
    patchKeyedChildren,
    getSequence,
    ShapeFlags,
    PatchFlags,
    analyzeVNode,
    measureRenderTime,
    runVirtualDOMDemo
  }
}

// 如果在浏览器环境中，直接运行演示
if (typeof window !== 'undefined') {
  // 页面加载后运行演示
  document.addEventListener('DOMContentLoaded', () => {
    runVirtualDOMDemo()
  })
} 