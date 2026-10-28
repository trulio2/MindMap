const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export function normalizeUrl(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(value)
    ? value
    : `https://${value}`
  try {
    const url = new URL(withScheme)
    if (!SAFE_PROTOCOLS.has(url.protocol)) return null
    if (url.protocol !== 'mailto:' && !url.hostname.includes('.')) return null
    return url.href
  } catch {
    return null
  }
}

export function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    return SAFE_PROTOCOLS.has(new URL(url).protocol) ? url : undefined
  } catch {
    return undefined
  }
}

export function displayHost(url: string): string {
  try {
    const { protocol, hostname, pathname } = new URL(url)
    if (protocol === 'mailto:') return pathname
    return hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function safeImageSrc(src: string | undefined): string | undefined {
  return src?.startsWith('data:image/') ? src : undefined
}
