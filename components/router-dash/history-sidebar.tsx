"use client"

import * as React from "react"
import { HistoryIcon, Trash2Icon, XIcon, CheckCircle2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ProviderBadge } from "@/components/router-dash/provider-badge"
import { formatRelativeTime, formatCost } from "@/lib/format"
import type { HistoryEntry } from "@/lib/types"

function providerSlugFromId(id: string): string {
  return id.split("/")[0] || id
}

function HistoryCard({
  entry,
  active,
  onSelect,
  onDelete,
}: {
  entry: HistoryEntry
  active: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const slugs = Array.from(
    new Set(entry.modelIds.map((id) => providerSlugFromId(id))),
  ).slice(0, 5)
  const errored = entry.results.filter((r) => r.status === "error").length
  const line = entry.prompt.trim().split("\n")[0] || "Untitled prompt"

  return (
    <div
      className={cn(
        "group relative rounded-lg border p-2.5 transition-colors",
        active
          ? "border-primary/50 bg-primary/5"
          : "border-border bg-card/60 hover:border-primary/30 hover:bg-accent/40",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full flex-col gap-2 text-left"
        aria-label={`Load benchmark from ${formatRelativeTime(entry.createdAt)}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {formatRelativeTime(entry.createdAt)}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {formatCost(entry.totalCost)}
          </span>
        </div>

        <p className="line-clamp-2 pr-4 text-[13px] leading-snug text-foreground">
          {line}
        </p>

        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1">
            {slugs.map((slug) => (
              <ProviderBadge
                key={slug}
                slug={slug}
                className="size-4 ring-1 ring-card"
              />
            ))}
          </div>
          <Badge
            variant="secondary"
            className="h-4 gap-1 px-1 font-mono text-[9px]"
          >
            {entry.modelIds.length} model
            {entry.modelIds.length === 1 ? "" : "s"}
          </Badge>
          {errored > 0 ? (
            <span className="font-mono text-[9px] text-destructive">
              {errored} failed
            </span>
          ) : (
            <CheckCircle2Icon className="size-3 text-[oklch(0.6_0.15_155)]" />
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
        aria-label="Delete benchmark from history"
      >
        <XIcon className="size-3" />
      </button>
    </div>
  )
}

export function HistoryPanel({
  entries,
  activeId,
  onSelect,
  onDelete,
  onClear,
}: {
  entries: HistoryEntry[]
  activeId: string | null
  onSelect: (entry: HistoryEntry) => void
  onDelete: (id: string) => void
  onClear: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <HistoryIcon className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">History</h2>
          <Badge variant="secondary" className="h-5 px-1.5 font-mono text-[10px]">
            {entries.length}
          </Badge>
        </div>
        {entries.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClear}
            aria-label="Clear all history"
            className="text-muted-foreground"
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <div className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
            <HistoryIcon className="size-4" />
          </div>
          <p className="text-pretty text-xs text-muted-foreground">
            Your past benchmark runs will appear here. Run one to get started.
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-2 p-2.5">
            {entries.map((entry) => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                active={entry.id === activeId}
                onSelect={() => onSelect(entry)}
                onDelete={() => onDelete(entry.id)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

/** Persistent left column, desktop only. */
export function HistorySidebar(props: React.ComponentProps<typeof HistoryPanel>) {
  return (
    <aside className="sticky top-4 hidden h-[calc(100svh-2rem)] w-72 shrink-0 overflow-hidden rounded-2xl border border-border bg-card/40 lg:flex">
      <HistoryPanel {...props} />
    </aside>
  )
}

/** Trigger + drawer for smaller screens. */
export function HistorySheet(props: React.ComponentProps<typeof HistoryPanel>) {
  const [open, setOpen] = React.useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <HistoryIcon data-icon="inline-start" />
            History
            {props.entries.length > 0 && (
              <Badge
                variant="secondary"
                className="h-4 px-1 font-mono text-[9px]"
              >
                {props.entries.length}
              </Badge>
            )}
          </Button>
        }
      />
      <SheetContent side="left" className="w-80 gap-0 p-0" showCloseButton={false}>
        <SheetHeader className="sr-only">
          <SheetTitle>Benchmark history</SheetTitle>
        </SheetHeader>
        <HistoryPanel
          {...props}
          onSelect={(entry) => {
            props.onSelect(entry)
            setOpen(false)
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
