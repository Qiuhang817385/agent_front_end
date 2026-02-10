'use client'

import { Button, Input, Space, Card, Typography } from 'antd'
import { useEffect, useState, useRef } from 'react'
import './ReactAgent.css'
import { Streamdown } from 'streamdown'

const { Text } = Typography

interface StreamChunk {
  type:
    | 'message'
    | 'node_start'
    | 'node_end'
    | 'state_update'
    | 'done'
    | 'error'
  node?: string
  content?: string
  data?: {
    messages?: any[]
    llmCalls?: number
  }
  error?: string
}

const ReactAgent = () => {
  const [input, setInput] = useState('')
  const [displayText, setDisplayText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 缓冲区相关
  const bufferQueue = useRef<string[]>([])
  const animationFrameRef = useRef<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 打字机效果配置
  const typingSpeed = 50 // 毫秒/字符
  const cursorBlinkSpeed = 500 // 光标闪烁速度

  // 清理函数
  const cleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    bufferQueue.current = []
    setIsTyping(false)
  }

  // 处理缓冲区中的字符
  const processBuffer = () => {
    if (bufferQueue.current.length === 0) {
      setIsTyping(false)
      return
    }

    setIsTyping(true)

    // 从缓冲区取出一个字符
    const char = bufferQueue.current.shift()
    if (char) {
      setDisplayText((prev) => prev + char)
    }

    // 继续处理下一个字符
    animationFrameRef.current = setTimeout(() => {
      processBuffer()
    }, typingSpeed) as unknown as number
  }

  // 添加文本到缓冲区
  const addToBuffer = (text: string) => {
    // 将文本拆分为字符并添加到缓冲区
    const chars = text.split('')
    bufferQueue.current.push(...chars)

    // 如果没有正在打字，开始打字效果
    if (!isTyping) {
      processBuffer()
    }
  }

  // 停止流式输出
  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    cleanup()
    setLoading(false)
  }

  // 解析流式数据（处理不完整的JSON）
  const parseStreamData = (
    data: string,
    buffer: string
  ): { chunks: StreamChunk[]; newBuffer: string } => {
    const chunks: StreamChunk[] = []
    let newBuffer = buffer + data

    // 尝试按行分割
    const lines = newBuffer.split('\n')
    newBuffer = lines.pop() || '' // 保留最后一个不完整的行

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const chunk: StreamChunk = JSON.parse(line)
        chunks.push(chunk)
      } catch (e) {
        // 如果解析失败，可能是JSON不完整，将其放回缓冲区
        console.warn('解析JSON失败，可能数据不完整:', line)
        newBuffer = line + '\n' + newBuffer
      }
    }

    return { chunks, newBuffer }
  }

  // 处理不同类型的chunk
  const handleChunk = (chunk: StreamChunk) => {
    console.log('收到chunk:', chunk)

    switch (chunk.type) {
      case 'message':
        // 直接处理消息内容
        if (chunk.content) {
          addToBuffer(chunk.content)
        }
        break

      case 'state_update':
        if (chunk.data?.messages) {
          // 提取最后一个消息的内容
          const lastMessage =
            chunk.data.messages[chunk.data.messages.length - 1]
          if (lastMessage?.content) {
            addToBuffer(lastMessage.content)
          }
        }
        break

      case 'node_start':
        console.log(`节点开始: ${chunk.node}`)
        break

      case 'node_end':
        console.log(`节点结束: ${chunk.node}`)
        break

      case 'done':
        console.log('流式输出完成')
        setLoading(false)
        cleanup()
        break

      case 'error':
        console.error('错误:', chunk.error)
        setError(chunk.error || '未知错误')
        setLoading(false)
        cleanup()
        break
    }
  }

  const fetchData = async () => {
    // 清理之前的状态
    cleanup()
    setDisplayText('')
    setError(null)
    setLoading(true)

    // 创建新的AbortController
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/graph/reactAgent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: input }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('响应体为空')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          console.log('流式读取完成')
          break
        }

        const text = decoder.decode(value, { stream: true })

        // 解析流式数据
        const { chunks, newBuffer } = parseStreamData(text, buffer)
        buffer = newBuffer

        // 处理所有解析成功的chunk
        chunks.forEach(handleChunk)
      }

      setLoading(false)
    } catch (error: any) {
      // 如果是用户主动取消，不显示错误
      if (error.name === 'AbortError') {
        console.log('请求被用户取消')
      } else {
        console.error('请求失败:', error)
        setError(error.message || '请求失败')
      }
      setLoading(false)
      cleanup()
    } finally {
      abortControllerRef.current = null
    }
  }

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopStreaming()
    }
  }, [])

  return (
    <div className="react-agent-container">
      <Card title="React Agent 演示" className="react-agent-card">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div className="input-section">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入您的问题..."
              disabled={loading}
              onPressEnter={fetchData}
            />
            <Space>
              <Button
                type="primary"
                onClick={fetchData}
                loading={loading}
                disabled={!input.trim()}
              >
                {loading ? '生成中...' : '发送'}
              </Button>
              {loading && (
                <Button danger onClick={stopStreaming}>
                  停止
                </Button>
              )}
            </Space>
          </div>

          {error && (
            <div className="error-section">
              <Text type="danger">错误: {error}</Text>
            </div>
          )}

          <div className="output-section">
            <Text strong>AI回复:</Text>
            <div className="typing-container">
              <div className="typing-text">
                <Streamdown>{displayText}</Streamdown>
                {isTyping && <span className="cursor">|</span>}
              </div>
            </div>
          </div>

          <div className="info-section">
            <Text type="secondary">
              状态:{' '}
              {loading ? '正在生成...' : isTyping ? '正在显示...' : '就绪'}
              {isTyping && ` (缓冲区: ${bufferQueue.current.length} 字符)`}
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  )
}

export default ReactAgent
