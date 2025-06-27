/**
 * Vue3编译系统演示
 * 本示例展示：
 * 1. 模板解析与AST构建
 * 2. AST转换与优化
 * 3. 代码生成
 * 4. 编译优化策略
 * 5. 自定义编译器实现
 */

// ===== 1. 词法分析器 =====

class Tokenizer {
  constructor(template) {
    this.template = template
    this.index = 0
    this.tokens = []
    this.line = 1
    this.column = 1
  }
  
  tokenize() {
    while (this.index < this.template.length) {
      this.skipWhitespace()
      
      if (this.index >= this.template.length) break
      
      const char = this.template[this.index]
      
      if (char === '<') {
        this.parseTag()
      } else if (this.template.slice(this.index, this.index + 2) === '{{') {
        this.parseInterpolation()
      } else {
        this.parseText()
      }
    }
    
    return this.tokens
  }
  
  parseTag() {
    const start = this.index
    this.advance() // 跳过 '<'
    
    if (this.template[this.index] === '/') {
      // 结束标签
      this.advance() // 跳过 '/'
      const tagName = this.parseTagName()
      this.skipWhitespace()
      this.expect('>')
      
      this.tokens.push({
        type: 'EndTag',
        tagName,
        start,
        end: this.index,
        loc: { line: this.line, column: this.column }
      })
    } else {
      // 开始标签
      const tagName = this.parseTagName()
      const attributes = this.parseAttributes()
      
      this.skipWhitespace()
      const isSelfClosing = this.template[this.index] === '/'
      if (isSelfClosing) {
        this.advance()
      }
      this.expect('>')
      
      this.tokens.push({
        type: 'StartTag',
        tagName,
        attributes,
        isSelfClosing,
        start,
        end: this.index,
        loc: { line: this.line, column: this.column }
      })
    }
  }
  
  parseTagName() {
    const start = this.index
    while (this.index < this.template.length && 
           /[a-zA-Z0-9\-]/.test(this.template[this.index])) {
      this.advance()
    }
    return this.template.slice(start, this.index)
  }
  
  parseAttributes() {
    const attributes = []
    
    while (this.index < this.template.length && 
           this.template[this.index] !== '>' && 
           this.template[this.index] !== '/') {
      this.skipWhitespace()
      
      if (this.template[this.index] === '>' || this.template[this.index] === '/') {
        break
      }
      
      const attr = this.parseAttribute()
      if (attr) {
        attributes.push(attr)
      }
    }
    
    return attributes
  }
  
  parseAttribute() {
    const nameStart = this.index
    
    // 解析属性名
    while (this.index < this.template.length && 
           /[a-zA-Z0-9\-:@\.]/.test(this.template[this.index])) {
      this.advance()
    }
    
    const name = this.template.slice(nameStart, this.index)
    if (!name) return null
    
    this.skipWhitespace()
    
    let value = null
    if (this.template[this.index] === '=') {
      this.advance() // 跳过 '='
      this.skipWhitespace()
      value = this.parseAttributeValue()
    }
    
    // 判断是否为指令
    const isDirective = name.startsWith('v-') || name.startsWith('@') || name.startsWith(':')
    
    return {
      type: isDirective ? 'Directive' : 'Attribute',
      name: isDirective ? this.parseDirectiveName(name) : name,
      value,
      arg: isDirective ? this.parseDirectiveArg(name) : null,
      modifiers: isDirective ? this.parseDirectiveModifiers(name) : [],
      start: nameStart,
      end: this.index
    }
  }
  
  parseAttributeValue() {
    const quote = this.template[this.index]
    if (quote === '"' || quote === "'") {
      this.advance() // 跳过开始引号
      const start = this.index
      
      while (this.index < this.template.length && this.template[this.index] !== quote) {
        this.advance()
      }
      
      const value = this.template.slice(start, this.index)
      this.advance() // 跳过结束引号
      
      return {
        type: 'AttributeValue',
        content: value
      }
    }
    
    return null
  }
  
  parseDirectiveName(fullName) {
    if (fullName.startsWith('v-')) {
      return fullName.split(':')[0].split('.')[0].slice(2)
    } else if (fullName.startsWith('@')) {
      return 'on'
    } else if (fullName.startsWith(':')) {
      return 'bind'
    }
    return fullName
  }
  
  parseDirectiveArg(fullName) {
    const colonIndex = fullName.indexOf(':')
    if (colonIndex > 0) {
      const arg = fullName.slice(colonIndex + 1).split('.')[0]
      return {
        type: 'DirectiveArg',
        content: arg
      }
    }
    return null
  }
  
  parseDirectiveModifiers(fullName) {
    const parts = fullName.split('.')
    return parts.slice(1)
  }
  
  parseInterpolation() {
    const start = this.index
    this.advance(2) // 跳过 '{{'
    
    const expStart = this.index
    while (this.index < this.template.length - 1 && 
           this.template.slice(this.index, this.index + 2) !== '}}') {
      this.advance()
    }
    
    const expression = this.template.slice(expStart, this.index).trim()
    this.advance(2) // 跳过 '}}'
    
    this.tokens.push({
      type: 'Interpolation',
      expression,
      start,
      end: this.index,
      loc: { line: this.line, column: this.column }
    })
  }
  
  parseText() {
    const start = this.index
    
    while (this.index < this.template.length && 
           this.template[this.index] !== '<' && 
           this.template.slice(this.index, this.index + 2) !== '{{') {
      this.advance()
    }
    
    const content = this.template.slice(start, this.index)
    if (content.trim()) {
      this.tokens.push({
        type: 'Text',
        content,
        start,
        end: this.index,
        loc: { line: this.line, column: this.column }
      })
    }
  }
  
  skipWhitespace() {
    while (this.index < this.template.length && 
           /\s/.test(this.template[this.index])) {
      if (this.template[this.index] === '\n') {
        this.line++
        this.column = 1
      } else {
        this.column++
      }
      this.index++
    }
  }
  
  advance(count = 1) {
    for (let i = 0; i < count; i++) {
      if (this.template[this.index] === '\n') {
        this.line++
        this.column = 1
      } else {
        this.column++
      }
      this.index++
    }
  }
  
  expect(char) {
    if (this.template[this.index] !== char) {
      throw new Error(`Expected '${char}' at position ${this.index}`)
    }
    this.advance()
  }
}

// ===== 2. AST解析器 =====

class Parser {
  constructor(tokens) {
    this.tokens = tokens
    this.index = 0
    this.stack = []
  }
  
  parse() {
    const ast = {
      type: 'Root',
      children: [],
      loc: { start: { line: 1, column: 1 }, end: null }
    }
    
    this.stack.push(ast)
    
    while (this.index < this.tokens.length) {
      const token = this.tokens[this.index]
      const parent = this.stack[this.stack.length - 1]
      
      switch (token.type) {
        case 'StartTag':
          const element = this.parseElement(token)
          parent.children.push(element)
          
          if (!token.isSelfClosing) {
            this.stack.push(element)
          }
          break
          
        case 'EndTag':
          this.stack.pop()
          break
          
        case 'Text':
          parent.children.push({
            type: 'Text',
            content: token.content,
            loc: token.loc
          })
          break
          
        case 'Interpolation':
          parent.children.push({
            type: 'Interpolation',
            content: {
              type: 'SimpleExpression',
              content: token.expression,
              isStatic: false
            },
            loc: token.loc
          })
          break
      }
      
      this.index++
    }
    
    return ast
  }
  
  parseElement(token) {
    const element = {
      type: 'Element',
      tag: token.tagName,
      tagType: this.getTagType(token.tagName),
      props: token.attributes || [],
      children: [],
      isSelfClosing: token.isSelfClosing,
      loc: token.loc
    }
    
    // 处理props
    element.props = element.props.map(attr => {
      if (attr.type === 'Directive') {
        return {
          type: 'Directive',
          name: attr.name,
          arg: attr.arg,
          modifiers: attr.modifiers,
          exp: attr.value ? {
            type: 'SimpleExpression',
            content: attr.value.content,
            isStatic: false
          } : null,
          loc: attr.loc
        }
      } else {
        return {
          type: 'Attribute',
          name: attr.name,
          value: attr.value ? {
            type: 'TextLiteral',
            content: attr.value.content
          } : null,
          loc: attr.loc
        }
      }
    })
    
    return element
  }
  
  getTagType(tag) {
    if (['div', 'span', 'p', 'a', 'img', 'input', 'button', 'form'].includes(tag)) {
      return 'Element'
    } else if (tag.includes('-') || tag[0] === tag[0].toUpperCase()) {
      return 'Component'
    }
    return 'Element'
  }
}

// ===== 3. AST转换器 =====

class TransformContext {
  constructor(root, options = {}) {
    this.root = root
    this.options = options
    this.helpers = new Set()
    this.components = new Set()
    this.directives = new Set()
    this.hoists = []
    this.identifiers = Object.create(null)
    this.scopes = {
      vFor: 0,
      vSlot: 0,
      vPre: 0,
      vOnce: 0
    }
    this.currentNode = null
    this.parent = null
    this.childIndex = 0
    this.onError = options.onError || ((error) => { throw error })
  }
  
  helper(name) {
    this.helpers.add(name)
    return `_${name}`
  }
  
  hoist(exp) {
    this.hoists.push(exp)
    const identifier = {
      type: 'SimpleExpression',
      content: `_hoisted_${this.hoists.length}`,
      isStatic: false,
      constType: 3 // can hoist
    }
    return identifier
  }
  
  cache(exp, isVNode = false) {
    return {
      type: 'CacheExpression',
      index: this.cached++,
      value: exp,
      isVNode
    }
  }
}

function transform(root, options = {}) {
  const context = new TransformContext(root, options)
  
  // 节点转换函数
  const nodeTransforms = [
    transformIf,
    transformFor,
    transformExpression,
    transformSlotOutlet,
    transformElement,
    transformText
  ]
  
  // 指令转换函数
  const directiveTransforms = {
    on: transformOn,
    bind: transformBind,
    model: transformModel,
    show: transformShow
  }
  
  context.nodeTransforms = nodeTransforms
  context.directiveTransforms = directiveTransforms
  
  // 遍历AST
  traverseNode(root, context)
  
  // 设置根节点信息
  root.helpers = [...context.helpers]
  root.components = [...context.components]
  root.directives = [...context.directives]
  root.hoists = context.hoists
  
  return root
}

function traverseNode(node, context) {
  context.currentNode = node
  
  // 应用节点转换
  const { nodeTransforms } = context
  const exitFns = []
  
  for (let i = 0; i < nodeTransforms.length; i++) {
    const onExit = nodeTransforms[i](node, context)
    if (onExit) {
      if (Array.isArray(onExit)) {
        exitFns.push(...onExit)
      } else {
        exitFns.push(onExit)
      }
    }
  }
  
  // 递归处理子节点
  switch (node.type) {
    case 'Element':
    case 'Root':
      traverseChildren(node, context)
      break
    case 'If':
      for (let i = 0; i < node.branches.length; i++) {
        traverseNode(node.branches[i], context)
      }
      break
    case 'For':
      traverseNode(node.source, context)
      traverseNode(node.children, context)
      break
  }
  
  // 应用退出函数
  context.currentNode = node
  let i = exitFns.length
  while (i--) {
    exitFns[i]()
  }
}

function traverseChildren(parent, context) {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i]
    if (typeof child === 'string') continue
    
    context.parent = parent
    context.childIndex = i
    traverseNode(child, context)
  }
}

// ===== 4. 节点转换函数 =====

function transformElement(node, context) {
  return () => {
    if (node.type !== 'Element') return
    
    const { tag, props, children } = node
    const isComponent = node.tagType === 'Component'
    
    // 处理指令
    const vnodeProps = []
    const vnodeChildren = []
    let patchFlag = 0
    let dynamicPropNames = []
    
    // 分析props和指令
    for (let i = props.length - 1; i >= 0; i--) {
      const prop = props[i]
      
      if (prop.type === 'Attribute') {
        const { name, value } = prop
        vnodeProps.push(
          createObjectProperty(
            createSimpleExpression(name, true),
            createSimpleExpression(value ? value.content : '', true)
          )
        )
      } else if (prop.type === 'Directive') {
        const { name, arg, exp, modifiers } = prop
        
        // 应用指令转换
        const directiveTransform = context.directiveTransforms[name]
        if (directiveTransform) {
          const result = directiveTransform(prop, node, context)
          
          if (result.props) {
            vnodeProps.push(...result.props)
          }
          
          if (result.patchFlag) {
            patchFlag |= result.patchFlag
          }
          
          if (result.dynamicPropNames) {
            dynamicPropNames.push(...result.dynamicPropNames)
          }
          
          // 移除已处理的指令
          props.splice(i, 1)
        }
      }
    }
    
    // 处理子节点
    if (children.length === 1 && children[0].type === 'Interpolation') {
      patchFlag |= 1 // TEXT
    }
    
    // 创建vnode调用
    const createVNodeCall = isComponent ? 'createVNode' : 'createElementVNode'
    context.helper(createVNodeCall)
    
    node.codegenNode = {
      type: 'VNodeCall',
      tag: isComponent ? resolveComponent(tag, context) : `"${tag}"`,
      props: vnodeProps.length ? createObjectExpression(vnodeProps) : null,
      children: vnodeChildren,
      patchFlag: patchFlag > 0 ? patchFlag : null,
      dynamicProps: dynamicPropNames.length ? createArrayExpression(dynamicPropNames) : null,
      isComponent
    }
  }
}

function transformIf(node, context) {
  if (node.type === 'Element' && 
      node.props.some(p => p.type === 'Directive' && p.name === 'if')) {
    
    const ifProp = node.props.find(p => p.type === 'Directive' && p.name === 'if')
    
    // 创建if节点
    const ifNode = {
      type: 'If',
      branches: [{
        type: 'IfBranch',
        condition: ifProp.exp,
        children: [node]
      }]
    }
    
    // 移除v-if指令
    node.props = node.props.filter(p => p !== ifProp)
    
    // 替换当前节点
    context.replaceNode(ifNode)
    
    return () => {
      context.helper('createCommentVNode')
      
      ifNode.codegenNode = {
        type: 'ConditionalExpression',
        test: ifNode.branches[0].condition,
        consequent: ifNode.branches[0].children[0].codegenNode,
        alternate: {
          type: 'CallExpression',
          callee: context.helper('createCommentVNode'),
          arguments: ['"v-if"', 'true']
        }
      }
    }
  }
}

function transformFor(node, context) {
  if (node.type === 'Element' && 
      node.props.some(p => p.type === 'Directive' && p.name === 'for')) {
    
    const forProp = node.props.find(p => p.type === 'Directive' && p.name === 'for')
    const parseResult = parseForExpression(forProp.exp.content)
    
    const forNode = {
      type: 'For',
      source: createSimpleExpression(parseResult.source),
      valueAlias: parseResult.value,
      keyAlias: parseResult.key,
      objectIndexAlias: parseResult.index,
      children: [node]
    }
    
    // 移除v-for指令
    node.props = node.props.filter(p => p !== forProp)
    
    context.replaceNode(forNode)
    context.scopes.vFor++
    
    return () => {
      context.scopes.vFor--
      context.helper('renderList')
      
      forNode.codegenNode = {
        type: 'CallExpression',
        callee: context.helper('renderList'),
        arguments: [
          forNode.source,
          createFunctionExpression([
            forNode.valueAlias,
            forNode.keyAlias,
            forNode.objectIndexAlias
          ].filter(Boolean), forNode.children[0].codegenNode)
        ]
      }
    }
  }
}

function transformExpression(node, context) {
  if (node.type === 'Interpolation') {
    node.content = processExpression(node.content, context)
  } else if (node.type === 'Element') {
    // 处理指令表达式
    for (let i = 0; i < node.props.length; i++) {
      const prop = node.props[i]
      if (prop.type === 'Directive' && prop.exp) {
        prop.exp = processExpression(prop.exp, context)
      }
    }
  }
}

function transformText(node, context) {
  if (node.type === 'Root' || node.type === 'Element') {
    // 合并相邻的文本节点
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]
      if (child.type === 'Text' || child.type === 'Interpolation') {
        const adjacent = []
        let j = i
        
        while (j < node.children.length &&
               (node.children[j].type === 'Text' || node.children[j].type === 'Interpolation')) {
          adjacent.push(node.children[j])
          j++
        }
        
        if (adjacent.length > 1) {
          const compound = {
            type: 'CompoundExpression',
            children: adjacent,
            loc: adjacent[0].loc
          }
          
          // 替换节点
          node.children.splice(i, adjacent.length, compound)
          
          compound.codegenNode = createCallExpression(
            context.helper('toDisplayString'),
            [createCompoundExpression(adjacent, context)]
          )
        }
      }
    }
  }
}

// ===== 5. 指令转换函数 =====

function transformOn(dir, node, context) {
  const { arg, exp, modifiers } = dir
  
  let eventName
  if (arg && arg.type === 'SimpleExpression') {
    eventName = arg.content
  } else {
    eventName = 'click' // 默认事件
  }
  
  // 处理修饰符
  let handler = exp
  if (modifiers.length) {
    handler = wrapModifiers(handler, modifiers, context)
  }
  
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`on${capitalize(eventName)}`, true),
        handler
      )
    ],
    patchFlag: 8, // PROPS
    dynamicPropNames: [eventName]
  }
}

function transformBind(dir, node, context) {
  const { arg, exp } = dir
  
  if (!arg || !exp) return { props: [] }
  
  const propName = arg.content
  
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(propName, true),
        exp
      )
    ],
    patchFlag: 8, // PROPS
    dynamicPropNames: [propName]
  }
}

function transformModel(dir, node, context) {
  const { arg, exp } = dir
  const tag = node.tag
  
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return transformInputModel(dir, node, context)
  } else {
    return transformComponentModel(dir, node, context)
  }
}

function transformShow(dir, node, context) {
  const { exp } = dir
  
  return {
    props: [
      createObjectProperty(
        createSimpleExpression('style', true),
        createConditionalExpression(
          exp,
          createObjectExpression([]),
          createObjectExpression([
            createObjectProperty(
              createSimpleExpression('display', true),
              createSimpleExpression('none', true)
            )
          ])
        )
      )
    ]
  }
}

// ===== 6. 代码生成器 =====

class CodegenContext {
  constructor(ast, options = {}) {
    this.ast = ast
    this.code = ''
    this.indentLevel = 0
    this.pure = options.pure !== false
    this.map = options.sourceMap ? [] : null
    this.filename = options.filename || 'anonymous.vue'
    this.runtimeGlobalName = options.runtimeGlobalName || 'Vue'
    this.runtimeModuleName = options.runtimeModuleName || 'vue'
  }
  
  push(code, node) {
    this.code += code
    if (this.map && node && node.loc) {
      this.map.push({
        generated: { line: this.getCurrentLine(), column: this.getCurrentColumn() },
        original: node.loc
      })
    }
  }
  
  indent() {
    this.newline(++this.indentLevel)
  }
  
  deindent(withoutNewLine = false) {
    if (withoutNewLine) {
      --this.indentLevel
    } else {
      this.newline(--this.indentLevel)
    }
  }
  
  newline(indentLevel = this.indentLevel) {
    this.push('\n' + '  '.repeat(indentLevel))
  }
  
  getCurrentLine() {
    return this.code.split('\n').length
  }
  
  getCurrentColumn() {
    const lines = this.code.split('\n')
    return lines[lines.length - 1].length
  }
}

function generate(ast, options = {}) {
  const context = new CodegenContext(ast, options)
  const { push, indent, deindent, newline } = context
  
  // 生成前导代码
  genFunctionPreamble(ast, context)
  
  // 生成render函数
  const functionName = 'render'
  const args = ['_ctx', '_cache']
  
  push(`function ${functionName}(${args.join(', ')}) {`)
  indent()
  
  // 生成函数体
  if (ast.codegenNode) {
    push('return ')
    genNode(ast.codegenNode, context)
  } else {
    // 处理根节点的子节点
    if (ast.children.length === 1) {
      genNode(ast.children[0], context)
    } else if (ast.children.length > 1) {
      genNodeList(ast.children, context)
    } else {
      push('null')
    }
  }
  
  deindent()
  push('}')
  
  return {
    code: context.code,
    ast,
    map: context.map
  }
}

function genFunctionPreamble(ast, context) {
  const { push, newline } = context
  
  // 生成imports
  if (ast.helpers.length > 0) {
    push(`import { ${ast.helpers.join(', ')} } from '${context.runtimeModuleName}'`)
    newline()
  }
  
  // 生成hoisted节点
  if (ast.hoists.length) {
    newline()
    ast.hoists.forEach((exp, i) => {
      push(`const _hoisted_${i + 1} = `)
      genNode(exp, context)
      newline()
    })
  }
  
  newline()
}

function genNode(node, context) {
  if (typeof node === 'string') {
    context.push(node)
    return
  }
  
  if (typeof node === 'symbol') {
    context.push(context.helper(node))
    return
  }
  
  switch (node.type) {
    case 'Element':
      genElement(node, context)
      break
    case 'Text':
      genText(node, context)
      break
    case 'Interpolation':
      genInterpolation(node, context)
      break
    case 'SimpleExpression':
      genExpression(node, context)
      break
    case 'CompoundExpression':
      genCompoundExpression(node, context)
      break
    case 'CallExpression':
      genCallExpression(node, context)
      break
    case 'ObjectExpression':
      genObjectExpression(node, context)
      break
    case 'ArrayExpression':
      genArrayExpression(node, context)
      break
    case 'VNodeCall':
      genVNodeCall(node, context)
      break
    case 'ConditionalExpression':
      genConditionalExpression(node, context)
      break
    default:
      if (__DEV__) {
        console.warn(`Unknown node type: ${node.type}`)
      }
  }
}

function genVNodeCall(node, context) {
  const { push, helper } = context
  const { tag, props, children, patchFlag, dynamicProps, isComponent } = node
  
  const callHelper = isComponent ? helper('createVNode') : helper('createElementVNode')
  push(callHelper + '(')
  
  genNodeList([tag, props, children, patchFlag, dynamicProps].filter(arg => arg != null), context)
  
  push(')')
}

function genNodeList(nodes, context, multilines = false) {
  const { push } = context
  
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    
    if (typeof node === 'string') {
      push(node)
    } else if (Array.isArray(node)) {
      genNodeListAsArray(node, context)
    } else {
      genNode(node, context)
    }
    
    if (i < nodes.length - 1) {
      if (multilines) {
        push(',')
        context.newline()
      } else {
        push(', ')
      }
    }
  }
}

function genObjectExpression(node, context) {
  const { push, indent, deindent, newline } = context
  const { properties } = node
  
  if (!properties.length) {
    push('{}')
    return
  }
  
  const multilines = properties.length > 1
  
  push(multilines ? '{' : '{ ')
  
  if (multilines) {
    indent()
  }
  
  for (let i = 0; i < properties.length; i++) {
    const { key, value } = properties[i]
    
    if (multilines) {
      newline()
    }
    
    genExpressionAsPropertyKey(key, context)
    push(': ')
    genNode(value, context)
    
    if (i < properties.length - 1) {
      push(',')
    }
  }
  
  if (multilines) {
    deindent()
    newline()
  }
  
  push(multilines ? '}' : ' }')
}

// ===== 7. 工具函数 =====

function createSimpleExpression(content, isStatic = false) {
  return {
    type: 'SimpleExpression',
    content,
    isStatic
  }
}

function createObjectProperty(key, value) {
  return {
    type: 'Property',
    key,
    value
  }
}

function createObjectExpression(properties) {
  return {
    type: 'ObjectExpression',
    properties
  }
}

function createArrayExpression(elements) {
  return {
    type: 'ArrayExpression',
    elements
  }
}

function createCallExpression(callee, args) {
  return {
    type: 'CallExpression',
    callee,
    arguments: args
  }
}

function parseForExpression(input) {
  const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/
  const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
  const stripParensRE = /^\(|\)$/g
  
  const match = input.match(forAliasRE)
  if (!match) return
  
  const [, LHS, RHS] = match
  
  const result = {
    source: RHS.trim(),
    value: undefined,
    key: undefined,
    index: undefined
  }
  
  const trimmedLHS = LHS.trim().replace(stripParensRE, '').trim()
  const iteratorMatch = trimmedLHS.match(forIteratorRE)
  
  if (iteratorMatch) {
    result.value = trimmedLHS.replace(forIteratorRE, '').trim()
    result.key = iteratorMatch[1].trim()
    if (iteratorMatch[2]) {
      result.index = iteratorMatch[2].trim()
    }
  } else {
    result.value = trimmedLHS
  }
  
  return result
}

function processExpression(exp, context) {
  // 简化的表达式处理
  return exp
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// ===== 8. 编译器主函数 =====

function compile(template, options = {}) {
  console.log('🔧 开始编译模板...')
  console.log('模板内容:', template)
  
  try {
    // 1. 词法分析
    console.log('\n📝 1. 词法分析阶段')
    const tokenizer = new Tokenizer(template)
    const tokens = tokenizer.tokenize()
    console.log('Token列表:', tokens)
    
    // 2. 语法分析
    console.log('\n🌲 2. 语法分析阶段')
    const parser = new Parser(tokens)
    const ast = parser.parse()
    console.log('AST结构:', JSON.stringify(ast, null, 2))
    
    // 3. AST转换
    console.log('\n🔄 3. AST转换阶段')
    transform(ast, options)
    console.log('转换后AST:', JSON.stringify(ast, null, 2))
    
    // 4. 代码生成
    console.log('\n⚡ 4. 代码生成阶段')
    const result = generate(ast, options)
    console.log('生成的代码:')
    console.log(result.code)
    
    return result
    
  } catch (error) {
    console.error('❌ 编译错误:', error)
    throw error
  }
}

// ===== 9. 演示函数 =====

function demonstrateCompilation() {
  console.log('=== Vue3编译系统演示 ===\n')
  
  // 演示1: 基本模板编译
  console.log('📋 演示1: 基本模板编译')
  console.log('========================')
  
  const basicTemplate = `
    <div class="container">
      <h1>{{ title }}</h1>
      <p>Hello World</p>
    </div>
  `
  
  compile(basicTemplate.trim())
  
  // 演示2: 带指令的模板
  setTimeout(() => {
    console.log('\n📋 演示2: 带指令的模板编译')
    console.log('============================')
    
    const directiveTemplate = `
      <div>
        <button @click="increment" :disabled="loading">
          {{ count }}
        </button>
        <p v-if="showMessage">{{ message }}</p>
      </div>
    `
    
    compile(directiveTemplate.trim())
  }, 1000)
  
  // 演示3: 列表渲染
  setTimeout(() => {
    console.log('\n📋 演示3: 列表渲染编译')
    console.log('========================')
    
    const listTemplate = `
      <ul>
        <li v-for="(item, index) in items" :key="item.id">
          {{ index }}: {{ item.name }}
        </li>
      </ul>
    `
    
    compile(listTemplate.trim())
  }, 2000)
  
  // 演示4: 复杂模板
  setTimeout(() => {
    console.log('\n📋 演示4: 复杂模板编译')
    console.log('========================')
    
    const complexTemplate = `
      <div class="app">
        <header>
          <h1>{{ appTitle }}</h1>
          <nav>
            <a v-for="link in navLinks" :key="link.id" :href="link.url">
              {{ link.text }}
            </a>
          </nav>
        </header>
        <main>
          <section v-if="loading">
            <p>Loading...</p>
          </section>
          <section v-else>
            <article v-for="post in posts" :key="post.id">
              <h2>{{ post.title }}</h2>
              <p>{{ post.content }}</p>
              <button @click="likePost(post)" :class="{ active: post.liked }">
                Like ({{ post.likes }})
              </button>
            </article>
          </section>
        </main>
      </div>
    `
    
    compile(complexTemplate.trim())
  }, 3000)
}

// ===== 10. 优化分析器 =====

class OptimizationAnalyzer {
  constructor() {
    this.report = {
      staticNodes: 0,
      dynamicNodes: 0,
      hoistedNodes: 0,
      patchFlags: {},
      suggestions: []
    }
  }
  
  analyze(ast) {
    this.traverseForOptimization(ast)
    return this.generateReport()
  }
  
  traverseForOptimization(node) {
    if (!node || typeof node !== 'object') return
    
    switch (node.type) {
      case 'Element':
        this.analyzeElement(node)
        break
      case 'Text':
        if (this.isStaticText(node)) {
          this.report.staticNodes++
        } else {
          this.report.dynamicNodes++
        }
        break
      case 'Interpolation':
        this.report.dynamicNodes++
        break
    }
    
    if (node.children) {
      node.children.forEach(child => this.traverseForOptimization(child))
    }
    
    if (node.branches) {
      node.branches.forEach(branch => this.traverseForOptimization(branch))
    }
  }
  
  analyzeElement(node) {
    const hasStaticProps = node.props.every(prop => 
      prop.type === 'Attribute' && prop.value && prop.value.type === 'TextLiteral'
    )
    
    const hasStaticChildren = node.children.every(child => 
      child.type === 'Text' && this.isStaticText(child)
    )
    
    if (hasStaticProps && hasStaticChildren) {
      this.report.staticNodes++
      this.report.hoistedNodes++
    } else {
      this.report.dynamicNodes++
    }
    
    // 分析patch flag
    if (node.codegenNode && node.codegenNode.patchFlag) {
      const flag = node.codegenNode.patchFlag
      this.report.patchFlags[flag] = (this.report.patchFlags[flag] || 0) + 1
    }
  }
  
  isStaticText(node) {
    return node.type === 'Text' && !node.content.includes('{{')
  }
  
  generateReport() {
    const total = this.report.staticNodes + this.report.dynamicNodes
    const staticPercentage = ((this.report.staticNodes / total) * 100).toFixed(1)
    
    // 生成优化建议
    if (this.report.staticNodes / total < 0.3) {
      this.report.suggestions.push('建议增加静态内容以提高性能')
    }
    
    if (this.report.hoistedNodes < this.report.staticNodes) {
      this.report.suggestions.push('考虑使用v-once指令缓存静态内容')
    }
    
    return {
      ...this.report,
      total,
      staticPercentage: `${staticPercentage}%`,
      optimizationScore: Math.round((this.report.staticNodes / total) * 100)
    }
  }
}

// 导出主要函数
if (typeof module !== 'undefined') {
  module.exports = {
    Tokenizer,
    Parser,
    TransformContext,
    CodegenContext,
    compile,
    transform,
    generate,
    OptimizationAnalyzer,
    demonstrateCompilation
  }
}

// 浏览器环境自动运行
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    demonstrateCompilation()
  })
} 