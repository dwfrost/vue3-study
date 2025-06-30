# 第11章：组合式API深度解析

## 本章概述

组合式API是Vue3最重要的新特性之一，它提供了一种更灵活、更强大的方式来组织和复用组件逻辑。本章将深入探讨组合式API的设计理念、核心实现原理、各种API的使用方法和最佳实践，帮助你全面掌握这一革命性的特性。

## 学习目标

- 深入理解组合式API的设计理念和核心原理
- 掌握setup函数的执行机制和上下文管理
- 熟练使用各种响应式API及其底层实现
- 了解生命周期hooks的工作原理
- 掌握依赖注入系统和逻辑复用最佳实践
- 理解与Options API的本质差异和迁移策略

## 11.1 组合式API设计理念

### 11.1.1 从Options API到Composition API的演进

**Options API的核心问题**

```javascript
// Options API在大型组件中的问题示例 - 用户仪表盘组件
export default {
  name: 'UserDashboard',
  data() {
    return {
      // 用户相关状态 - 分散在data中
      user: null,
      userLoading: false,
      userError: null,
      
      // 订单相关状态 - 分散在data中
      orders: [],
      ordersLoading: false,
      ordersError: null,
      orderFilter: 'all',
      
      // 统计相关状态 - 分散在data中
      stats: null,
      statsLoading: false,
      statsError: null,
      
      // UI状态 - 分散在data中
      activeTab: 'profile',
      sidebarCollapsed: false
    }
  },
  computed: {
    // 用户相关计算属性 - 分散在computed中
    userName() { return this.user?.name || 'Unknown User' },
    userAvatar() { return this.user?.avatar || '/default-avatar.png' },
    
    // 订单相关计算属性 - 分散在computed中
    filteredOrders() {
      return this.orderFilter === 'all' 
        ? this.orders 
        : this.orders.filter(order => order.status === this.orderFilter)
    },
    totalOrderValue() {
      return this.filteredOrders.reduce((sum, order) => sum + order.amount, 0)
    },
    
    // 统计相关计算属性 - 分散在computed中
    monthlyRevenue() { return this.stats?.monthly_revenue || 0 },
    growthRate() { return this.stats?.growth_rate || 0 }
  },
  methods: {
    // 用户相关方法 - 分散在methods中
    async fetchUser() {
      this.userLoading = true
      try {
        this.user = await userAPI.getCurrentUser()
        this.userError = null
      } catch (error) {
        this.userError = error.message
      } finally {
        this.userLoading = false
      }
    },
    
    // 订单相关方法 - 分散在methods中
    async fetchOrders() {
      this.ordersLoading = true
      try {
        this.orders = await orderAPI.getUserOrders()
        this.ordersError = null
      } catch (error) {
        this.ordersError = error.message
      } finally {
        this.ordersLoading = false
      }
    },
    
    setOrderFilter(filter) { this.orderFilter = filter },
    
    // 统计相关方法 - 分散在methods中
    async fetchStats() {
      this.statsLoading = true
      try {
        this.stats = await statsAPI.getUserStats()
        this.statsError = null
      } catch (error) {
        this.statsError = error.message
      } finally {
        this.statsLoading = false
      }
    },
    
    // UI方法 - 分散在methods中
    setActiveTab(tab) { this.activeTab = tab },
    toggleSidebar() { this.sidebarCollapsed = !this.sidebarCollapsed }
  },
  
  async mounted() {
    await Promise.all([
      this.fetchUser(),
      this.fetchOrders(), 
      this.fetchStats()
    ])
  },
  
  watch: {
    user: {
      handler(newUser) {
        if (newUser) {
          this.fetchOrders()
          this.fetchStats()
        }
      },
      deep: true
    }
  }
}

/*
Options API的问题总结：
1. 逻辑分散：相关的状态、计算属性、方法被分散在不同选项中
2. 复用困难：逻辑与组件强耦合，难以提取和复用
3. 类型推导：TypeScript支持不够友好，this的类型推导复杂
4. 代码组织：随着功能增加，组件变得越来越难以维护
5. 测试困难：业务逻辑与组件实例绑定，单元测试不够纯粹
*/
```

**Composition API的解决方案**

```javascript
// 使用Composition API重构 - 逻辑按功能分组
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useUser } from '@/composables/useUser'
import { useOrders } from '@/composables/useOrders'
import { useStats } from '@/composables/useStats'
import { useUI } from '@/composables/useUI'

export default {
  name: 'UserDashboard',
  setup() {
    // 1. 用户逻辑模块 - 所有用户相关逻辑集中
    const {
      user,
      userLoading,
      userError,
      fetchUser,
      updateUser
    } = useUser()
    
    // 2. 订单逻辑模块 - 所有订单相关逻辑集中
    const {
      orders,
      ordersLoading,
      ordersError,
      orderFilter,
      filteredOrders,
      totalOrderValue,
      fetchOrders,
      setOrderFilter
    } = useOrders()
    
    // 3. 统计逻辑模块 - 所有统计相关逻辑集中
    const {
      stats,
      statsLoading,
      statsError,
      monthlyRevenue,
      growthRate,
      fetchStats
    } = useStats()
    
    // 4. UI状态逻辑模块 - 所有UI相关逻辑集中
    const {
      activeTab,
      sidebarCollapsed,
      setActiveTab,
      toggleSidebar
    } = useUI()
    
    // 5. 组合逻辑：用户变化时重新获取相关数据
    watch(user, (newUser) => {
      if (newUser) {
        fetchOrders()
        fetchStats()
      }
    }, { deep: true })
    
    // 6. 初始化逻辑
    onMounted(async () => {
      await Promise.all([
        fetchUser(),
        fetchOrders(),
        fetchStats()
      ])
    })
    
    // 7. 暴露给模板的API - 清晰明确
    return {
      // 用户相关
      user, userLoading, userError, updateUser,
      
      // 订单相关
      orders, ordersLoading, ordersError, orderFilter, 
      filteredOrders, totalOrderValue, setOrderFilter,
      
      // 统计相关
      stats, statsLoading, statsError, monthlyRevenue, growthRate,
      
      // UI相关
      activeTab, sidebarCollapsed, setActiveTab, toggleSidebar
    }
  }
}

/*
Composition API的优势：
1. 逻辑集中：相关逻辑被组织在独立的composable函数中
2. 易于复用：每个composable都可以在其他组件中重用
3. 类型友好：TypeScript类型推导更准确
4. 测试友好：每个composable都可以独立测试
5. 代码清晰：主组件只负责组合逻辑，职责清晰
*/
```

### 11.1.2 组合式API的核心设计理念

**1. 逻辑关注点分离（Separation of Concerns）**

```javascript
// composables/useUser.js - 用户相关逻辑的完整封装
import { ref, computed, readonly } from 'vue'
import { userAPI } from '@/api/user'

export function useUser() {
  // 私有状态
  const user = ref(null)
  const loading = ref(false)
  const error = ref(null)
  
  // 公共计算属性
  const userName = computed(() => user.value?.name || 'Unknown User')
  const userAvatar = computed(() => user.value?.avatar || '/default-avatar.png')
  const isLoggedIn = computed(() => !!user.value)
  const userRole = computed(() => user.value?.role || 'guest')
  
  // 公共方法
  const fetchUser = async () => {
    loading.value = true
    error.value = null
    try {
      const userData = await userAPI.getCurrentUser()
      user.value = userData
      return userData
    } catch (err) {
      error.value = err.message
      console.error('获取用户信息失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const updateUser = async (userData) => {
    loading.value = true
    error.value = null
    try {
      const updatedUser = await userAPI.updateUser(userData)
      user.value = updatedUser
      return updatedUser
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const logout = () => {
    user.value = null
    error.value = null
    // 清理相关状态
    localStorage.removeItem('token')
    sessionStorage.clear()
  }
  
  // 重置错误状态
  const clearError = () => {
    error.value = null
  }
  
  // 返回公共API - 使用readonly保护内部状态
  return {
    // 只读状态
    user: readonly(user),
    loading,
    error,
    
    // 计算属性
    userName,
    userAvatar,
    isLoggedIn,
    userRole,
    
    // 方法
    fetchUser,
    updateUser,
    logout,
    clearError
  }
}
```

**2. 可组合性（Composability）**

```javascript
// composables/useOrders.js - 订单逻辑，依赖用户信息
import { ref, computed, watch } from 'vue'
import { orderAPI } from '@/api/order'

export function useOrders(userId) {
  const orders = ref([])
  const loading = ref(false)
  const error = ref(null)
  const filter = ref('all')
  
  // 计算属性
  const filteredOrders = computed(() => {
    if (!orders.value) return []
    return filter.value === 'all' 
      ? orders.value 
      : orders.value.filter(order => order.status === filter.value)
  })
  
  const totalValue = computed(() => {
    return filteredOrders.value.reduce((sum, order) => sum + order.amount, 0)
  })
  
  const ordersByStatus = computed(() => {
    const groups = { pending: [], completed: [], cancelled: [] }
    orders.value.forEach(order => {
      if (groups[order.status]) {
        groups[order.status].push(order)
      }
    })
    return groups
  })
  
  const orderStats = computed(() => ({
    total: orders.value.length,
    pending: ordersByStatus.value.pending.length,
    completed: ordersByStatus.value.completed.length,
    cancelled: ordersByStatus.value.cancelled.length,
    totalValue: totalValue.value
  }))
  
  // 方法
  const fetchOrders = async () => {
    if (!userId?.value) return
    
    loading.value = true
    error.value = null
    try {
      const orderData = await orderAPI.getUserOrders(userId.value)
      orders.value = orderData
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }
  
  const setFilter = (newFilter) => {
    filter.value = newFilter
  }
  
  const cancelOrder = async (orderId) => {
    try {
      await orderAPI.cancelOrder(orderId)
      const orderIndex = orders.value.findIndex(o => o.id === orderId)
      if (orderIndex > -1) {
        orders.value[orderIndex].status = 'cancelled'
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }
  
  // 响应userId变化，自动重新获取订单
  if (userId) {
    watch(userId, (newUserId) => {
      if (newUserId) {
        fetchOrders()
      } else {
        orders.value = []
      }
    }, { immediate: true })
  }
  
  return {
    orders,
    loading,
    error,
    filter,
    filteredOrders,
    totalValue,
    ordersByStatus,
    orderStats,
    fetchOrders,
    setFilter,
    cancelOrder
  }
}
```

**3. 高阶组合模式**

```javascript
// composables/useDashboard.js - 高阶组合，聚合多个composable
import { computed } from 'vue'
import { useUser } from './useUser'
import { useOrders } from './useOrders'
import { useStats } from './useStats'

export function useDashboard() {
  // 基础composables
  const userComposable = useUser()
  const ordersComposable = useOrders(computed(() => userComposable.user.value?.id))
  const statsComposable = useStats(computed(() => userComposable.user.value?.id))
  
  // 聚合状态
  const isLoading = computed(() => {
    return userComposable.loading.value || 
           ordersComposable.loading.value || 
           statsComposable.loading.value
  })
  
  const hasError = computed(() => {
    return !!(userComposable.error.value || 
              ordersComposable.error.value || 
              statsComposable.error.value)
  })
  
  const allErrors = computed(() => {
    return [
      userComposable.error.value,
      ordersComposable.error.value,
      statsComposable.error.value
    ].filter(Boolean)
  })
  
  // 聚合数据
  const dashboardData = computed(() => ({
    user: userComposable.user.value,
    orders: ordersComposable.orders.value,
    orderStats: ordersComposable.orderStats.value,
    stats: statsComposable.stats.value
  }))
  
  // 聚合方法
  const initializeDashboard = async () => {
    try {
      await userComposable.fetchUser()
      // 用户数据获取成功后，订单和统计会通过watch自动获取
    } catch (error) {
      console.error('仪表盘初始化失败:', error)
    }
  }
  
  const refreshAllData = async () => {
    await Promise.all([
      userComposable.fetchUser(),
      ordersComposable.fetchOrders(),
      statsComposable.fetchStats()
    ])
  }
  
  const clearAllErrors = () => {
    userComposable.clearError()
    ordersComposable.error.value = null
    statsComposable.error.value = null
  }
  
  return {
    // 聚合状态
    isLoading,
    hasError,
    allErrors,
    dashboardData,
    
    // 分模块访问
    user: userComposable,
    orders: ordersComposable,
    stats: statsComposable,
    
    // 聚合方法
    initializeDashboard,
    refreshAllData,
    clearAllErrors
  }
}
```

## 11.2 setup函数深度解析

### 11.2.1 setup函数的执行时机和上下文

```typescript
// setup函数在组件生命周期中的精确位置
interface ComponentLifecycleFlow {
  '1. 组件实例创建': 'createComponentInstance()'
  '2. Props解析和验证': 'initProps()'  
  '3. setup函数执行': 'setup(props, context)' // <- 关键执行点
  '4. 数据选项初始化': 'initData()'
  '5. 计算属性初始化': 'initComputed()'
  '6. 侦听器初始化': 'initWatch()'
  '7. 生命周期钩子': 'created()'
  '8. 模板编译': 'compile()'
  '9. 挂载阶段': 'mount()'
}

// setup函数的详细执行机制
function setupComponent(instance: ComponentInternalInstance) {
  const { setup } = instance.type as ComponentOptions
  
  if (setup) {
    // 1. 设置当前组件实例上下文 - 关键步骤
    setCurrentInstance(instance)
    
    // 2. 创建setup专用的上下文对象
    const setupContext = createSetupContext(instance)
    
    // 3. 执行setup函数 - 传入响应式props和context
    const setupResult = callWithErrorHandling(
      setup,
      instance,
      ErrorCodes.SETUP_FUNCTION,
      [
        shallowReadonly(instance.props), // 第一个参数：只读的props代理
        setupContext                    // 第二个参数：context对象
      ]
    )
    
    // 4. 清理当前实例上下文
    unsetCurrentInstance()
    
    // 5. 处理setup返回值
    handleSetupResult(instance, setupResult)
  }
}

// setup上下文对象的创建和管理
function createSetupContext(instance: ComponentInternalInstance): SetupContext {
  return {
    // attrs: 非prop的attribute，响应式代理
    get attrs() {
      return getAttrsProxy(instance)
    },
    
    // slots: 插槽对象，包含所有插槽内容
    get slots() {
      return getSlotsProxy(instance)
    },
    
    // emit: 事件发射函数，类型安全
    emit: instance.emit,
    
    // expose: 暴露组件内部API给父组件
    expose(exposed?: Record<string, any>) {
      if (__DEV__ && instance.exposed) {
        warn('expose() should be called only once per setup().')
      }
      instance.exposed = exposed || {}
    }
  }
}
```

**setup函数参数的深入使用**

```javascript
export default {
  name: 'AdvancedComponent',
  props: {
    title: {
      type: String,
      required: true
    },
    count: {
      type: Number,
      default: 0,
      validator: (value) => value >= 0
    },
    config: {
      type: Object,
      default: () => ({})
    }
  },
  emits: {
    // 声明事件及其验证
    'update:count': (value) => typeof value === 'number',
    'change': (event) => event && typeof event === 'object',
    'delete': null // 无参数事件
  },
  setup(props, context) {
    // === 第一个参数：props 的高级用法 ===
    
    // ❌ 错误：直接解构会失去响应性
    // const { title, count } = props
    
    // ✅ 正确：使用toRefs保持响应性
    const { title, count, config } = toRefs(props)
    
    // ✅ 也可以选择性地转换某些属性
    const reactiveCount = toRef(props, 'count')
    
    // 监听props变化
    watch(count, (newCount, oldCount) => {
      console.log(`Count changed from ${oldCount} to ${newCount}`)
    })
    
    // 在计算属性中使用props
    const displayTitle = computed(() => {
      return `${title.value} (${count.value})`
    })
    
    // === 第二个参数：context 的详细用法 ===
    const { attrs, slots, emit, expose } = context
    
    // 1. attrs - 非prop属性的使用
    const handleNativeClick = (event) => {
      // 获取所有非prop属性
      console.log('Non-prop attributes:', attrs)
      
      // 常用的非prop属性
      const { class: className, style, id } = attrs
      console.log('CSS类:', className)
      console.log('样式:', style) 
      console.log('ID:', id)
    }
    
    // 2. slots - 插槽内容的处理
    const renderSlotContent = () => {
      // 检查插槽是否存在
      const hasDefaultSlot = !!slots.default
      const hasHeaderSlot = !!slots.header
      const hasFooterSlot = !!slots.footer
      
      // 动态渲染插槽
      return {
        defaultContent: hasDefaultSlot ? slots.default() : null,
        headerContent: hasHeaderSlot ? slots.header({ title: title.value }) : null,
        footerContent: hasFooterSlot ? slots.footer({ count: count.value }) : null
      }
    }
    
    // 3. emit - 事件发射的类型安全使用
    const handleIncrement = () => {
      const newCount = count.value + 1
      emit('update:count', newCount)
      emit('change', { 
        type: 'increment', 
        oldValue: count.value, 
        newValue: newCount 
      })
    }
    
    const handleDecrement = () => {
      if (count.value > 0) {
        const newCount = count.value - 1
        emit('update:count', newCount)
        emit('change', { 
          type: 'decrement', 
          oldValue: count.value, 
          newValue: newCount 
        })
      }
    }
    
    const handleDelete = () => {
      emit('delete')
    }
    
    // 4. expose - 暴露组件API
    const internalValue = ref('')
    const inputRef = ref()
    
    // 暴露给父组件的方法
    expose({
      // 公共方法
      focus() {
        inputRef.value?.focus()
      },
      
      blur() {
        inputRef.value?.blur()
      },
      
      getValue() {
        return internalValue.value
      },
      
      setValue(value) {
        internalValue.value = value
      },
      
      reset() {
        internalValue.value = ''
        emit('update:count', 0)
      },
      
      // 公共属性（只读）
      get isValid() {
        return internalValue.value.length > 0
      },
      
      get currentCount() {
        return count.value
      }
    })
    
    // === 返回给模板的数据和方法 ===
    return {
      // 响应式数据
      internalValue,
      displayTitle,
      
      // 方法
      handleIncrement,
      handleDecrement,
      handleDelete,
      handleNativeClick,
      renderSlotContent,
      
      // 引用
      inputRef
    }
  }
}
```

## 保存状态说明

第11章《组合式API深度解析》目前已完成：

### ✅ 已完成部分：
1. **11.1 组合式API设计理念**
   - Options API到Composition API的演进分析
   - 核心设计理念：逻辑关注点分离、可组合性、高阶组合
   - 详细的代码示例和对比

2. **11.2 setup函数深度解析**
   - 执行时机和上下文管理
   - props和context参数的高级用法
   - setup返回值处理机制（部分）

### 🔄 进行中/待完成：
3. **11.3 响应式API深入剖析**
   - ref系统完整实现
   - reactive系统深度剖析
   - computed计算属性实现原理
   - watch和watchEffect详解

4. **11.4 生命周期Hooks**
5. **11.5 依赖注入系统**
6. **11.6 逻辑复用最佳实践**
7. **11.7 与Options API对比和迁移**
