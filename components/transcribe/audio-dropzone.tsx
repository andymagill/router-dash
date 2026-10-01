"use client"

import * as React from "react"
import { UploadIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS } from "@/lib/audio/validate"

/**
 * File picker + drag-and-drop target for one audio file. The hidden input uses
 * `accept="audio/*"`, which on phones also offers voice memos and saved files.
 */
export function AudioDropzone({
  onFile,
  disabled,
  compact,
}: {
  onFile: (file: File) => void
  disabled?: boolean
  /** A slim variant used when a file is already loaded ("replace"). */
  compact?: boolean
}) {
  const [dragOver, setDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const pick = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="audio/*,.mp3,.wav,.m4a,.mp4,.webm,.ogg,.flac"
      className="hidden"
      disabled={disabled}
      onChange={(e) => {
        pick(e.target.files)
        // Reset so choosing the same file twice still fires onChange.
        e.target.value = ""
      }}
    />
  )

  if (compact) {
    return (
      <>
        {input}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon data-icon="inline-start" />
          Replace file
        </Button>
      </>
    )
  }

  return (
    <div
      className={cn(
        "grid place-items-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center transition-colors",
        dragOver && "border-primary bg-primary/5 ring-2 ring-primary/40",
      )}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (!disabled) pick(e.dataTransfer.files)
      }}
    >
      {input}
      <div className="mb-3 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
        <UploadIcon className="size-5" />
      </div>
      <h2 className="text-sm font-semibold">Add an audio file</h2>
      <p className="mt-1 max-w-sm text-pretty text-xs text-muted-foreground">
        Drop a file here or choose one. mp3, wav, m4a, webm, ogg or flac, up to{" "}
        {MAX_AUDIO_BYTES / (1024 * 1024)}MB and {MAX_AUDIO_SECONDS / 60}{" "}
        minutes.
      </p>
      <Button
        size="sm"
        className="mt-4 gap-1.5"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon data-icon="inline-start" />
        Choose file
      </Button>
    </div>
  )
}
