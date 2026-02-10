import { NextRequest } from 'next/server'
import { buildMinimalGraph } from '@/app/example/LangGraph/minimal'

export const runtime = 'nodejs'

// 极为简单的一个 graph 示例，输入一个字符串，输出一个字符串
export async function POST(req: NextRequest) {
  const body = await req.json()
  const app = await buildMinimalGraph()

  // result { input: 'qweeqweeqwdqwsdasdsa', result: '输出 :qweeqweeqwdqwsdasdsa'
  try {
    const result = await app.invoke({
      input: body.input,
    })

    return Response.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
