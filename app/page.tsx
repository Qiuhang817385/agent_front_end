'use client'
import Image from 'next/image'
import Markdown from '@/app/component/Markdown'
import { Card, Col, Row, Table } from 'antd'
import Langgraph from './component/Langgraph/Basic'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <Link href="/graph">Graph</Link>
      {/* <h1>Hello World</h1>
      <div
        style={{
          width: 200,
          height: 200,
          overflow: 'scroll',
        }}
      >
        <Markdown enableTypewriter={true} typewriterSpeed={100}>
          你好，我今sdf天非常的开心你好，我今天非常的开fsd心你好，我今天非常fds的开心你好，我今天非常f的开心你好，我今天非常的开心你好，我今天非常的开心你好，我今天非常的开心你好，我今天非常的开心
        </Markdown>
      </div> */}
    </div>
  )
}
