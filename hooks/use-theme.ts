"use client"

import * as React from "react"

type Theme = "dark" | "light"

const STORAGE_KEY = "routerdash:theme"

export function useTheme() {
  const [theme, setTheme] = React.useState<Theme>("dark")

  React.useEffect(() => {
    let stored: Theme | null = null
    try {
      stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null
    } catch {
      stored = null
    }
    if (stored === "light" || stored === "dark") {
      setTheme(stored)
      applyTheme(stored)
    }
  }, [])

  const toggle = React.useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark"
      applyTheme(next)
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  return { theme, toggle }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === "dark") {
    root.classList.add("dark")
    root.classList.remove("light")
  } else {
    root.classList.add("light")
    root.classList.remove("dark")
  }
}
