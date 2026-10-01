"use client"

import * as React from "react"
import {
  AudioLinesIcon,
  PinIcon,
  Trash2Icon,
  XIcon,
  CheckCircle2Icon,
  TriangleAlertIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { formatLatency, formatRelativeTime } from "@/lib/format"
import type { TranscriptionSession } from "@/lib/transcription"

interface SessionActions {
  onSelect: (session: TranscriptionSession) => void
  onDelete: (id: string) => void
  onClear: () => void
  onTogglePin: (id: string) => void
}

function SessionCard({
  session,
  active,
  onSelect,
  onDelete,
  onTogglePin,
}: {
  session: TranscriptionSession
  active: boolean
  onSelect: () => void
  onDelete: () => void
  onTogglePin: () => void
}) {
  const errored = session.results.filter((r) => r.status === "error").length

  return (
    <div
      className={cn(
        "group relative rounded-lg border p-2.5 transition-colors",
        active
          ? "border-primary/50 bg-primary/5"
          : session.pinned
            ? "border-primary/25 bg-card/80"
            : "border-border bg-card/60 hover:border-primary/30 hover:bg-accent/40",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full flex-col gap-2 text-left"
        aria-label={`Open ${session.fileName}`}
      >
        <div className="flex items-center justify-between gap-2 pr-14">
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {session.pinned && (
              <PinIcon className="size-3 fill-primary text-primary" />
            )}
            {formatRelativeTime(session.createdAt)}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {formatLatency(session.durationMs)}
          </span>
        </div>
        <p className="line-clamp-2 text-[13px] leading-snug break-all text-foreground">
          {session.fileName}
        </p>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className="h-4 gap-1 px-1 font-mono text-[9px]"
          >
            {session.results.length} model
            {session.results.length === 1 ? "" : "s"}
          </Badge>
          {errored > 0 ? (
            <span className="flex items-center gap-1 font-mono text-[9px] text-destructive">
              <TriangleAlertIcon className="size-2.5" />
              {errored} failed
            </span>
          ) : (
            session.results.length > 0 && (
              <CheckCircle2Icon className="size-3 text-[oklch(0.6_0.15_155)]" />
            )
          )}
        </div>
      </button>

      <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5">
        <ActionButton
          label={session.pinned ? "Unpin session" : "Pin session"}
          onClick={onTogglePin}
          active={session.pinned}
        >
          <PinIcon className={cn("size-3", session.pinned && "fill-current")} />
        </ActionButton>
        <ActionButton label="Delete session and its audio" onClick={onDelete}>
          <XIcon className="size-3" />
        </ActionButton>
      </div>
    </div>
  )
}

function ActionButton({
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
        // Always visible on touch screens, where there is no hover.
        active
          ? "text-primary opacity-100"
          : "opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100",
      )}
    >
      {children}
    </button>
  )
}

function SessionsPanel({
  sessions,
  activeId,
  storageWarning,
  onSelect,
  onDelete,
  onClear,
  onTogglePin,
}: {
  sessions: TranscriptionSession[]
  activeId: string | null
  storageWarning?: boolean
} & SessionActions) {
  const sorted = React.useMemo(
    () =>
      [...sessions].sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
        return b.createdAt - a.createdAt
      }),
    [sessions],
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <AudioLinesIcon className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Sessions</h2>
          <Badge variant="secondary" className="h-5 px-1.5 font-mono text-[10px]">
            {sessions.length}
          </Badge>
        </div>
        {sessions.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClear}
            aria-label="Delete all sessions and their audio"
            className="text-muted-foreground"
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        )}
      </div>

      {storageWarning && (
        <div className="flex items-start gap-2 border-b border-[color:var(--warn)]/30 bg-[color:var(--warn)]/10 px-3 py-2 text-[11px] text-[color:var(--warn)]">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
          <span className="text-pretty">
            Browser storage is nearly full. Delete older sessions to make room
            for new audio.
          </span>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <div className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
            <AudioLinesIcon className="size-4" />
          </div>
          <p className="text-pretty text-xs text-muted-foreground">
            Transcribed files appear here with their audio, so you can play
            them back or run them through other models.
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-2 p-2.5">
            {sorted.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                active={session.id === activeId}
                onSelect={() => onSelect(session)}
                onDelete={() => onDelete(session.id)}
                onTogglePin={() => onTogglePin(session.id)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

/** Trigger + drawer listing saved sessions. */
export function SessionsSheet(props: React.ComponentProps<typeof SessionsPanel>) {
  const [open, setOpen] = React.useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            aria-label="Sessions"
          >
            <AudioLinesIcon data-icon="inline-start" />
            {/* Icon-only on phones: the header row has no room for the label. */}
            <span className="hidden sm:inline">Sessions</span>
            {props.sessions.length > 0 && (
              <Badge
                variant="secondary"
                className="h-4 px-1 font-mono text-[9px]"
              >
                {props.sessions.length}
              </Badge>
            )}
          </Button>
        }
      />
      <SheetContent side="left" className="w-80 gap-0 p-0" showCloseButton={false}>
        <SheetHeader className="sr-only">
          <SheetTitle>Transcription sessions</SheetTitle>
        </SheetHeader>
        <SessionsPanel
          {...props}
          onSelect={(session) => {
            props.onSelect(session)
            setOpen(false)
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
