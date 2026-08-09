"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { SunIcon, MoonIcon } from "lucide-react"

interface HeaderProps {
  theme: "light" | "dark"
  onToggleTheme: () => void
  keySlot: React.ReactNode
  historySlot: React.ReactNode
  feedbackSlot?: React.ReactNode
}

export function Header({
  theme,
  onToggleTheme,
  keySlot,
  historySlot,
  feedbackSlot,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">
            R
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-sm font-semibold tracking-tight">
              RouterDash
            </span>
            <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
              / openrouter playground
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {historySlot}

          {feedbackSlot}

          {keySlot}

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="size-8"
          >
            {theme === "dark" ? (
              <SunIcon className="size-4" />
            ) : (
              <MoonIcon className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}
