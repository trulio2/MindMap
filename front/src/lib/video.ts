const VIDEO_ID = /^[\w-]{11}$/

export type YouTubeVideo = { id: string; start?: number }

/** "90", "90s", "1m30s" or "1h2m3s" as seconds. */
function parseTime(value: string | null): number | undefined {
  if (!value) return undefined
  if (/^\d+s?$/.test(value)) return parseInt(value, 10) || undefined
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (!match) return undefined
  const [, h = '0', m = '0', s = '0'] = match
  return +h * 3600 + +m * 60 + +s || undefined
}

/**
 * The video in a YouTube link: watch, youtu.be, shorts, embed and live URLs,
 * with an optional start time. Returns null for anything else.
 */
export function parseYouTube(input: string | undefined): YouTubeVideo | null {
  const value = input?.trim()
  if (!value) return null
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^(www|m|music)\./, '')
  let id: string | null | undefined
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1]
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id =
      url.pathname === '/watch'
        ? url.searchParams.get('v')
        : url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)?.[1]
  }
  if (!id || !VIDEO_ID.test(id)) return null

  const start = parseTime(
    url.searchParams.get('t') ?? url.searchParams.get('start')
  )
  return start ? { id, start } : { id }
}

/** A clean link to the video on YouTube, used as the stored URL. */
export function watchUrl({ id, start }: YouTubeVideo) {
  return `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}`
}

/**
 * YouTube's thumbnail image. "hqdefault" exists for every video (the larger
 * "maxresdefault" doesn't); its letterbox bars are cropped away by CSS.
 */
export function thumbnailUrl({ id }: YouTubeVideo) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

/** The privacy-enhanced embed, starting playback right away. */
export function embedUrl({ id, start }: YouTubeVideo) {
  const params = new URLSearchParams({ autoplay: '1', rel: '0' })
  if (start) params.set('start', String(start))
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`
}
