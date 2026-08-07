"use client"

import * as React from "react"

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [hydrated, setHydrated] = React.useState(false)
  const [value, setValue] = React.useState<T>(initialValue)

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
        } catch {
          // ignore quota / privacy errors
        }
        return resolved
      })
    },
    [key],
  )

  return [value, set, hydrated]
}
