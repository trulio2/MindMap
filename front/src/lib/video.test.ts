import { describe, expect, it } from 'vitest'
import { embedUrl, parseYouTube, thumbnailUrl, watchUrl } from './video'

const ID = 'dQw4w9WgXcQ'

describe('parseYouTube', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `youtube.com/watch?v=${ID}&list=PL123`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`
  ])('finds the video in %s', (url) => {
    expect(parseYouTube(url)).toEqual({ id: ID })
  })

  it.each([
    [`https://youtu.be/${ID}?t=42`, 42],
    [`https://youtu.be/${ID}?t=42s`, 42],
    [`https://www.youtube.com/watch?v=${ID}&t=1m30s`, 90],
    [`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`, 3723],
    [`https://www.youtube.com/embed/${ID}?start=10`, 10]
  ])('reads the start time of %s', (url, start) => {
    expect(parseYouTube(url)).toEqual({ id: ID, start })
  })

  it.each([
    'https://vimeo.com/123',
    `https://evil.com/watch?v=${ID}`,
    `https://youtube.com.evil.com/watch?v=${ID}`,
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=<script>xx',
    'https://www.youtube.com/channel/abc',
    '',
    undefined
  ])('rejects %s', (url) => {
    expect(parseYouTube(url)).toBeNull()
  })
})

describe('YouTube URLs', () => {
  it('builds watch, thumbnail and embed addresses', () => {
    expect(watchUrl({ id: ID })).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(watchUrl({ id: ID, start: 42 })).toBe(
      `https://www.youtube.com/watch?v=${ID}&t=42s`
    )
    expect(thumbnailUrl({ id: ID })).toBe(
      `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`
    )
    expect(embedUrl({ id: ID, start: 5 })).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0&start=5`
    )
  })

  it('round-trips through the stored watch URL', () => {
    const video = { id: ID, start: 90 }
    expect(parseYouTube(watchUrl(video))).toEqual(video)
  })
})
