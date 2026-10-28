const DB_NAME = 'mindmap'
const STORE = 'kv'

let db: Promise<IDBDatabase> | undefined

function open(): Promise<IDBDatabase> {
  db ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })
  db.catch(() => (db = undefined))
  return db
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await open()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, mode)
    const request = action(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = () => reject(tx.error ?? request.error)
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'))
  })
}

export const idbGet = <T>(key: string) =>
  run<T | undefined>('readonly', (store) => store.get(key))

export const idbSet = (key: string, value: unknown) =>
  run('readwrite', (store) => store.put(value, key)).then(() => undefined)

export const idbDelete = (key: string) =>
  run('readwrite', (store) => store.delete(key)).then(() => undefined)
