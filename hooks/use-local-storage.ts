"use client"

import * as React from "react"

export interface LocalStorageOptions {
  /**
   * Invoked when a write to localStorage fails (e.g. quota exceeded or a
   * privacy mode that blocks storage). The in-memory value still updates.
   */
  onError?: (error: unknown) => void
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: LocalStorageOptions,
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [hydrated, setHydrated] = React.useState(false)
  const [value, setValue] = React.useState<T>(initialValue)

  const onErrorRef = React.useRef(options?.onError)
  React.useEffect(() => {
    onErrorRef.current = options?.onError
  }, [options?.onError])

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) {
        setValue(JSON.parse(raw) as T)
      }
    } catch {
      // ignore malformed storage
    }
    setHydrated(true)
  }, [key])

  const set = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved))
        } catch (error) {
          // Surface quota / privacy errors so the UI can react, but keep the
          // in-memory value so the session still works.
          onErrorRef.current?.(error)
        }
        return resolved
      })
    },
    [key],
  )

  return [value, set, hydrated]
}
