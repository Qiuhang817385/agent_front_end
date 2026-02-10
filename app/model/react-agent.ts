import * as dotenv from 'dotenv'
import { ChatDeepSeek } from '@langchain/deepseek'
import { PromptTemplate } from '@langchain/core/prompts'
import { ToolManager } from '@/app/utils/tool-manager'

dotenv.config()

export type AgentState = {
  question: string
  thought: string
  action: string
  actionInput: any
  observation: string
  answer: string
  step: number
}

export class ReActAgent {
  private llm: ChatDeepSeek
  private tools: ToolManager
  private maxSteps = 5

  constructor() {
    this.llm = new ChatDeepSeek({ model: 'deepseek-chat', temperature: 0 })
    this.tools = new ToolManager()
  }

  private getPrompt() {
    return PromptTemplate.fromTemplate(`
  你是一个智能助手，可以调用工具来完成任务。
  
  可用工具：
  {tools}
  
  思考过程：
  1. 分析问题，确定需要使用的工具
  2. 调用工具获取信息
  3. 基于结果继续思考或给出最终答案
  
  格式：
  思考：<你的推理过程>
  行动：<工具名称>
  行动输入：<工具参数>
  观察：<工具返回结果>
  ... (可以重复思考-行动-观察)
  思考：<最终推理>
  最终答案：<给用户的答案>
  
  问题：{question}
  思考：`)
  }

  async run(question: string): Promise<AgentState[]> {
    const steps: AgentState[] = []
    let currentThought = ''
    let step = 0

    while (step < this.maxSteps) {
      const prompt = this.getPrompt()
      const toolsDesc = this.tools
        .getAllTools()
        .map((t) => `${t.name}: ${t.description}`)
        .join('\n')

      const response = await prompt.pipe(this.llm).invoke({
        question,
        tools: toolsDesc,
        thought: currentThought,
      })

      const content = response.content as string // 解析响应（简化版，实际需要更复杂的解析）

      const thoughtMatch = content.match(/思考：(.*?)(?=\n|$)/)
      const actionMatch = content.match(/行动：(.*?)(?=\n|$)/)
      const inputMatch = content.match(/行动输入：(.*?)(?=\n|$)/)
      const answerMatch = content.match(/最终答案：(.*?)(?=\n|$)/)

      if (answerMatch) {
        steps.push({
          question,
          thought: thoughtMatch?.[1] || '',
          action: '',
          actionInput: {},
          observation: '',
          answer: answerMatch[1],
          step,
        })
        break
      }

      if (actionMatch && inputMatch) {
        const action = actionMatch[1].trim()
        const actionInput = JSON.parse(inputMatch[1]) // 执行工具

        const observation = await this.tools.execute(action, actionInput)

        steps.push({
          question,
          thought: thoughtMatch?.[1] || '',
          action,
          actionInput,
          observation,
          answer: '',
          step,
        })

        currentThought += `\n思考：${thoughtMatch?.[1]}\n行动：${action}\n观察：${observation}\n`
        step++
      } else {
        break
      }
    }

    return steps
  }
}
