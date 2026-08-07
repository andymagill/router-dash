"use client"

import * as React from "react"
import { GitCompareIcon, ArrowRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ResultCard } from "@/components/router-dash/result-card"
import { SLOT_LABELS } from "@/components/router-dash/grid-view"
import { diffLines, diffStats } from "@/lib/diff"
import type { ORModel } from "@/lib/openrouter"
import type { RunState } from "@/lib/types"

function DiffColumn({
  rows,
  side,
}: {
  rows: ReturnType<typeof diffLines>
  side: "left" | "right"
}) {
  return (
    <div className="scrollbar-thin min-w-0 overflow-x-auto font-mono text-[12px] leading-[1.65]">
      {rows.map((row, i) => {
        const text = side === "left" ? row.left : row.right
        const isChange =
          (side === "left" && row.type === "delete") ||
          (side === "right" && row.type === "insert")
        const isEmpty = text === null
        return (
          <div
            key={i}
            className={cn(
              "flex min-h-[1.65em] whitespace-pre-wrap",
              isChange && side === "left" && "bg-destructive/15",
              isChange && side === "right" && "bg-[color:var(--ok)]/15",
              isEmpty && "bg-muted/30",
            )}
          >
            <span
              className={cn(
                "w-6 shrink-0 border-r border-border/60 pr-1 text-right text-muted-foreground/50 select-none",
              )}
            >
              {isEmpty ? "" : side === "left" ? "-" : "+"}
            </span>
            <span
              className={cn(
                "px-2",
                isChange && side === "left" && "text-destructive",
                isChange && side === "right" && "text-[color:var(--ok)]",
              )}
            >
              {text ?? ""}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function DiffPanel({
  selectedIds,
  modelById,
  results,
}: {
  selectedIds: string[]
  modelById: Map<string, ORModel>
  results: Map<string, RunState>
}) {
  const [leftId, setLeftId] = React.useState(selectedIds[0])
  const [rightId, setRightId] = React.useState(selectedIds[1])

  // Keep selection valid as the model set changes.
  React.useEffect(() => {
    if (!leftId || !selectedIds.includes(leftId)) setLeftId(selectedIds[0])
    if (!rightId || !selectedIds.includes(rightId))
      setRightId(selectedIds[1] ?? selectedIds[0])
  }, [selectedIds, leftId, rightId])

  const leftRun = leftId ? results.get(leftId) : undefined
  const rightRun = rightId ? results.get(rightId) : undefined
  const leftText = leftRun?.status === "done" ? leftRun.content : ""
  const rightText = rightRun?.status === "done" ? rightRun.content : ""

  const rows = React.useMemo(
    () => diffLines(leftText, rightText),
    [leftText, rightText],
  )
  const stats = React.useMemo(() => diffStats(rows), [rows])

  const ModelSelect = ({
    value,
    onChange,
  }: {
    value: string | undefined
    onChange: (v: string) => void
  }) => (
    <Select value={value} onValueChange={(v) => onChange(v as string)}>
      <SelectTrigger size="sm" className="w-full min-w-0">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {selectedIds.map((id, idx) => (
            <SelectItem key={id} value={id}>
              {SLOT_LABELS[idx]} · {modelById.get(id)?.name ?? id}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )

  const hasBoth = Boolean(leftText) && Boolean(rightText)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center">
        <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
          <ModelSelect value={leftId} onChange={setLeftId} />
          <ArrowRightIcon className="size-4 text-muted-foreground" />
          <ModelSelect value={rightId} onChange={setRightId} />
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className="bg-[color:var(--ok)]/15 font-mono text-[color:var(--ok)]"
          >
            +{stats.added}
          </Badge>
          <Badge
            variant="secondary"
            className="bg-destructive/15 font-mono text-destructive"
          >
            -{stats.removed}
          </Badge>
        </div>
      </div>

      {hasBoth ? (
        <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-xl border border-border bg-card">
          <div className="min-w-0">
            <div className="border-b border-border bg-surface/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
              {modelById.get(leftId ?? "")?.name ?? leftId} (A)
            </div>
            <div className="scrollbar-thin max-h-[60vh] overflow-y-auto py-2">
              <DiffColumn rows={rows} side="left" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="border-b border-border bg-surface/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
              {modelById.get(rightId ?? "")?.name ?? rightId} (B)
            </div>
            <div className="scrollbar-thin max-h-[60vh] overflow-y-auto py-2">
              <DiffColumn rows={rows} side="right" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card px-4 py-16 text-center text-[13px] text-muted-foreground">
          Run both selected models to see a line-by-line diff.
        </div>
      )}
    </div>
  )
}

export function DiffView({
  selectedIds,
  modelById,
  results,
}: {
  selectedIds: string[]
  modelById: Map<string, ORModel>
  results: Map<string, RunState>
}) {
  const [tab, setTab] = React.useState("diff")

  // Reset to a valid tab when the model set changes.
  React.useEffect(() => {
    if (tab !== "diff" && !selectedIds.includes(tab)) {
      setTab(selectedIds.length >= 2 ? "diff" : (selectedIds[0] ?? "diff"))
    }
  }, [selectedIds, tab])

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as string)}>
      <TabsList className="h-9 flex-wrap">
        {selectedIds.length >= 2 && (
          <TabsTrigger value="diff" className="gap-1.5">
            <GitCompareIcon />
            Diff A / B
          </TabsTrigger>
        )}
        {selectedIds.map((id, idx) => (
          <TabsTrigger key={id} value={id} className="gap-1.5">
            <span className="grid size-4 place-items-center rounded bg-primary/15 font-mono text-[9px] font-semibold text-primary">
              {SLOT_LABELS[idx]}
            </span>
            <span className="max-w-32 truncate">
              {modelById.get(id)?.name ?? id}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      {selectedIds.length >= 2 && (
        <TabsContent value="diff">
          <DiffPanel
            selectedIds={selectedIds}
            modelById={modelById}
            results={results}
          />
        </TabsContent>
      )}

      {selectedIds.map((id, idx) => (
        <TabsContent key={id} value={id}>
          <ResultCard
            slot={SLOT_LABELS[idx] ?? String(idx + 1)}
            modelId={id}
            model={modelById.get(id)}
            run={results.get(id)}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}
