'use client'
import { Card, Col, Row } from 'antd'
import { useState, useRef, useEffect } from 'react'
import Langgraph from '../component/Langgraph/Basic'
import ModelWithTool from '../component/Langgraph/ModelWithTool'
import ReactAgent from '../component/Langgraph/ReactAgent'

export default function GraphPage() {
  return (
    <div className="max-w-4xl mx-auto h-screen flex flex-col">
      <Row>
        <Col span={24}>
          <Card title="Langgraph 最简单测试">
            <Langgraph />
          </Card>
        </Col>
        <Col span={24}>
          <Card title="Langgraph 模型带工具测试">
            <ModelWithTool />
          </Card>
        </Col>
        <Col span={24}>
          <Card title="Langgraph 使用 reactAgent 测试">
            <ReactAgent />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
