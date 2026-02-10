import { ChatDeepSeek } from '@langchain/deepseek'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { createAgent } from 'langchain'

const model = new ChatDeepSeek({ model: 'deepseek-chat', temperature: 0 })

const add = tool(
  (params) => {
    const { a, b } = params as { a: number; b: number }
    return a + b
  },
  {
    name: 'add',
    description: 'add two numbers',
    schema: z.object({
      a: z.number(),
      b: z.number(),
    }),
  }
)

const weather = tool(
  (params) => {
    return '天气晴朗'
  },
  {
    name: 'weather',
    description: 'get the weather',
  }
)

const agent = await createAgent({
  model,
  tools: [add, weather],
})

export { agent }
