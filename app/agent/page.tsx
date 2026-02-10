'use client'
import { useState, useRef, useEffect } from 'react'

interface Message {
  id: string
  type: 'user' | 'agent'
  content: string
  steps?: any[]
  timestamp: Date
}

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [agentType, setAgentType] = useState('react')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, agentType }),
      })

      const result = await response.json()

      if (result.success) {
        const agentMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'agent',
          content:
            agentType === 'react'
              ? result.data[result.data.length - 1]?.answer || '处理完成'
              : result.data.final_answer,
          steps: agentType === 'react' ? result.data : undefined,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, agentMessage])
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: `错误：${error.message}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const renderStep = (step: any, index: number) => (
    <div key={index} className="ml-4 mb-2 p-2 bg-gray-50 rounded">
      <div className="text-sm text-gray-600">步骤 {step.step + 1}</div>
      {step.thought && <div className="text-sm">思考：{step.thought}</div>}
      {step.action && <div className="text-sm">行动：{step.action}</div>}
      {step.observation && (
        <div className="text-sm">观察：{step.observation}</div>
      )}
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto h-screen flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold mb-4">智能 Agent 对话</h1>
        <div className="flex gap-4">
          <select
            value={agentType}
            onChange={(e) => setAgentType(e.target.value)}
            className="border rounded px-3 py-1"
          >
            <option value="react">ReAct Agent</option>
            <option value="multi">Multi-Agent</option>
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.type === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-3xl p-3 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.steps && (
                <div className="mt-2">
                  <div className="text-sm font-semibold mb-2">执行步骤：</div>
                  {message.steps.map(renderStep)}
                </div>
              )}
              <div className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                Agent 正在思考...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="输入你的问题..."
            className="flex-1 border rounded px-3 py-2"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
