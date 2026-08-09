"use client"

import * as React from "react"
import {
  HistoryIcon,
  Trash2Icon,
  XIcon,
  CheckCircle2Icon,
  PinIcon,
  Share2Icon,
  DownloadIcon,
  UploadIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  TriangleAlertIcon,
} from "lucide-react"

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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { ProviderBadge } from "@/components/router-dash/provider-badge"
import { formatRelativeTime, formatCost } from "@/lib/format"
import type { HistoryEntry } from "@/lib/types"

function providerSlugFromId(id: string): string {
  return id.split("/")[0] || id
}

interface HistoryActions {
  onSelect: (entry: HistoryEntry) => void
  onDelete: (id: string) => void
  onClear: () => void
  onTogglePin: (id: string) => void
  onShare: (entry: HistoryEntry) => void
  onExportJson: () => void
  onExportCsv: () => void
  onImportFile: (file: File) => void
}

function CardAction({
  label,
  onClick,
  active,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "grid size-5 place-items-center rounded text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground",
        active
          ? "text-primary opacity-100"
          : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
      )}
    >
      {children}
    </button>
  )
}

function HistoryCard({
  entry,
  active,
  onSelect,
  onDelete,
  onTogglePin,
  onShare,
}: {
  entry: HistoryEntry
  active: boolean
  onSelect: () => void
  onDelete: () => void
  onTogglePin: () => void
  onShare: () => void
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
          : entry.pinned
            ? "border-primary/25 bg-card/80"
            : "border-border bg-card/60 hover:border-primary/30 hover:bg-accent/40",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full flex-col gap-2 text-left"
        aria-label={`Load benchmark from ${formatRelativeTime(entry.createdAt)}`}
      >
        <div className="flex items-center justify-between gap-2 pr-16">
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {entry.pinned && (
              <PinIcon className="size-3 fill-primary text-primary" />
            )}
            {formatRelativeTime(entry.createdAt)}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {formatCost(entry.totalCost)}
          </span>
        </div>

        <p className="line-clamp-2 text-[13px] leading-snug text-foreground">
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

      <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5">
        <CardAction
          label={entry.pinned ? "Unpin benchmark" : "Pin benchmark"}
          onClick={onTogglePin}
          active={entry.pinned}
        >
          <PinIcon className={cn("size-3", entry.pinned && "fill-current")} />
        </CardAction>
        <CardAction label="Copy share link" onClick={onShare}>
          <Share2Icon className="size-3" />
        </CardAction>
        <CardAction label="Delete benchmark from history" onClick={onDelete}>
          <XIcon className="size-3" />
        </CardAction>
      </div>
    </div>
  )
}

export function HistoryPanel({
  entries,
  activeId,
  storageWarning,
  onSelect,
  onDelete,
  onClear,
  onTogglePin,
  onShare,
  onExportJson,
  onExportCsv,
  onImportFile,
}: {
  entries: HistoryEntry[]
  activeId: string | null
  storageWarning?: boolean
} & HistoryActions) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const sorted = React.useMemo(() => {
    return [...entries].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
      return b.createdAt - a.createdAt
    })
  }, [entries])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onImportFile(file)
    // Reset so importing the same file twice still fires onChange.
    e.target.value = ""
  }

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
        <div className="flex items-center gap-0.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Import benchmark runs from JSON"
            className="text-muted-foreground"
          >
            <UploadIcon className="size-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Export history"
                  disabled={entries.length === 0}
                  className="text-muted-foreground"
                >
                  <DownloadIcon className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={onExportJson} className="gap-2">
                  <FileJsonIcon className="size-4" />
                  <div className="flex flex-col">
                    <span>Export JSON</span>
                    <span className="text-[10px] text-muted-foreground">
                      Full runs with responses
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportCsv} className="gap-2">
                  <FileSpreadsheetIcon className="size-4" />
                  <div className="flex flex-col">
                    <span>Export CSV</span>
                    <span className="text-[10px] text-muted-foreground">
                      Summary, no response bodies
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
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
      </div>

      {storageWarning && (
        <div className="flex items-start gap-2 border-b border-[color:var(--warn)]/30 bg-[color:var(--warn)]/10 px-3 py-2 text-[11px] text-[color:var(--warn)]">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
          <span className="text-pretty">
            Browser storage is full. Older unpinned runs may not be saved —
            export or clear some history to free space.
          </span>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <div className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
            <HistoryIcon className="size-4" />
          </div>
          <p className="text-pretty text-xs text-muted-foreground">
            Your past benchmark runs will appear here. Run one to get started, or
            import a previous export.
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-2 p-2.5">
            {sorted.map((entry) => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                active={entry.id === activeId}
                onSelect={() => onSelect(entry)}
                onDelete={() => onDelete(entry.id)}
                onTogglePin={() => onTogglePin(entry.id)}
                onShare={() => onShare(entry)}
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
