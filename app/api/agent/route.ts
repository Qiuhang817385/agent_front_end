import { NextRequest } from 'next/server'
import { ReActAgent } from '@/app/model/react-agent'
import { MultiAgentSystem } from '@/app/model/multi-agent'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { message, agentType = 'react' } = await req.json()

  try {
    let result

    if (agentType === 'react') {
      const agent = new ReActAgent()
      result = await agent.run(message)
    } else if (agentType === 'multi') {
      const system = new MultiAgentSystem()
      result = await system.collaborate(message)
    } else {
      return Response.json({ error: '不支持的 Agent 类型' }, { status: 400 })
    }
    console.log('result', result)

    return Response.json({ success: true, data: result })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
