"use client"

import {
  Loader2Icon,
  CheckCircle2Icon,
  CircleDashedIcon,
  TriangleAlertIcon,
  CopyIcon,
  CheckIcon,
  ImageOffIcon,
} from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"
import { Markdown } from "@/components/markdown"
import {
  ProviderBadge,
  ProviderTag,
} from "@/components/router-dash/provider-badge"
import { providerLabel } from "@/lib/openrouter"
import { type UnifiedModel, parseModelKey } from "@/lib/providers"
import type { RunState, RunStatus } from "@/lib/types"
import {
  formatNumber,
  formatCost,
  formatLatency,
  formatContext,
} from "@/lib/format"

function StatusPill({ status }: { status: RunStatus }) {
  const map: Record<
    RunStatus,
    { label: string; className: string; icon: React.ElementType; spin?: boolean }
  > = {
    idle: {
      label: "Idle",
      className: "bg-muted text-muted-foreground",
      icon: CircleDashedIcon,
    },
    running: {
      label: "Running",
      className: "bg-[color:var(--cyan)]/15 text-[color:var(--cyan)]",
      icon: Loader2Icon,
      spin: true,
    },
    done: {
      label: "Done",
      className: "bg-[color:var(--ok)]/15 text-[color:var(--ok)]",
      icon: CheckCircle2Icon,
    },
    error: {
      label: "Error",
      className: "bg-destructive/15 text-destructive",
      icon: TriangleAlertIcon,
    },
    skipped: {
      label: "Skipped",
      className: "bg-[color:var(--warn)]/15 text-[color:var(--warn)]",
      icon: ImageOffIcon,
    },
  }
  const s = map[status]
  const Icon = s.icon
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium",
        s.className,
      )}
    >
      <Icon className={cn("size-3", s.spin && "animate-spin")} />
      {s.label}
    </span>
  )
}

function FooterMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="font-mono text-[11px] font-medium tabular-nums">
        {value}
      </span>
    </div>
  )
}

export function ResultCard({
  slot,
  modelKey,
  model,
  run,
}: {
  slot: string
  modelKey: string
  model: UnifiedModel | undefined
  run: RunState | undefined
}) {
  const status = run?.status ?? "idle"
  const parsed = parseModelKey(modelKey)
  const slug = model?.vendor ?? parsed.modelId.split("/")[0]
  const displayName = model?.name ?? parsed.modelId
  const provider = model?.provider ?? parsed.provider
  const [copied, setCopied] = React.useState(false)

  const copyOutput = async () => {
    if (!run?.content) return
    try {
      await navigator.clipboard.writeText(run.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      // blocked
    }
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border bg-surface/60 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded bg-primary/15 font-mono text-[10px] font-semibold text-primary">
            {slot}
          </span>
          <ProviderBadge slug={slug} />
          <div className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5 truncate text-[13px] leading-tight font-medium">
              <span className="truncate">{displayName}</span>
              <ProviderTag provider={provider} />
            </span>
            <span className="truncate text-[10px] text-muted-foreground">
              {providerLabel(slug)}
              {model?.contextKnown
                ? ` · ${formatContext(model.contextLength ?? 0)} ctx`
                : ""}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {status === "done" && run?.content && (
            <button
              type="button"
              onClick={copyOutput}
              className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Copy response"
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

      {/* Body */}
      <div className="scrollbar-thin min-h-40 flex-1 overflow-y-auto px-3.5 py-3">
        {status === "idle" && (
          <div className="flex h-full min-h-32 items-center justify-center text-center text-[13px] text-muted-foreground">
            Awaiting run…
          </div>
        )}
        {status === "running" && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        )}
        {status === "error" && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-[13px] text-destructive">
            <span className="flex items-center gap-1.5 font-medium">
              <TriangleAlertIcon className="size-3.5" />
              Request failed
            </span>
            <span className="font-mono text-[12px] break-words opacity-90">
              {run?.error ?? "Unknown error"}
            </span>
          </div>
        )}
        {status === "skipped" && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-[color:var(--warn)]/30 bg-[color:var(--warn)]/10 p-3 text-[13px] text-[color:var(--warn)]">
            <span className="flex items-center gap-1.5 font-medium">
              <ImageOffIcon className="size-3.5" />
              Not run
            </span>
            <span className="text-[12px] break-words opacity-90">
              {run?.error ?? "This model does not support image input"}
            </span>
          </div>
        )}
        {status === "done" && run && (
          <Markdown content={run.content || "_(empty response)_"} />
        )}
      </div>

      {/* Footer metrics */}
      <div className="grid grid-cols-4 gap-2 border-t border-border bg-surface/60 px-3.5 py-2">
        <FooterMetric
          label="Latency"
          value={run && run.latencyMs ? formatLatency(run.latencyMs) : "—"}
        />
        <FooterMetric
          label="Prompt"
          value={run?.usage ? formatNumber(run.usage.prompt_tokens) : "—"}
        />
        <FooterMetric
          label="Completion"
          value={run?.usage ? formatNumber(run.usage.completion_tokens) : "—"}
        />
        <FooterMetric
          label="Cost"
          value={run && run.status === "done" ? formatCost(run.cost) : "—"}
        />
      </div>
    </div>
  )
}
