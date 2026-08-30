"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  PlayIcon,
  Loader2Icon,
  SquareIcon,
  FileTextIcon,
  ChevronDownIcon,
  PaperclipIcon,
  XIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PROMPT_PRESETS, type PromptPreset } from "@/lib/presets"
import { estimateTokens } from "@/lib/openrouter"
import { formatNumber } from "@/lib/format"
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGES,
  fileToPromptImage,
  validateIncomingFiles,
} from "@/lib/images"
import type { PromptImage } from "@/lib/providers"

const ACCEPT_ATTR = ALLOWED_IMAGE_TYPES.join(",")

export function PromptPanel({
  prompt,
  onPromptChange,
  images,
  onImagesChange,
  onApplyPreset,
  onRun,
  onCancel,
  running,
  canRun,
  paramsSlot,
}: {
  prompt: string
  onPromptChange: (value: string) => void
  images: PromptImage[]
  onImagesChange: (images: PromptImage[]) => void
  onApplyPreset: (preset: PromptPreset) => void
  onRun: () => void
  onCancel: () => void
  running: boolean
  canRun: boolean
  paramsSlot?: React.ReactNode
}) {
  const lineCount = prompt ? prompt.split("\n").length : 0
  const tokens = estimateTokens(prompt)
  const [dragOver, setDragOver] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      (e.metaKey || e.ctrlKey) &&
      e.key === "Enter" &&
      !e.nativeEvent.isComposing &&
      e.keyCode !== 229
    ) {
      e.preventDefault()
      if (canRun && !running) onRun()
    }
  }

  const addFiles = React.useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      const { accepted, rejected } = validateIncomingFiles(
        images.length,
        files,
      )
      if (rejected.length > 0) {
        toast.error(
          rejected.length === 1
            ? `${rejected[0].file.name}: ${rejected[0].reason}`
            : `${rejected.length} images skipped (type/size/count limit)`,
        )
      }
      if (accepted.length === 0) return
      const added = await Promise.all(accepted.map(fileToPromptImage))
      onImagesChange([...images, ...added])
    },
    [images, onImagesChange],
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    void addFiles(Array.from(e.target.files ?? []))
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    void addFiles(Array.from(e.dataTransfer.files ?? []))
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
      ALLOWED_IMAGE_TYPES.includes(f.type),
    )
    if (files.length === 0) return
    void addFiles(files)
  }

  const removeImage = (id: string) => {
    onImagesChange(images.filter((img) => img.id !== id))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileTextIcon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Prompt</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {paramsSlot}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTR}
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={images.length >= MAX_IMAGES}
          >
            <PaperclipIcon data-icon="inline-start" />
            Attach
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="gap-1.5">
                  Presets
                  <ChevronDownIcon data-icon="inline-end" className="opacity-60" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Prompt presets</DropdownMenuLabel>
                {PROMPT_PRESETS.map((preset) => (
                  <DropdownMenuItem
                    key={preset.id}
                    onClick={() => onApplyPreset(preset)}
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{preset.label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {preset.description}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        className={cn(
          "relative rounded-md",
          dragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Enter the prompt to send to every selected model… (attach or drop images, or paste one in)"
          className="min-h-40 resize-y font-mono text-[13px] leading-relaxed"
        />
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative size-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
            >
              <img
                src={img.dataUrl}
                alt={img.name}
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                aria-label={`Remove ${img.name}`}
                className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-background/90 text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
              >
                <XIcon className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span>{lineCount} lines</span>
          <span className="text-border">|</span>
          <span>{prompt.length} chars</span>
          <span className="text-border">|</span>
          <span>~{formatNumber(tokens)} tokens</span>
          {images.length > 0 && (
            <>
              <span className="text-border">|</span>
              <span>
                {images.length} image{images.length === 1 ? "" : "s"}
              </span>
            </>
          )}
        </div>

        {running ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onCancel}
            className="gap-1.5"
          >
            <SquareIcon data-icon="inline-start" className="fill-current" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onRun}
            disabled={!canRun}
            className="gap-1.5"
          >
            <PlayIcon data-icon="inline-start" className="fill-current" />
            Run Benchmarks
            <kbd className="ml-1 hidden rounded bg-primary-foreground/15 px-1 py-0.5 font-mono text-[10px] sm:inline">
              ⌘↵
            </kbd>
          </Button>
        )}
      </div>
    </div>
  )
}
