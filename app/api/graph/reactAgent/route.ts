import { agent } from '@/app/example/LangGraph/reactAgent'
import { HumanMessage } from '@langchain/core/messages'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  const body = await req.json()
  try {
    // 创建 ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 使用 LangGraph 的 stream 方法
          const streamEvents = await agent.stream(
            { messages: [new HumanMessage(body.messages)] },
            { streamMode: 'messages' }
          )

          for await (const chunk of streamEvents) {
            console.log('chunk', chunk)
            const [messageChunk, metadata] = chunk
            if (messageChunk?.content) {
              const chunkStr =
                JSON.stringify({
                  type: 'message',
                  content: messageChunk.content,
                }) + '\n'

              controller.enqueue(new TextEncoder().encode(chunkStr))
            }
            // const lastMessage = chunk.messages.at(-1)
            // if (lastMessage?.content) {
            //   controller.enqueue(lastMessage.content)
            // } else if (lastMessage?.tool_calls) {
            //   const toolCallNames = lastMessage.tool_calls.map((tc) => tc.name)
            //   controller.enqueue(
            //     new TextEncoder().encode(
            //       `Calling tools: ${toolCallNames.join(', ')}`
            //     )
            //   )
            // }
          }

          // for await (const event of streamEvents) {
          //   // 处理不同类型的事件
          //   if (event.event === 'on_chain_end') {
          //     const nodeName = event.name
          //     const data = event.data

          //     // 发送节点执行结果
          //     const chunk =
          //       JSON.stringify({
          //         type: 'node_end',
          //         node: nodeName,
          //         data: {
          //           messages: data.output?.messages || [],
          //           llmCalls: data.output?.llmCalls,
          //         },
          //       }) + '\n'

          //     controller.enqueue(new TextEncoder().encode(chunk))
          //   } else if (event.event === 'on_chain_start') {
          //     // 节点开始执行
          //     const chunk =
          //       JSON.stringify({
          //         type: 'node_start',
          //         node: event.name,
          //       }) + '\n'

          //     controller.enqueue(new TextEncoder().encode(chunk))
          //   }
          // }

          // 发送完成信号
          const finalChunk =
            JSON.stringify({
              type: 'done',
            }) + '\n'

          controller.enqueue(new TextEncoder().encode(finalChunk))
          controller.close()
        } catch (error: any) {
          const errorChunk =
            JSON.stringify({
              type: 'error',
              error: error.message,
            }) + '\n'

          controller.enqueue(new TextEncoder().encode(errorChunk))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: any) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  // try {
  //   const result = await app.invoke({
  //     messages: [new HumanMessage(body.messages)],
  //   })

  //   for (const message of result.messages) {
  //     console.log(`[${message.getType()}]: ${message.text}`)
  //   }

  //   return Response.json({
  //     success: true,
  //     data: result,
  //   })

  // } catch (error: any) {
  //   return Response.json(
  //     { success: false, error: error.message },
  //     { status: 500 }
  //   )
  // }
}
