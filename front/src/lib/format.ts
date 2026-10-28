import { normalizeUrl } from './url'

export type Format = 'bold' | 'italic' | 'strike' | 'code' | 'link' | 'list'

/** Field text after a format action, with the range to select. */
export type FormatEdit = { value: string; start: number; end: number }

// Italic uses "_" so toggling it next to bold's "**" can't take a star away.
const MARKERS: Record<'bold' | 'italic' | 'strike' | 'code', string> = {
  bold: '**',
  italic: '_',
  strike: '~~',
  code: '`'
}

const PLACEHOLDER: Record<'bold' | 'italic' | 'strike' | 'code', string> = {
  bold: 'bold text',
  italic: 'italic text',
  strike: 'struck text',
  code: 'code'
}

function toggleWrap(
  value: string,
  start: number,
  end: number,
  marker: string,
  placeholder: string
): FormatEdit {
  const before = value.slice(0, start)
  const selected = value.slice(start, end)
  const after = value.slice(end)
  const m = marker.length

  // Already wrapped around the selection: remove the markers.
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return {
      value: before.slice(0, -m) + selected + after.slice(m),
      start: start - m,
      end: end - m
    }
  }
  // The selection includes the markers: remove them too.
  if (
    selected.length >= 2 * m &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(m, -m)
    return {
      value: before + inner + after,
      start,
      end: start + inner.length
    }
  }
  const inner = selected || placeholder
  return {
    value: before + marker + inner + marker + after,
    start: start + m,
    end: start + m + inner.length
  }
}

function makeLink(value: string, start: number, end: number): FormatEdit {
  const before = value.slice(0, start)
  const selected = value.slice(start, end).trim()
  const after = value.slice(end)

  // A selected URL becomes the target; the cursor goes to the link text.
  if (selected && !/\s/.test(selected) && normalizeUrl(selected)) {
    return {
      value: `${before}[](${selected})${after}`,
      start: start + 1,
      end: start + 1
    }
  }
  const text = selected || 'link text'
  const url = 'https://'
  const urlStart = start + text.length + 3
  return {
    value: `${before}[${text}](${url})${after}`,
    start: urlStart,
    end: urlStart + url.length
  }
}

function toggleList(value: string, start: number, end: number): FormatEdit {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const nextBreak = value.indexOf('\n', end)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const lines = value.slice(lineStart, lineEnd).split('\n')

  const isList = lines.every((l) => !l.trim() || /^\s*[-*+]\s/.test(l))
  const block = lines
    .map((l) =>
      isList ? l.replace(/^(\s*)[-*+]\s/, '$1') : l.trim() ? `- ${l}` : l
    )
    .join('\n')

  return {
    value: value.slice(0, lineStart) + block + value.slice(lineEnd),
    start: lineStart,
    end: lineStart + block.length
  }
}

/** Applies a toolbar action to the text and selection of a field. */
export function applyFormat(
  value: string,
  start: number,
  end: number,
  format: Format
): FormatEdit {
  if (format === 'link') return makeLink(value, start, end)
  if (format === 'list') return toggleList(value, start, end)
  return toggleWrap(value, start, end, MARKERS[format], PLACEHOLDER[format])
}
