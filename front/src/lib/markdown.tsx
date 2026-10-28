import type { ReactNode } from 'react'
import { normalizeUrl, safeHref } from './url'

const INLINE = new RegExp(
  [
    /\\([\\`*_~[\]()])/, // 1: escaped character
    /`([^`\n]+)`/, // 2: code
    // 3, 4: link text, url; the url may hold one level of (parentheses)
    /\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/,
    /\*\*(?=\S)(.+?)(?<=\S)\*\*/, // 5: bold
    /~~(?=\S)(.+?)(?<=\S)~~/, // 6: strike
    /\*(?=\S)(.+?)(?<=\S)\*/, // 7: italic
    /(?<!\w)_(?=\S)(.+?)(?<=\S)_(?!\w)/, // 8: italic
    /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/ // 9: bare link
  ]
    .map((r) => r.source)
    .join('|'),
  'g'
)

function link(url: string, children: ReactNode, key: string) {
  const href = safeHref(normalizeUrl(url) ?? undefined)
  if (!href) return <span key={key}>{children}</span>
  return (
    <a
      key={key}
      className="md-link nodrag"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  )
}

export function renderInline(text: string, key = 'md'): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let n = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const k = `${key}.${n++}`
    if (m[1] !== undefined) out.push(m[1])
    else if (m[2] !== undefined) out.push(<code key={k}>{m[2]}</code>)
    else if (m[3] !== undefined) out.push(link(m[4], renderInline(m[3], k), k))
    else if (m[5] !== undefined)
      out.push(<strong key={k}>{renderInline(m[5], k)}</strong>)
    else if (m[6] !== undefined)
      out.push(<s key={k}>{renderInline(m[6], k)}</s>)
    else if (m[7] !== undefined || m[8] !== undefined)
      out.push(<em key={k}>{renderInline(m[7] ?? m[8], k)}</em>)
    else if (m[9] !== undefined) out.push(link(m[9], m[9], k))
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const BULLET = /^\s*[-*+]\s+/
const NUMBERED = /^\s*\d+[.)]\s+/
export const FENCE = /^\s*```[\w+#.-]*\s*$/
export const CLOSING_FENCE = /^\s*```\s*$/

export function renderBlocks(text: string): ReactNode[] {
  const blocks: ReactNode[] = []
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length) {
    const key = `b${i}`
    if (FENCE.test(lines[i])) {
      const code: string[] = []
      for (i++; i < lines.length && !CLOSING_FENCE.test(lines[i]); i++) {
        code.push(lines[i])
      }
      i++
      blocks.push(
        <pre key={key} className="md-code">
          <code>{code.join('\n')}</code>
        </pre>
      )
      continue
    }
    const list = BULLET.test(lines[i])
      ? BULLET
      : NUMBERED.test(lines[i])
        ? NUMBERED
        : null

    if (list) {
      const items: ReactNode[] = []
      for (; i < lines.length && list.test(lines[i]); i++) {
        items.push(
          <li key={i}>{renderInline(lines[i].replace(list, ''), `l${i}`)}</li>
        )
      }
      blocks.push(
        list === BULLET ? (
          <ul key={key}>{items}</ul>
        ) : (
          <ol key={key}>{items}</ol>
        )
      )
    } else if (!lines[i].trim()) {
      i++
    } else {
      const paragraph: ReactNode[] = []
      for (
        ;
        i < lines.length &&
        lines[i].trim() &&
        !FENCE.test(lines[i]) &&
        !BULLET.test(lines[i]) &&
        !NUMBERED.test(lines[i]);
        i++
      ) {
        if (paragraph.length) paragraph.push(<br key={`br${i}`} />)
        paragraph.push(...renderInline(lines[i], `p${i}`))
      }
      blocks.push(<p key={key}>{paragraph}</p>)
    }
  }
  return blocks
}

export function plainText(text: string): string {
  return text
    .replace(INLINE, (...m: (string | undefined)[]) =>
      plainText(
        m[1] ?? m[2] ?? m[3] ?? m[5] ?? m[6] ?? m[7] ?? m[8] ?? m[9] ?? ''
      )
    )
    .replace(BULLET, '')
}
