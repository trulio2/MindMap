import type { StateStorage } from 'zustand/middleware'
import { useUi, type StorageError } from './ui.store'

const WRITE_DELAY_MS = 300

const pending = new Map<string, string>()
let timer: ReturnType<typeof setTimeout> | undefined

function isQuotaError(error: unknown) {
  return error instanceof DOMException && error.name === 'QuotaExceededError'
}

function reportError(error: StorageError | null) {
  useUi.getState().setStorageError(error)
}

function flush() {
  clearTimeout(timer)
  timer = undefined
  for (const [name, value] of pending) {
    try {
      localStorage.setItem(name, value)
      reportError(null)
    } catch (error) {
      reportError(isQuotaError(error) ? 'full' : 'unavailable')
    }
  }
  pending.clear()
}

// Don't lose the last debounced write when the tab closes.
window.addEventListener('pagehide', flush)

/**
 * localStorage with batched writes. Dragging changes state on every frame,
 * and serializing a map with images that often would stall the UI.
 * Failures (full or blocked storage) are reported to the UI store.
 */
export const debouncedLocalStorage: StateStorage = {
  getItem: (name) => {
    if (pending.has(name)) return pending.get(name)!
    try {
      return localStorage.getItem(name)
    } catch {
      reportError('unavailable')
      return null
    }
  },
  setItem: (name, value) => {
    pending.set(name, value)
    clearTimeout(timer)
    timer = setTimeout(flush, WRITE_DELAY_MS)
  },
  removeItem: (name) => {
    pending.delete(name)
    try {
      localStorage.removeItem(name)
    } catch {
      reportError('unavailable')
    }
  }
}
