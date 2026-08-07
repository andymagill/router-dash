"use client"

import * as React from "react"
import { SlidersHorizontalIcon, AlertTriangleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { type ORModel, type RunParams, supportsParam } from "@/lib/openrouter"

function ParamWarnings({
  models,
  param,
  label,
}: {
  models: ORModel[]
  param: string
  label: string
}) {
  const unsupported = models.filter((m) => !supportsParam(m, param))
  if (unsupported.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      {unsupported.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-1.5 text-[11px] text-[color:var(--warn)]"
        >
          <AlertTriangleIcon className="size-3 shrink-0" />
          <span>
            {label} unsupported by{" "}
            <span className="font-medium">{m.name}</span> — will be omitted
          </span>
        </div>
      ))}
    </div>
  )
}

export function ParamsSheet({
  params,
  onChange,
  selectedModels,
}: {
  params: RunParams
  onChange: (next: RunParams) => void
  selectedModels: ORModel[]
}) {
  const set = <K extends keyof RunParams>(key: K, value: RunParams[K]) =>
    onChange({ ...params, [key]: value })

  const tweaked =
    params.temperature !== 1 ||
    params.topP !== 1 ||
    params.maxTokens !== 1024 ||
    params.systemPrompt.trim().length > 0

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <SlidersHorizontalIcon data-icon="inline-start" />
            Parameters
            {tweaked && (
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            )}
          </Button>
        }
      />
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <SlidersHorizontalIcon className="size-4 text-primary" />
            Generation Parameters
          </SheetTitle>
          <SheetDescription>
            Applied to every model in this run. Unsupported parameters are
            skipped automatically per model.
          </SheetDescription>
        </SheetHeader>

        <div className="scrollbar-thin flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          {/* System prompt */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="system-prompt" className="text-xs font-medium">
              System Prompt
            </Label>
            <Textarea
              id="system-prompt"
              value={params.systemPrompt}
              onChange={(e) => set("systemPrompt", e.target.value)}
              placeholder="You are a helpful assistant…"
              className="min-h-28 resize-y font-mono text-[13px] leading-relaxed"
            />
          </div>

          <Separator />

          {/* Temperature */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Temperature</Label>
              <Badge variant="secondary" className="font-mono">
                {params.temperature.toFixed(2)}
              </Badge>
            </div>
            <Slider
              value={params.temperature}
              min={0}
              max={2}
              step={0.01}
              onValueChange={(v) =>
                set("temperature", Array.isArray(v) ? v[0] : v)
              }
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Precise · 0.0</span>
              <span>Creative · 2.0</span>
            </div>
            <ParamWarnings
              models={selectedModels}
              param="temperature"
              label="Temperature"
            />
          </div>

          {/* Top P */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Top P</Label>
              <Badge variant="secondary" className="font-mono">
                {params.topP.toFixed(2)}
              </Badge>
            </div>
            <Slider
              value={params.topP}
              min={0}
              max={1}
              step={0.01}
              onValueChange={(v) => set("topP", Array.isArray(v) ? v[0] : v)}
            />
            <ParamWarnings
              models={selectedModels}
              param="top_p"
              label="Top P"
            />
          </div>

          <Separator />

          {/* Max tokens */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="max-tokens" className="text-xs font-medium">
              Max Completion Tokens
            </Label>
            <Input
              id="max-tokens"
              type="number"
              min={1}
              max={200000}
              value={params.maxTokens}
              onChange={(e) =>
                set(
                  "maxTokens",
                  Math.max(1, Number(e.target.value) || 1),
                )
              }
              className="font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Upper bound on tokens generated per model response.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
