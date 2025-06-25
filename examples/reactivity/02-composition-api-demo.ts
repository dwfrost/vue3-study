/**
 * Vue3 Composition API TypeScript示例
 * 展示如何使用Composition API创建可复用的逻辑
 */

import { ref, computed, watch, onMounted, onUnmounted, readonly, Ref, ComputedRef } from 'vue'

// ===== 基础响应式示例 =====

// 1. 简单计数器
export function useCounter(initialValue: number = 0) {
  const count = ref<number>(initialValue)
  
  const increment = (): void => {
    count.value++
  }
  
  const decrement = (): void => {
    count.value--
  }
  
  const reset = (): void => {
    count.value = initialValue
  }
  
  return {
    count: readonly(count),  // 返回只读版本，保护内部状态
    increment,
    decrement,
    reset
  }
}

// ===== 鼠标位置追踪 =====

interface MousePosition {
  x: number
  y: number
}

export function useMouse(): {
  x: Ref<number>
  y: Ref<number>
  position: ComputedRef<MousePosition>
} {
  const x = ref<number>(0)
  const y = ref<number>(0)
  
  const position = computed<MousePosition>(() => ({
    x: x.value,
    y: y.value
  }))
  
  const updatePosition = (event: MouseEvent): void => {
    x.value = event.clientX
    y.value = event.clientY
  }
  
  onMounted(() => {
    window.addEventListener('mousemove', updatePosition)
  })
  
  onUnmounted(() => {
    window.removeEventListener('mousemove', updatePosition)
  })
  
  return {
    x,
    y,
    position
  }
}

// ===== 本地存储 =====

export function useLocalStorage<T>(
  key: string, 
  defaultValue: T
): [Ref<T>, (value: T) => void] {
  const stored = localStorage.getItem(key)
  const initialValue = stored ? JSON.parse(stored) : defaultValue
  
  const storedValue = ref<T>(initialValue)
  
  const setValue = (value: T): void => {
    storedValue.value = value
    localStorage.setItem(key, JSON.stringify(value))
  }
  
  // 监听值的变化，自动同步到localStorage
  watch(
    storedValue,
    (newValue) => {
      localStorage.setItem(key, JSON.stringify(newValue))
    },
    { deep: true }
  )
  
  return [storedValue, setValue]
}

// ===== 异步数据获取 =====

interface AsyncState<T> {
  data: Ref<T | null>
  loading: Ref<boolean>
  error: Ref<Error | null>
  execute: () => Promise<void>
}

export function useAsyncData<T>(
  asyncFunction: () => Promise<T>
): AsyncState<T> {
  const data = ref<T | null>(null)
  const loading = ref<boolean>(false)
  const error = ref<Error | null>(null)
  
  const execute = async (): Promise<void> => {
    try {
      loading.value = true
      error.value = null
      data.value = await asyncFunction()
    } catch (err) {
      error.value = err as Error
    } finally {
      loading.value = false
    }
  }
  
  return {
    data,
    loading,
    error,
    execute
  }
}

// ===== 表单处理 =====

interface FormField<T> {
  value: Ref<T>
  error: Ref<string | null>
  validate: () => boolean
  reset: () => void
}

type ValidationRule<T> = (value: T) => string | null

export function useFormField<T>(
  initialValue: T,
  validationRules: ValidationRule<T>[] = []
): FormField<T> {
  const value = ref<T>(initialValue)
  const error = ref<string | null>(null)
  
  const validate = (): boolean => {
    for (const rule of validationRules) {
      const result = rule(value.value)
      if (result !== null) {
        error.value = result
        return false
      }
    }
    error.value = null
    return true
  }
  
  const reset = (): void => {
    value.value = initialValue
    error.value = null
  }
  
  // 值变化时自动验证
  watch(value, () => {
    if (error.value) {
      validate()
    }
  })
  
  return {
    value,
    error,
    validate,
    reset
  }
}

// ===== 使用示例 =====

// 在Vue组件中使用
/*
<template>
  <div>
    <!-- 计数器 -->
    <div>
      <p>Count: {{ count }}</p>
      <button @click="increment">+</button>
      <button @click="decrement">-</button>
      <button @click="reset">Reset</button>
    </div>
    
    <!-- 鼠标位置 -->
    <div>
      <p>Mouse: {{ position.x }}, {{ position.y }}</p>
    </div>
    
    <!-- 表单 -->
    <div>
      <input v-model="username.value" placeholder="Username" />
      <p v-if="username.error" class="error">{{ username.error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCounter, useMouse, useFormField } from './composables'

// 使用计数器
const { count, increment, decrement, reset } = useCounter(0)

// 使用鼠标位置
const { position } = useMouse()

// 使用表单字段
const username = useFormField('', [
  (value: string) => value.length < 3 ? '用户名至少3个字符' : null,
  (value: string) => /^[a-zA-Z0-9]+$/.test(value) ? null : '用户名只能包含字母和数字'
])
</script>
*/

// ===== 高级模式：组合多个composable =====

export function useUserProfile(userId: string) {
  // 组合多个composable
  const { data: user, loading, error, execute: fetchUser } = useAsyncData(
    () => fetch(`/api/users/${userId}`).then(res => res.json())
  )
  
  const [preferences, setPreferences] = useLocalStorage(`user_${userId}_preferences`, {
    theme: 'light',
    language: 'zh-CN'
  })
  
  // 计算属性
  const displayName = computed(() => {
    return user.value ? `${user.value.firstName} ${user.value.lastName}` : 'Unknown User'
  })
  
  // 自动获取用户数据
  onMounted(() => {
    fetchUser()
  })
  
  return {
    user,
    loading,
    error,
    preferences,
    displayName,
    setPreferences,
    refetch: fetchUser
  }
}

/**
 * Composition API的优势：
 * 
 * 1. 类型安全：完整的TypeScript支持
 * 2. 逻辑复用：可以在多个组件间共享
 * 3. 代码组织：相关逻辑集中在一起
 * 4. 测试友好：可以独立测试每个composable
 * 5. 树摇优化：未使用的代码不会被打包
 */ 