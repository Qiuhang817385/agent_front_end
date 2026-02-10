import {
  StateGraph,
  MessagesAnnotation,
  Annotation,
  messagesStateReducer,
  START,
  END,
  MessagesZodMeta,
} from '@langchain/langgraph'
import { createReactAgent } from '@langchain/langgraph/prebuilt'

import { ChatDeepSeek } from '@langchain/deepseek'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { registry } from '@langchain/langgraph/zod'
import {
  isAIMessage,
  ToolMessage,
  SystemMessage,
} from '@langchain/core/messages'
import { type BaseMessage } from '@langchain/core/messages'

// type FlowState = {
//   input: string
//   result?: string
//   error?: string
// }

// export const StateAnnotation = Annotation.Root({
//   messages: Annotation<BaseMessage[]>({
//     reducer: messagesStateReducer,
//     default: () => [],
//   }),
// })

// 节点返回新值时会直接替换旧值
// 适用于不需要累积的场景
// const SimpleAnnotation = Annotation.Root({
//   currentOutput: Annotation<string>(),
// })

// 使用 reducer 函数合并新值与现有值
// 适用于需要累积（如消息列表）的场景
// const AnnotationWithReducer = Annotation.Root({
//   messages: Annotation<BaseMessage[]>({
//     reducer: (left: BaseMessage[], right: BaseMessage | BaseMessage[]) => {
//       if (Array.isArray(right)) {
//         return left.concat(right);
//       }
//       return left.concat([right]);
//     },
//     default: () => [],
//   }),
// });

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

const multiply = tool(
  (params) => {
    const { a, b } = params as { a: number; b: number }
    return a * b
  },
  {
    name: 'multiply',
    description: 'Multiply two numbers',
    schema: z.object({
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    }),
  }
)

const divide = tool(
  (params) => {
    const { a, b } = params as { a: number; b: number }
    return a / b
  },
  {
    name: 'divide',
    description: 'Divide two numbers',
    schema: z.object({
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    }),
  }
)

const toolsByName = {
  [add.name]: add,
  [multiply.name]: multiply,
  [divide.name]: divide,
}

const tools = Object.values(toolsByName)
const modelWithTools = model.bindTools(tools)

// 官网定义的
const MessagesState = z.object({
  messages: z
    .array(z.custom<BaseMessage>())
    .register(registry, MessagesZodMeta),
  llmCalls: z.number().optional(),
})

// 实际
const MessagesStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  llmCalls: Annotation<number>(),
})

async function llmCall(state: typeof MessagesStateAnnotation.State) {
  return {
    messages: await modelWithTools.invoke([
      new SystemMessage(
        'You are a helpful assistant tasked with performing arithmetic on a set of inputs.'
      ),
      ...state.messages,
    ]),
    llmCalls: (state.llmCalls ?? 0) + 1,
  }
}

async function toolNode(state: typeof MessagesStateAnnotation.State) {
  const lastMessage = state.messages.at(-1)

  if (lastMessage == null || !isAIMessage(lastMessage)) {
    return { messages: [] }
  }

  const result: ToolMessage[] = []
  for (const toolCall of lastMessage.tool_calls ?? []) {
    const tool = toolsByName[toolCall.name]
    const observation = await tool.invoke(toolCall)
    result.push(observation)
  }

  return { messages: result }
}

async function shouldContinue(state: typeof MessagesStateAnnotation.State) {
  const lastMessage = state.messages.at(-1)
  if (lastMessage == null || !isAIMessage(lastMessage)) return END

  // If the LLM makes a tool call, then perform an action
  if (lastMessage.tool_calls?.length) {
    return 'toolNode'
  }

  // Otherwise, we stop (reply to the user)
  return END
}

const FlowState = Annotation.Root({
  input: Annotation<string>(),
  result: Annotation<string>(),
  error: Annotation<string>(),
})

const buildMinimalGraph = async () => {
  const graph = new StateGraph(FlowState)
    .addNode('echo', async (s) => {
      return {
        result: `输出 :${s.input}`,
      }
    })
    .addEdge(START, 'echo')
    .addEdge('echo', END)

  // const graph = new StateGraph(MessagesStateAnnotation)
  //   .addNode('llmCall', llmCall)
  //   .addNode('toolNode', toolNode)
  //   .addEdge(START, 'llmCall')
  //   .addConditionalEdges('llmCall', shouldContinue, ['toolNode', END])
  //   .addEdge('toolNode', 'llmCall')

  return graph.compile()
}

const buildMessagesGraph = async () => {
  const graph = new StateGraph(MessagesStateAnnotation)
    .addNode('llmCall', llmCall)
    .addNode('toolNode', toolNode)
    .addEdge(START, 'llmCall')
    .addConditionalEdges('llmCall', shouldContinue, ['toolNode', END])
    .addEdge('toolNode', 'llmCall')

  return graph.compile()
}

export { buildMinimalGraph, buildMessagesGraph }
