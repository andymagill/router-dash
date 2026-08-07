"use client"

import * as React from "react"
import {
  PlayIcon,
  Loader2Icon,
  SquareIcon,
  FileTextIcon,
  ChevronDownIcon,
} from "lucide-react"

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

export function PromptPanel({
  prompt,
  onPromptChange,
  onApplyPreset,
  onRun,
  onCancel,
  running,
  canRun,
  paramsSlot,
}: {
  prompt: string
  onPromptChange: (value: string) => void
  onApplyPreset: (preset: PromptPreset) => void
  onRun: () => void
  onCancel: () => void
  running: boolean
  canRun: boolean
  paramsSlot?: React.ReactNode
}) {
  const lineCount = prompt ? prompt.split("\n").length : 0
  const tokens = estimateTokens(prompt)

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileTextIcon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Prompt</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {paramsSlot}
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

      <div className="relative">
        <Textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter the prompt to send to every selected model…"
          className="min-h-40 resize-y font-mono text-[13px] leading-relaxed"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span>{lineCount} lines</span>
          <span className="text-border">|</span>
          <span>{prompt.length} chars</span>
          <span className="text-border">|</span>
          <span>~{formatNumber(tokens)} tokens</span>
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
