import type { PersistStorage, StorageValue } from 'zustand/middleware'
import { idbDelete, idbGet, idbSet } from './idb'
import { useUi, type StorageError } from './ui.store'

type Saved = StorageValue<unknown>

const WRITE_DELAY_MS = 300

const pending = new Map<string, Saved>()
let timer: ReturnType<typeof setTimeout> | undefined

const loaded = new Set<string>()

const channel =
  typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel('mindmap')

function reportError(error: StorageError | null) {
  useUi.getState().setStorageError(error)
}

function isQuotaError(error: unknown) {
  return error instanceof DOMException && error.name === 'QuotaExceededError'
}

let writing: Promise<void> = Promise.resolve()

async function write(name: string, value: Saved) {
  try {
    await idbSet(name, value)
    reportError(null)
    channel?.postMessage(name)
  } catch (error) {
    reportError(isQuotaError(error) ? 'full' : 'unavailable')
  }
}

export function flushPendingWrites() {
  clearTimeout(timer)
  timer = undefined
  const writes = [...pending]
  pending.clear()
  writing = writing.then(() =>
    Promise.all(writes.map(([name, value]) => write(name, value))).then(
      () => undefined
    )
  )
  return writing
}

window.addEventListener('pagehide', () => void flushPendingWrites())
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flushPendingWrites()
})

export function onSavedElsewhere(listener: (name: string) => void) {
  channel?.addEventListener('message', (event) => listener(event.data))
}

async function migrateFromLocalStorage(name: string): Promise<Saved | null> {
  let legacy: Saved | null
  try {
    const text = localStorage.getItem(name)
    legacy = text ? JSON.parse(text) : null
  } catch {
    return null
  }
  if (!legacy) return null
  await idbSet(name, legacy)
  localStorage.removeItem(name)
  return legacy
}

const storage: PersistStorage<unknown> = {
  getItem: async (name) => {
    if (pending.has(name)) return pending.get(name)!
    try {
      const saved =
        (await idbGet<Saved>(name)) ?? (await migrateFromLocalStorage(name))
      loaded.add(name)
      return saved
    } catch {
      reportError('unavailable')
      return null
    }
  },
  setItem: (name, value) => {
    if (!loaded.has(name)) return
    pending.set(name, value)
    clearTimeout(timer)
    timer = setTimeout(() => void flushPendingWrites(), WRITE_DELAY_MS)
  },
  removeItem: async (name) => {
    pending.delete(name)
    try {
      await idbDelete(name)
    } catch {
      reportError('unavailable')
    }
  }
}

export const persistStorage = <S>() => storage as PersistStorage<S>

export const readSaved = (name: string) => storage.getItem(name)

export const writeSaved = (name: string, value: Saved) => idbSet(name, value)

export const deleteSaved = (name: string) => storage.removeItem(name)

export const forgetLoaded = (name: string) => {
  loaded.delete(name)
}
