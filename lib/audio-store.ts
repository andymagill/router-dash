/**
 * Audio persistence. Session metadata lives in localStorage like the rest of
 * the app, but audio blobs are far too large for it (~5MB cap, strings only),
 * so they go in IndexedDB keyed by session id. The store sits behind a small
 * interface so tests (and non-browser environments) can inject an in-memory
 * implementation, the same pattern as `CacheStorage` in the catalog cache.
 */

export interface AudioStore {
  put(id: string, blob: Blob): Promise<void>
  get(id: string): Promise<Blob | null>
  delete(id: string): Promise<void>
  keys(): Promise<string[]>
}

const DB_NAME = "routerdash"
const STORE_NAME = "audio"
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"))
  })
}

/** Run one request inside a transaction and resolve with its result. */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode)
      const req = run(tx.objectStore(STORE_NAME))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB error"))
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB aborted"))
    })
  } finally {
    db.close()
  }
}

/** The browser store, or null where IndexedDB is missing (SSR, some privacy modes). */
export function createIndexedDbAudioStore(): AudioStore | null {
  if (typeof indexedDB === "undefined") return null
  return {
    put: (id, blob) =>
      withStore("readwrite", (s) => s.put(blob, id)).then(() => undefined),
    get: async (id) => {
      const found = await withStore<Blob | undefined>("readonly", (s) =>
        s.get(id),
      )
      return found ?? null
    },
    delete: (id) =>
      withStore("readwrite", (s) => s.delete(id)).then(() => undefined),
    keys: async () => {
      const all = await withStore<IDBValidKey[]>("readonly", (s) =>
        s.getAllKeys(),
      )
      return all.map(String)
    },
  }
}

/** In-memory store for tests. */
export function createMemoryAudioStore(): AudioStore {
  const map = new Map<string, Blob>()
  return {
    put: async (id, blob) => void map.set(id, blob),
    get: async (id) => map.get(id) ?? null,
    delete: async (id) => void map.delete(id),
    keys: async () => Array.from(map.keys()),
  }
}

/**
 * Delete stored audio whose session no longer exists (eviction, an import, or
 * a cleared localStorage). Returns the ids removed. Best-effort: a failure on
 * one blob doesn't stop the rest.
 */
export async function removeOrphanedAudio(
  store: AudioStore,
  liveSessionIds: Iterable<string>,
): Promise<string[]> {
  const live = new Set(liveSessionIds)
  const removed: string[] = []
  for (const id of await store.keys()) {
    if (live.has(id)) continue
    try {
      await store.delete(id)
      removed.push(id)
    } catch {
      // ignore; it will be retried on the next reconcile
    }
  }
  return removed
}

/**
 * Ask the browser not to evict our data under storage pressure, and report
 * whether usage is close to the quota. Both are best-effort and may be
 * unsupported (older Safari), so every call is guarded.
 */
export async function requestPersistence(): Promise<void> {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // ignore
  }
}

export async function isStorageNearlyFull(
  threshold = 0.85,
): Promise<boolean> {
  try {
    const est = await navigator.storage?.estimate?.()
    if (!est?.quota || est.usage == null) return false
    return est.usage / est.quota >= threshold
  } catch {
    return false
  }
}
