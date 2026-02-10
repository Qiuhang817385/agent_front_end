// 文件：src/ch08/tools.ts
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

// 基础工具接口
export interface BaseTool {
  name: string
  description: string
  schema: z.ZodSchema
  func: (...args: any[]) => Promise<any>
}

// 搜索工具
export const SearchTool = new DynamicStructuredTool({
  name: 'search',
  description: '搜索网络信息，输入搜索关键词',
  schema: z.object({ query: z.string().describe('搜索关键词') }),
  func: async (input) => {
    const { query } = input as { query: string }
    // 模拟搜索，实际可接入 Google/Bing API
    return `搜索结果：${query} 的相关信息...`
  },
})

// 计算工具
const safeEval = (expr: string): number => {
  // 简化的安全计算实现
  const allowed = /^[0-9+\-*/().\s]+$/
  if (!allowed.test(expr)) throw new Error('包含非法字符')
  return Function(`"use strict"; return (${expr})`)()
}

export const CalculatorTool = new DynamicStructuredTool({
  name: 'calculator',
  description: '执行数学计算，支持加减乘除和基本函数',
  schema: z.object({ expression: z.string().describe('数学表达式，如 2+3*4') }),
  func: async (input) => {
    const { expression } = input as { expression: string }
    try {
      // 安全计算，避免 eval
      const result = safeEval(expression)
      return `计算结果：${result}`
    } catch (error) {
      return `计算错误：${error}`
    }
  },
})

// 时间工具
export const TimeTool = new DynamicStructuredTool({
  name: 'get_time',
  description: '获取当前时间信息',
  schema: z.object({}),
  func: async () => {
    const now = new Date()
    return `当前时间：${now.toLocaleString('zh-CN')}`
  },
})
