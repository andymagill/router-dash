"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  SunIcon,
  MoonIcon,
  GitCompareIcon,
  LayoutGridIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ViewMode } from "@/lib/types"

interface HeaderProps {
  theme: "light" | "dark"
  onToggleTheme: () => void
  view: ViewMode
  onViewChange: (v: ViewMode) => void
  canDiff: boolean
  keySlot: React.ReactNode
}

export function Header({
  theme,
  onToggleTheme,
  view,
  onViewChange,
  canDiff,
  keySlot,
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
          <div className="mr-1 flex items-center rounded-lg border border-border bg-surface p-0.5">
            <ViewToggle
              active={view === "grid"}
              onClick={() => onViewChange("grid")}
              icon={<LayoutGridIcon className="size-3.5" />}
              label="Grid"
            />
            <ViewToggle
              active={view === "diff"}
              onClick={() => onViewChange("diff")}
              icon={<GitCompareIcon className="size-3.5" />}
              label="Diff"
              disabled={!canDiff}
            />
          </div>

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

function ViewToggle({
  active,
  onClick,
  icon,
  label,
  disabled,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40 hover:text-muted-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  )
}
