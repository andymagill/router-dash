"use client"

import * as React from "react"
import { FileAudioIcon, TriangleAlertIcon } from "lucide-react"

import { formatLatency } from "@/lib/format"

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * The loaded audio: file details plus a native player. Native controls give
 * Play, scrubbing and volume on desktop and mobile with no extra code.
 */
export function SessionPlayer({
  fileName,
  sizeBytes,
  durationMs,
  blob,
  actions,
}: {
  fileName: string
  sizeBytes: number
  durationMs: number
  /** Null when the stored audio is gone (cleared by the browser). */
  blob: Blob | null
  actions?: React.ReactNode
}) {
  const [url, setUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <FileAudioIcon className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{fileName}</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {formatLatency(durationMs)} · {formatSize(sizeBytes)}
            </span>
          </div>
        </div>
        {actions}
      </div>

      {url ? (
        <audio controls src={url} className="h-10 w-full" preload="metadata" />
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-[color:var(--warn)]/30 bg-[color:var(--warn)]/10 px-3 py-2 text-xs text-[color:var(--warn)]">
          <TriangleAlertIcon className="size-3.5 shrink-0" />
          The audio for this session is no longer stored in this browser, so it
          can&apos;t be played or transcribed again. The saved transcripts are
          still available.
        </div>
      )}
    </div>
  )
}
