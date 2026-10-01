"use client"

import * as React from "react"
import { CheckIcon, CopyIcon, TriangleAlertIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  ProviderBadge,
  ProviderTag,
} from "@/components/router-dash/provider-badge"
import {
  FooterMetric,
  StatusPill,
} from "@/components/router-dash/result-card"
import { providerLabel } from "@/lib/openrouter"
import type { UnifiedModel } from "@/lib/providers"
import { formatCost, formatLatency, formatNumber } from "@/lib/format"
import { resolveSttModel } from "@/lib/transcription/models"
import { realtimeFactor, wordCount } from "@/lib/transcription/sessions"
import type { TranscriptResult } from "@/lib/transcription"

const SLOT_LABELS = ["A", "B", "C", "D", "E", "F"]

function TranscriptCard({
  slot,
  model,
  result,
  durationMs,
}: {
  slot: string
  model: UnifiedModel
  result: TranscriptResult
  durationMs: number
}) {
  const [copied, setCopied] = React.useState(false)
  const { status } = result

  const copyText = async () => {
    if (!result.text) return
    try {
      await navigator.clipboard.writeText(result.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      // clipboard blocked
    }
  }

  const rtf = realtimeFactor(result.latencyMs, durationMs)

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-2 border-b border-border bg-surface/60 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded bg-primary/15 font-mono text-[10px] font-semibold text-primary">
            {slot}
          </span>
          <ProviderBadge slug={model.vendor} />
          <div className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5 truncate text-[13px] leading-tight font-medium">
              <span className="truncate">{model.name}</span>
              <ProviderTag provider={model.provider} />
            </span>
            <span className="truncate text-[10px] text-muted-foreground">
              {providerLabel(model.vendor)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {status === "done" && result.text && (
            <button
              type="button"
              onClick={copyText}
              className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Copy transcript"
            >
              {copied ? (
                <CheckIcon className="size-3.5 text-[color:var(--ok)]" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
            </button>
          )}
          <StatusPill status={status} />
        </div>
      </div>

      <div className="scrollbar-thin min-h-40 flex-1 overflow-y-auto px-3.5 py-3">
        {status === "running" && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
          </div>
        )}
        {status === "error" && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-[13px] text-destructive">
            <span className="flex items-center gap-1.5 font-medium">
              <TriangleAlertIcon className="size-3.5" />
              Transcription failed
            </span>
            <span className="font-mono text-[12px] break-words opacity-90">
              {result.error ?? "Unknown error"}
            </span>
          </div>
        )}
        {status === "done" &&
          (result.text ? (
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
              {result.text}
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground italic">
              (no speech detected)
            </p>
          ))}
      </div>

      <div className="grid grid-cols-4 gap-2 border-t border-border bg-surface/60 px-3.5 py-2">
        <FooterMetric
          label="Latency"
          value={result.latencyMs ? formatLatency(result.latencyMs) : "—"}
        />
        <FooterMetric
          label="Speed"
          value={status === "done" && rtf !== null ? `${rtf.toFixed(2)}×` : "—"}
        />
        <FooterMetric
          label="Words"
          value={status === "done" ? formatNumber(wordCount(result.text)) : "—"}
        />
        <FooterMetric
          label="Cost"
          value={
            status === "done" && result.usage ? formatCost(result.cost) : "—"
          }
        />
      </div>
    </div>
  )
}

export function TranscriptGrid({
  results,
  modelByKey,
  durationMs,
}: {
  results: Map<string, TranscriptResult>
  modelByKey: Map<string, UnifiedModel>
  durationMs: number
}) {
  const keys = Array.from(results.keys())
  const cols =
    keys.length >= 3
      ? "lg:grid-cols-2 2xl:grid-cols-3"
      : keys.length === 2
        ? "lg:grid-cols-2"
        : "lg:grid-cols-1"

  return (
    <div className={cn("grid grid-cols-1 gap-3", cols)}>
      {keys.map((key, idx) => (
        <TranscriptCard
          key={key}
          slot={SLOT_LABELS[idx] ?? String(idx + 1)}
          model={resolveSttModel(key, modelByKey)}
          result={results.get(key)!}
          durationMs={durationMs}
        />
      ))}
    </div>
  )
}
