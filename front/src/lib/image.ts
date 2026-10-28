import type { Size } from '@/types'

const MAX_SIDE = 1600
const QUALITY = 0.85

export type LoadedImage = { src: string; size: Size; name: string }

/**
 * Reads an image file and re-encodes it as a WebP data URL no larger than
 * MAX_SIDE on its longest side, to keep localStorage usage down.
 */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)

    // Browsers that can't encode WebP return PNG instead, which is much
    // larger, so use JPEG there.
    const webp = canvas.toDataURL('image/webp', QUALITY)
    const src = webp.startsWith('data:image/webp')
      ? webp
      : canvas.toDataURL('image/jpeg', QUALITY)

    return { src, size: { width, height }, name: file.name }
  } finally {
    bitmap.close()
  }
}

/** Initial on-canvas size: at most `max` wide or tall, keeping the aspect ratio. */
export function fitSize({ width, height }: Size, max = 320): Size {
  const scale = Math.min(1, max / Math.max(width, height))
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  }
}
