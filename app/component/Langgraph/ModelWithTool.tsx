// 'use client'

// import { Button, Input, message, Space } from 'antd'
// import { useEffect, useState } from 'react'

// const Basic = () => {
//   const [input, setInput] = useState('')
//   const [output, setOutput] = useState<{ input: string; result: string }>({
//     input: '',
//     result: '',
//   })
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState(null)

//   const fetchData = async () => {
//     const response = await fetch('/api/graph/modelWithTool', {
//       method: 'POST',
//       body: JSON.stringify({ messages: input }),
//     })
//     const data = await response.json()
//     console.log('data', data?.data?.messages)

//     for (const message of data?.data?.messages) {
//       console.log(`[${message.getType()}]: ${message.text}`)
//     }

//     if (data.success) {
//       setOutput(data.data)
//     } else {
//       message.error(data.error)
//     }
//   }

//   return (
//     <div>
//       <Space>
//         <Input value={input} onChange={(e) => setInput(e.target.value)} />
//         <Button onClick={() => fetchData()}>提交</Button>
//       </Space>
//       {/* <div>输出内容：{output.result}</div>
//       <div>输入内容：{output.input}</div> */}
//     </div>
//   )
// }

// export default Basic

'use client'

import { Button, Input, message, Space, Card, List, Tag, Spin } from 'antd'
import { useState } from 'react'
import { UserOutlined, RobotOutlined, ToolOutlined } from '@ant-design/icons'

interface MessageItem {
  type: 'human' | 'ai' | 'tool'
  content: string
  toolCalls?: Array<{
    name: string
    args: Record<string, any>
    id: string
  }>
  toolCallId?: string
  toolName?: string
}

interface StreamChunk {
  type: 'node_start' | 'node_end' | 'state_update' | 'done' | 'error'
  node?: string
  data?: {
    messages?: any[]
    llmCalls?: number
  }
  error?: string
}

const ModelWithTool = () => {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [loading, setLoading] = useState(false)
  const [currentNode, setCurrentNode] = useState<string>('')

  // 流式请求
  const fetchDataStream = async () => {
    if (!input.trim()) {
      message.warning('请输入内容')
      return
    }

    setLoading(true)
    setMessages([])
    setCurrentNode('')

    try {
      const response = await fetch('/api/graph/modelWithTool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: input }),
      })

      if (!response.body) {
        throw new Error('响应体为空')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留最后一个不完整的行

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const chunk: StreamChunk = JSON.parse(line)

            if (chunk.type === 'node_start') {
              setCurrentNode(chunk.node || '')
            } else if (
              chunk.type === 'node_end' ||
              chunk.type === 'state_update'
            ) {
              if (chunk.data?.messages) {
                // 解析消息
                const parsedMessages = parseLCMessages(chunk.data.messages)
                setMessages(parsedMessages)
              }
            } else if (chunk.type === 'done') {
              setLoading(false)
              setCurrentNode('')
            } else if (chunk.type === 'error') {
              message.error(chunk.error || '执行出错')
              setLoading(false)
              setCurrentNode('')
            }
          } catch (e) {
            console.error('解析流数据失败:', e)
          }
        }
      }
    } catch (error: any) {
      message.error(error.message || '请求出错')
      setLoading(false)
      setCurrentNode('')
    }
  }

  // 修复解析消息函数
  const parseLCMessages = (lcMessages: any[]): MessageItem[] => {
    if (!Array.isArray(lcMessages)) {
      return []
    }

    return lcMessages.map((msg) => {
      // 处理 LC 格式（LangChain 序列化格式）
      if (msg.lc && msg.id) {
        const messageType = msg.id[msg.id.length - 1] // 获取最后一部分作为类型
        const kwargs = msg.kwargs || {}

        if (messageType === 'HumanMessage') {
          return {
            type: 'human',
            content: kwargs.content || '',
          }
        } else if (messageType === 'AIMessage') {
          return {
            type: 'ai',
            content: kwargs.content || '',
            toolCalls:
              kwargs.tool_calls?.map((tc: any) => {
                // 处理 tool_calls 的不同格式
                const toolCall = tc.function || tc
                return {
                  name: toolCall.name || tc.name,
                  args:
                    typeof toolCall.arguments === 'string'
                      ? JSON.parse(toolCall.arguments)
                      : toolCall.args || tc.args || {},
                  id: tc.id || toolCall.id,
                }
              }) || [],
          }
        } else if (messageType === 'ToolMessage') {
          return {
            type: 'tool',
            content: kwargs.content || '',
            toolCallId: kwargs.tool_call_id,
            toolName: kwargs.name,
          }
        }
      }

      // 处理已序列化的格式（后端发送的格式）
      const messageType = msg.type || ''
      const content = msg.content || ''

      if (messageType === 'HumanMessage' || messageType === 'human') {
        return { type: 'human', content }
      } else if (messageType === 'AIMessage' || messageType === 'ai') {
        return {
          type: 'ai',
          content,
          toolCalls:
            msg.tool_calls?.map((tc: any) => ({
              name: tc.name,
              args:
                typeof tc.args === 'string'
                  ? JSON.parse(tc.args)
                  : tc.args || {},
              id: tc.id,
            })) || [],
        }
      } else if (messageType === 'ToolMessage' || messageType === 'tool') {
        return {
          type: 'tool',
          content,
          toolCallId: msg.tool_call_id,
          toolName: msg.name,
        }
      }

      // 默认返回 AI 消息
      return { type: 'ai', content }
    })
  }

  const renderMessage = (msg: MessageItem, index: number) => {
    const isHuman = msg.type === 'human'
    const isTool = msg.type === 'tool'

    return (
      <List.Item
        key={index}
        style={{
          display: 'flex',
          justifyContent: isHuman ? 'flex-end' : 'flex-start',
          padding: '12px 0',
        }}
      >
        <Card
          size="small"
          style={{
            maxWidth: '70%',
            backgroundColor: isHuman
              ? '#e6f7ff'
              : isTool
              ? '#f6ffed'
              : '#fafafa',
            borderColor: isHuman ? '#91d5ff' : isTool ? '#b7eb8f' : '#d9d9d9',
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}
          >
            {isHuman ? (
              <UserOutlined style={{ color: '#1890ff', marginTop: '4px' }} />
            ) : isTool ? (
              <ToolOutlined style={{ color: '#52c41a', marginTop: '4px' }} />
            ) : (
              <RobotOutlined style={{ color: '#722ed1', marginTop: '4px' }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: '8px' }}>
                <Tag color={isHuman ? 'blue' : isTool ? 'green' : 'purple'}>
                  {isHuman ? '用户' : isTool ? '工具' : 'AI'}
                </Tag>
                {isTool && msg.toolName && (
                  <Tag color="orange">{msg.toolName}</Tag>
                )}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {msg.content}
              </div>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: '#fff7e6',
                    borderRadius: '4px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#666',
                      marginBottom: '4px',
                    }}
                  >
                    工具调用：
                  </div>
                  {msg.toolCalls.map((tc, idx) => (
                    <div
                      key={idx}
                      style={{ fontSize: '12px', marginTop: '4px' }}
                    >
                      <Tag color="blue">{tc.name}</Tag>
                      <span style={{ color: '#666' }}>
                        {JSON.stringify(tc.args)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </List.Item>
    )
  }

  return (
    <div>
      <Space style={{ marginBottom: '16px', width: '100%' }}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入你的问题，例如：add 1 and 3"
          onPressEnter={fetchDataStream}
          style={{ flex: 1 }}
          disabled={loading}
        />
        <Button type="primary" onClick={fetchDataStream} loading={loading}>
          提交
        </Button>
      </Space>

      {currentNode && (
        <div style={{ marginBottom: '8px', color: '#666', fontSize: '12px' }}>
          正在执行: <Tag color="processing">{currentNode}</Tag>
        </div>
      )}

      {messages.length > 0 && (
        <Card title="对话记录" size="small">
          <List
            dataSource={messages}
            renderItem={renderMessage}
            style={{ maxHeight: '500px', overflowY: 'auto' }}
          />
        </Card>
      )}

      {loading && !currentNode && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="large" />
        </div>
      )}
    </div>
  )
}

export default ModelWithTool
