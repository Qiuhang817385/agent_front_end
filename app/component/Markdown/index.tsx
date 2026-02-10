'use client'
// import CopyButton from '@/component/CopyButton';
import { Button as CopyButton } from 'antd'
import classnames from 'classnames'
import React, { useState, useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import rehypeRaw from 'rehype-raw'
import gfm from 'remark-gfm'

interface IProps {
  cref?: any
  children: any
  className?: string
  // 是否要在渲染为mrakdown前进行内部转义
  transform?: boolean
  target?: '_blank' | '_self' | '_parent' | 'framename'
  // 是否启用打字机效果
  enableTypewriter?: boolean
  // 打字机速度（毫秒/字符），默认 30ms
  typewriterSpeed?: number
  // 打字机完成回调
  onTypewriterComplete?: () => void
  // 打字机内容更新回调（每次内容更新时调用）
  onContentUpdate?: () => void
}

const REG_IS_MARKDOWN_STRING = [
  /^#{1,6}\s.+/m, // 标题
  /^\s*[-*+]\s+.+/m, // 无序列表
  /\[(?:[^\]|]*\|)?([^\]|]+)\]\(([^()]+)\)/g, // 链接
  /^\s*\|(.+)\|/m, // 表格
]

const REG_IS_HTML_STRING = [
  /<([a-z][a-z0-9]*)\b[^>]*>/i, // HTML 开始标签
  /<\/([a-z][a-z0-9]*)>/i, // HTML 结束标签
  /<([a-z][a-z0-9]*)\b[^>]*>[^<]*(<\/\1>)?/i, // 自封闭或配对标签
]

const codeRender = (props: any) => {
  const LanguageAlias = {
    js: 'javascript',
    ts: 'typescript',
  }
  const { children, className, node, ...rest } = props
  const match = /language-(\w+)/.exec(className || '')
  const getLanguage = (lang: string) => {
    return LanguageAlias[lang] || lang
  }
  const language = match ? getLanguage(match[1]) : ''

  return language ? (
    <div style={{ position: 'relative' }}>
      {/* Dom树中，保证代码块（SyntaxHighlighter）放在底部 */}
      <CopyButton
        text={children}
        style={{
          position: 'absolute',
          backgroundColor: 'transparent',
          color: '#00000073',
          zIndex: 1,
          padding: 0,
          right: 20,
          top: 16,
        }}
      />
      {/* Tip: TechUI.Highlight 存在刷新闪烁的问题，因此使用SyntaxHighlighter */}
      <SyntaxHighlighter
        style={oneLight}
        customStyle={{
          margin: 0,
          padding: '16px 32px 16px 24px',
          borderRadius: 2,
          backgroundColor: '#0000000a',
        }}
        codeTagProps={{
          className: 'ob-cloud-markdown-code',
          style: {
            display: 'inline-block',
            padding: 0,
            lineHeight: '26px',
            background: 'none',
          },
        }}
        language={language}
        PreTag="pre"
        wrapLongLines
        className="ob-cloud-markdown-code-pre"
        {...rest}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  ) : (
    <code {...rest} className={className}>
      {children}
    </code>
  )
}

export default (props: IProps) => {
  const {
    cref,
    children,
    target = '_blank',
    className,
    transform = true,
    enableTypewriter = false,
    typewriterSpeed = 30,
    onTypewriterComplete,
    onContentUpdate,
    ...restProps
  } = props

  // 打字机效果状态
  const [displayedContent, setDisplayedContent] = useState('')
  const [isTypewriterComplete, setIsTypewriterComplete] = useState(
    !enableTypewriter
  )
  const lastContentLengthRef = useRef(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const currentIndexRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // 打字机效果实现
  useEffect(() => {
    if (!enableTypewriter || typeof children !== 'string') {
      setDisplayedContent(children)
      setIsTypewriterComplete(true)
      return
    }

    // 如果 children 长度没有增加，不需要处理
    if (
      children.length <= lastContentLengthRef.current &&
      lastContentLengthRef.current > 0
    ) {
      return
    }

    // 清除之前的定时器
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    // 从上次的位置继续
    const startIndex = lastContentLengthRef.current
    currentIndexRef.current = startIndex

    // 根据剩余内容长度动态计算每次添加的字符数
    // 剩余内容多时，每次添加更多字符以加快速度
    // 剩余内容少时，每次添加较少字符以保持平滑
    const getCharsPerStep = (remainingLength: number): number => {
      if (remainingLength <= 50) return 1
      if (remainingLength <= 80) return 2
      if (remainingLength <= 200) return 3
      return 4 // 剩余内容很多时，每次4个字符
    }

    const timer = setInterval(() => {
      if (currentIndexRef.current < children.length) {
        // 计算剩余内容长度
        const remainingLength = children.length - currentIndexRef.current
        // 根据剩余内容长度动态计算每次添加的字符数
        const charsPerStep = getCharsPerStep(remainingLength)

        // 根据剩余内容长度动态添加字符数
        currentIndexRef.current = Math.min(
          currentIndexRef.current + charsPerStep,
          children.length
        )
        setDisplayedContent(children.slice(0, currentIndexRef.current))
        // 实时更新 lastContentLengthRef，确保下次能从正确位置继续
        lastContentLengthRef.current = currentIndexRef.current
        // 每次内容更新时触发回调
        onContentUpdate?.()
      } else {
        clearInterval(timer)
        timerRef.current = null
        lastContentLengthRef.current = children.length
        setIsTypewriterComplete(true)
        onTypewriterComplete?.()
      }
    }, typewriterSpeed)

    timerRef.current = timer

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [
    children,
    enableTypewriter,
    typewriterSpeed,
    onTypewriterComplete,
    onContentUpdate,
  ])

  // 打字机效果时自动滚动到底部
  useEffect(() => {
    if (enableTypewriter && containerRef.current) {
      // 使用 requestAnimationFrame 确保 DOM 更新后再滚动
      requestAnimationFrame(() => {
        if (!containerRef.current) return

        // 查找可滚动的父容器
        let scrollableParent: HTMLElement | null =
          containerRef.current.parentElement
        while (scrollableParent) {
          const style = window.getComputedStyle(scrollableParent)
          const isScrollable =
            style.overflow === 'auto' ||
            style.overflow === 'scroll' ||
            style.overflowY === 'auto' ||
            style.overflowY === 'scroll'

          if (
            isScrollable &&
            scrollableParent.scrollHeight > scrollableParent.clientHeight
          ) {
            scrollableParent.scrollTop = scrollableParent.scrollHeight
            return
          }

          scrollableParent = scrollableParent.parentElement
        }

        // 如果没有找到可滚动的父容器，尝试滚动组件本身
        const container = containerRef.current
        if (container.scrollHeight > container.clientHeight) {
          container.scrollTop = container.scrollHeight
        }
      })
    }
  }, [displayedContent, enableTypewriter])

  // 使用 displayedContent（打字机效果）或 children（正常显示）
  const contentToRender = enableTypewriter ? displayedContent : children

  if (!contentToRender) {
    return null
  }

  if (typeof contentToRender !== 'string') {
    return contentToRender
  }

  const isMarkdown = regCheck(contentToRender, REG_IS_MARKDOWN_STRING)
  const isHTML = regCheck(contentToRender, REG_IS_HTML_STRING)

  if (!isMarkdown && !isHTML && transform) {
    return (
      <span
        className={classnames({
          [className as string]: !!className,
        })}
        {...restProps}
      >
        {contentToRender}
        {enableTypewriter && !isTypewriterComplete && (
          <span
            style={{
              display: 'inline-block',
              width: '1px',
              height: '1em',
              backgroundColor: '#1890ff',
              marginLeft: '2px',
              animation: 'blink 1s infinite',
            }}
          />
        )}
      </span>
    )
  }

  const LinkRender = (_props: any) => {
    const { href, node, ...args } = _props
    return (
      <a href={href} target={target} {...args} rel="noreferrer">
        {_props.children}
      </a>
    )
  }

  const TableRender = (_props: any) => {
    const { node, ...args } = _props
    return (
      <div className="table-container">
        <table {...args}>{_props.children}</table>
      </div>
    )
  }

  // \n 转换为换行符号
  const escapeChildren = contentToRender.replaceAll(/\\n/g, '<br/>')
  return (
    <div
      ref={(node) => {
        containerRef.current = node
        if (typeof cref === 'function') {
          cref(node)
        } else if (cref && 'current' in cref) {
          ;(cref as any).current = node
        }
      }}
      className={classnames('ob-markdown', className)}
      {...restProps}
    >
      <Markdown
        components={{
          a: LinkRender,
          code: codeRender,
          table: TableRender,
        }}
        rehypePlugins={[rehypeRaw]}
        remarkPlugins={[gfm]}
      >
        {escapeChildren}
      </Markdown>
    </div>
  )

  function regCheck(str, regs) {
    return regs.some((reg) => {
      const r = reg.test(str)
      reg.lastIndex = 0
      return r
    })
  }
}

export type { IProps as MarkdownProps }
