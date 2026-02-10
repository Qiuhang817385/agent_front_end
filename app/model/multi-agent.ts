import { ChatDeepSeek } from '@langchain/deepseek'
import { PromptTemplate } from '@langchain/core/prompts'
import * as dotenv from 'dotenv'

export interface AgentRole {
  name: string
  description: string
  expertise: string[]
  tools: string[]
}

dotenv.config()

export const AGENT_ROLES: AgentRole[] = [
  {
    name: '研究员',
    description: '负责信息收集和事实核查',
    expertise: ['搜索', '验证', '总结'],
    tools: ['search', 'get_time'],
  },
  {
    name: '分析师',
    description: '负责数据分析和洞察',
    expertise: ['计算', '统计', '可视化'],
    // tools: ['calculator', 'analyze_data'],
    tools: ['calculator'],
  },
  {
    name: '协调员',
    description: '负责任务分配和结果整合',
    expertise: ['规划', '协调', '总结'],
    tools: ['get_time'],
  },
]

export class MultiAgentSystem {
  private agents: Map<string, any> = new Map()
  private llm: ChatDeepSeek

  constructor() {
    this.llm = new ChatDeepSeek({
      model: 'deepseek-chat',
      temperature: 0.7,
    })
    this.initializeAgents()
  }

  private initializeAgents() {
    for (const role of AGENT_ROLES) {
      this.agents.set(role.name, {
        role,
        llm: new ChatDeepSeek({
          model: 'deepseek-chat',
          temperature: 0.5,
        }),
        prompt: this.createRolePrompt(role),
      })
    }
  }

  private createRolePrompt(role: AgentRole) {
    return PromptTemplate.fromTemplate(`
    你是 ${role.name}，${role.description}
    
    你的专长：${role.expertise.join(', ')}
    可用工具：${role.tools.join(', ')}
    
    任务：{task}
    当前状态：{state}
    其他 Agent 的意见：{other_opinions}
    
    请基于你的专长提供建议或执行任务：
    `)
  }

  async collaborate(task: string): Promise<any> {
    const results: any = {}
    const opinions: string[] = [] // 第一轮：各 Agent 独立分析

    for (const [name, agent] of this.agents) {
      const response = await agent.prompt.pipe(agent.llm).invoke({
        task,
        state: '初始分析阶段',
        other_opinions: '暂无',
      })

      results[name] = response.content
      opinions.push(`${name}: ${response.content}`)
    } // 第二轮：基于其他 Agent 意见调整

    for (const [name, agent] of this.agents) {
      const otherOpinions = opinions.filter((o) => !o.startsWith(name))
      const response = await agent.prompt.pipe(agent.llm).invoke({
        task,
        state: '协作调整阶段',
        other_opinions: otherOpinions.join('\n'),
      })

      results[`${name}_final`] = response.content
    } // 最终整合

    const coordinator = this.agents.get('协调员')
    const finalResponse = await coordinator.prompt
      .pipe(coordinator.llm)
      .invoke({
        task,
        state: '最终整合',
        other_opinions: Object.entries(results)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n'),
      })

    return {
      individual_results: results,
      final_answer: finalResponse.content,
    }
  }
}
