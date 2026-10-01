"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  SunIcon,
  MoonIcon,
  MessageSquareTextIcon,
  AudioLinesIcon,
} from "lucide-react"

const NAV = [
  { href: "/", label: "Text", icon: MessageSquareTextIcon },
  { href: "/transcribe", label: "Voice", icon: AudioLinesIcon },
] as const

/**
 * Switch between the text-model and voice (transcription) playgrounds. Inline
 * in the header from `sm` up; on phones the header row is already full, so it
 * becomes a slim tab bar beneath it instead.
 */
function ModeNav({ variant }: { variant: "inline" | "bar" }) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Mode"
      className={
        variant === "inline"
          ? "hidden items-center gap-0.5 sm:flex"
          : "grid grid-cols-2 sm:hidden"
      }
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors",
              variant === "inline"
                ? "h-8 rounded-md px-2"
                : "h-10 border-b-2",
              active
                ? variant === "inline"
                  ? "bg-primary/10 text-primary"
                  : "border-primary text-primary"
                : variant === "inline"
                  ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                  : "border-transparent text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

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
              / llm playground
            </span>
          </div>
        </div>

        <ModeNav variant="inline" />

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
      <div className="border-t border-border/60 sm:hidden">
        <ModeNav variant="bar" />
      </div>
    </header>
  )
}
