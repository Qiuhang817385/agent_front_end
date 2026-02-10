'use client'

import { Button, Input, message, Space } from 'antd'
import { useEffect, useState } from 'react'

const Basic = () => {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<{ input: string; result: string }>({
    input: '',
    result: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    const response = await fetch('/api/graph/basic', {
      method: 'POST',
      body: JSON.stringify({ input }),
    })
    const data = await response.json()
    if (data.success) {
      setOutput(data.data)
    } else {
      message.error(data.error)
    }
  }

  return (
    <div>
      <Space>
        <Input value={input} onChange={(e) => setInput(e.target.value)} />
        <Button onClick={() => fetchData()}>提交</Button>
      </Space>
      <div>输出内容：{output.result}</div>
      <div>输入内容：{output.input}</div>
    </div>
  )
}

export default Basic
