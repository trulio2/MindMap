import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { plainText, renderBlocks, renderInline } from './markdown'

const inline = (text: string) => renderToStaticMarkup(<>{renderInline(text)}</>)
const blocks = (text: string) => renderToStaticMarkup(<>{renderBlocks(text)}</>)

const LINK_ATTRS = 'target="_blank" rel="noopener noreferrer"'

describe('renderInline', () => {
  it('formats bold, italic, strike and code', () => {
    expect(inline('**b** *i* _i2_ ~~s~~ `c`')).toBe(
      '<strong>b</strong> <em>i</em> <em>i2</em> <s>s</s> <code>c</code>'
    )
  })

  it('nests formatting', () => {
    expect(inline('**bold _and italic_**')).toBe(
      '<strong>bold <em>and italic</em></strong>'
    )
  })

  it('leaves escaped markers and stray symbols alone', () => {
    expect(inline('\\*not italic\\* and a * b')).toBe('*not italic* and a * b')
    expect(inline('snake_case_name')).toBe('snake_case_name')
  })

  it('links [text](url), adding https:// to bare domains', () => {
    expect(inline('[docs](example.com)')).toBe(
      `<a class="md-link nodrag" href="https://example.com/" ${LINK_ATTRS}>docs</a>`
    )
  })

  it('keeps parentheses inside link addresses', () => {
    expect(
      inline('[M](https://en.wikipedia.org/wiki/Mercury_(planet)) end')
    ).toBe(
      `<a class="md-link nodrag" href="https://en.wikipedia.org/wiki/Mercury_(planet)" ${LINK_ATTRS}>M</a> end`
    )
  })

  it('links bare URLs but not trailing punctuation', () => {
    expect(inline('See https://example.com/a.')).toBe(
      `See <a class="md-link nodrag" href="https://example.com/a" ${LINK_ATTRS}>https://example.com/a</a>.`
    )
  })

  it('never turns unsafe links into anchors', () => {
    const html = inline('[click](javascript:alert(1)) [x](data:text/html,hi)')
    expect(html).not.toContain('<a')
    expect(html).not.toContain('javascript:')
    expect(html).toBe('<span>click</span> <span>x</span>')
  })

  it('escapes HTML in the text', () => {
    expect(inline('<img src=x onerror=alert(1)> **<b>**')).toBe(
      '&lt;img src=x onerror=alert(1)&gt; <strong>&lt;b&gt;</strong>'
    )
  })
})

describe('renderBlocks', () => {
  it('builds paragraphs, line breaks and lists', () => {
    expect(blocks('one\ntwo\n\n- a\n- **b**\n\n1. x\n2. y')).toBe(
      '<p>one<br/>two</p><ul><li>a</li><li><strong>b</strong></li></ul><ol><li>x</li><li>y</li></ol>'
    )
  })

  it('returns nothing for empty text', () => {
    expect(blocks('')).toBe('')
    expect(blocks('\n\n')).toBe('')
  })
})

describe('plainText', () => {
  it('strips formatting for titles', () => {
    expect(
      plainText('**Launch** _plan_ ~~old~~ `v2` [docs](example.com)')
    ).toBe('Launch plan old v2 docs')
    expect(plainText('- item')).toBe('item')
    expect(plainText('\\*literal\\*')).toBe('*literal*')
  })
})
