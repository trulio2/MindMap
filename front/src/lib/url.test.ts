import { describe, expect, it } from 'vitest'
import { displayHost, normalizeUrl, safeHref, safeImageSrc } from './url'

describe('normalizeUrl', () => {
  it('adds https:// to bare domains', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/')
    expect(normalizeUrl('  docs.example.com/a?b=1 ')).toBe(
      'https://docs.example.com/a?b=1'
    )
  })

  it('keeps http, https and mailto links', () => {
    expect(normalizeUrl('http://example.com/x')).toBe('http://example.com/x')
    expect(normalizeUrl('mailto:me@example.com')).toBe('mailto:me@example.com')
  })

  it('rejects other schemes and non-URLs', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeUrl('data:text/html,<b>x</b>')).toBeNull()
    expect(normalizeUrl('file:///etc/passwd')).toBeNull()
    expect(normalizeUrl('localhost')).toBeNull()
    expect(normalizeUrl('')).toBeNull()
    expect(normalizeUrl('   ')).toBeNull()
  })
})

describe('safeHref', () => {
  it('passes safe links through unchanged', () => {
    expect(safeHref('https://example.com')).toBe('https://example.com')
    expect(safeHref('mailto:a@b.co')).toBe('mailto:a@b.co')
  })

  it('blocks unsafe or broken links', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined()
    expect(safeHref(' JavaScript:alert(1)')).toBeUndefined()
    expect(safeHref('vbscript:x')).toBeUndefined()
    expect(safeHref('not a url')).toBeUndefined()
    expect(safeHref(undefined)).toBeUndefined()
  })
})

describe('displayHost', () => {
  it('shows the host without www, or the address for mailto', () => {
    expect(displayHost('https://www.example.com/page')).toBe('example.com')
    expect(displayHost('mailto:me@example.com')).toBe('me@example.com')
    expect(displayHost('nonsense')).toBe('nonsense')
  })
})

describe('safeImageSrc', () => {
  it('only allows embedded images', () => {
    expect(safeImageSrc('data:image/webp;base64,AAAA')).toBe(
      'data:image/webp;base64,AAAA'
    )
    expect(safeImageSrc('https://tracker.example/pixel.png')).toBeUndefined()
    expect(safeImageSrc('data:text/html;base64,AAAA')).toBeUndefined()
    expect(safeImageSrc(undefined)).toBeUndefined()
  })
})
