/**
 * Local, per-provider catalog cache with a TTL.
 *
 * Only sanitized UnifiedModel data is stored — never API keys (adapters don't
 * put key material in UnifiedModel, and we defensively store nothing else).
 * The cache lets the app avoid refetching catalogs on every reload while the
 * data is still fresh, and is invalidated on manual refresh.
 */

import type { ProviderId, UnifiedModel } from "./types"

/** One hour: catalogs change rarely, so this avoids needless refetches. */
export const CATALOG_TTL_MS = 60 * 60 * 1000

const CACHE_VERSION = 1

interface CacheEntry {
  v: number
  fetchedAt: number
  models: UnifiedModel[]
}

function cacheKey(provider: ProviderId): string {
  return `routerdash:catalog:${provider}`
}

/** Storage abstraction so the cache is unit-testable without a real browser. */
export interface CacheStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function defaultStorage(): CacheStorage | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function isEntryFresh(
  entry: CacheEntry,
  now: number,
  ttl = CATALOG_TTL_MS,
): boolean {
  return entry.v === CACHE_VERSION && now - entry.fetchedAt < ttl
}

/** Read cached models if present and still fresh; otherwise null. */
export function readCatalogCache(
  provider: ProviderId,
  opts: { now?: number; ttl?: number; storage?: CacheStorage | null } = {},
): UnifiedModel[] | null {
  const storage = opts.storage ?? defaultStorage()
  if (!storage) return null
  const now = opts.now ?? Date.now()
  const raw = storage.getItem(cacheKey(provider))
  if (!raw) return null
  let parsed: CacheEntry
  try {
    parsed = JSON.parse(raw) as CacheEntry
  } catch {
    return null
  }
  if (
    !parsed ||
    typeof parsed.fetchedAt !== "number" ||
    !Array.isArray(parsed.models)
  ) {
    return null
  }
  if (!isEntryFresh(parsed, now, opts.ttl ?? CATALOG_TTL_MS)) return null
  return parsed.models
}

export function writeCatalogCache(
  provider: ProviderId,
  models: UnifiedModel[],
  opts: { now?: number; storage?: CacheStorage | null } = {},
): void {
  const storage = opts.storage ?? defaultStorage()
  if (!storage) return
  const entry: CacheEntry = {
    v: CACHE_VERSION,
    fetchedAt: opts.now ?? Date.now(),
    models,
  }
  try {
    storage.setItem(cacheKey(provider), JSON.stringify(entry))
  } catch {
    // Storage full / unavailable — cache is best-effort only.
  }
}

export function clearCatalogCache(
  provider: ProviderId,
  opts: { storage?: CacheStorage | null } = {},
): void {
  const storage = opts.storage ?? defaultStorage()
  if (!storage) return
  try {
    storage.removeItem(cacheKey(provider))
  } catch {
    // ignore
  }
}
