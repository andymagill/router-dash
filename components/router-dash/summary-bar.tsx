"use client"

import {
  TimerIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CircleDollarSignIcon,
} from "lucide-react"
import type { RunState } from "@/lib/types"
import { formatNumber, formatCost, formatLatency } from "@/lib/format"
import { cn } from "@/lib/utils"

function Metric({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  accent: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          accent,
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums">
          {value}
          {sub && (
            <span className="ml-1 text-[11px] font-normal text-muted-foreground">
              {sub}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

export function SummaryBar({
  results,
  elapsedMs,
}: {
  results: RunState[]
  elapsedMs: number
}) {
  const done = results.filter((r) => r.status === "done")
  const promptTokens = done.reduce(
    (a, r) => a + (r.usage?.prompt_tokens ?? 0),
    0,
  )
  const completionTokens = done.reduce(
    (a, r) => a + (r.usage?.completion_tokens ?? 0),
    0,
  )
  const totalCost = done.reduce((a, r) => a + r.cost, 0)

  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface md:grid-cols-4 md:divide-y-0">
      <Metric
        icon={TimerIcon}
        label="Total Elapsed"
        value={formatLatency(elapsedMs)}
        accent="bg-primary/15 text-primary"
      />
      <Metric
        icon={ArrowUpIcon}
        label="Prompt Tokens"
        value={formatNumber(promptTokens)}
        accent="bg-[color:var(--cyan)]/15 text-[color:var(--cyan)]"
      />
      <Metric
        icon={ArrowDownIcon}
        label="Completion Tokens"
        value={formatNumber(completionTokens)}
        accent="bg-[color:var(--ok)]/15 text-[color:var(--ok)]"
      />
      <Metric
        icon={CircleDollarSignIcon}
        label="Est. Total Cost"
        value={formatCost(totalCost)}
        sub={`${done.length}/${results.length} done`}
        accent="bg-[color:var(--warn)]/15 text-[color:var(--warn)]"
      />
    </div>
  )
}
