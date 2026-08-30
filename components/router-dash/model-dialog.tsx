"use client"

import * as React from "react"
import {
  ArrowUpDownIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  GaugeIcon,
  GiftIcon,
  ImageIcon,
  RefreshCwIcon,
  SearchIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  ProviderBadge,
  ProviderTag,
} from "@/components/router-dash/provider-badge"
import { formatContext, hasFixedPrice, pricePerMillion } from "@/lib/format"
import { useLocalStorage } from "@/hooks/use-local-storage"
import {
  filterModels,
  sortModels,
  type MetaFilter,
  type SortColumn,
  type SortDir,
} from "@/lib/model-sort"
import {
  type UnifiedModel,
  type ProviderId,
  PROVIDER_ORDER,
  ADAPTERS,
  LONG_CONTEXT_THRESHOLD,
} from "@/lib/providers"

export const MAX_MODELS = 6

export interface ProviderState {
  /** True when the user has entered a key for this provider. */
  connected: boolean
  loading: boolean
  error: string | null
  count: number
}

const LONG_CONTEXT_LABEL = `Long context (≥${LONG_CONTEXT_THRESHOLD / 1000}K)`

const LIST_FORMAT = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
})

const COLUMNS: {
  column: SortColumn
  label: string
  className?: string
  align?: "right"
}[] = [
  { column: "name", label: "Model" },
  { column: "provider", label: "Provider", className: "hidden sm:table-cell" },
  { column: "context", label: "Context", align: "right" },
  { column: "promptPrice", label: "Input $/M", align: "right" },
  {
    column: "completionPrice",
    label: "Output $/M",
    align: "right",
    className: "hidden md:table-cell",
  },
]

/**
 * Tailwind preflight sets `border-collapse: collapse`, under which a collapsed
 * border on a sticky element does not paint. Stick the cells themselves and
 * draw the divider with an inset shadow instead.
 */
const STICKY_HEAD =
  "sticky top-0 z-10 bg-popover shadow-[inset_0_-1px_0_var(--border)]"

/**
 * Prices are shown honestly: a fixed rate when we have one, "varies" for the
 * runtime-priced routers OpenRouter reports as "-1", and "n/a" when the
 * provider gave us no pricing at all.
 */
function Price({
  model,
  perToken,
}: {
  model: UnifiedModel
  perToken: string | undefined
}) {
  if (model.isFree) return <>Free</>
  if (model.pricingKnown && hasFixedPrice(perToken)) {
    return <>{pricePerMillion(perToken)}</>
  }
  return (
    <span className="text-muted-foreground">
      {model.pricingKnown ? "varies" : "n/a"}
    </span>
  )
}

interface ModelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  models: UnifiedModel[]
  providerStates: Record<ProviderId, ProviderState>
  selectedKeys: string[]
  onChange: (keys: string[]) => void
  onRefresh: (provider: ProviderId) => void
}

export function ModelDialog({
  open,
  onOpenChange,
  models,
  providerStates,
  selectedKeys,
  onChange,
  onRefresh,
}: ModelDialogProps) {
  const [search, setSearch] = React.useState("")
  const [providerFilters, setProviderFilters] = useLocalStorage<ProviderId[]>(
    "routerdash:providerFilters",
    [],
  )
  const [metaFilters, setMetaFilters] = useLocalStorage<MetaFilter[]>(
    "routerdash:metaFilters",
    [],
  )
  // Sort is a transient scan mode, so unlike the filters it is not persisted.
  const [sort, setSort] = React.useState<{
    column: SortColumn
    dir: SortDir
  }>({ column: "provider", dir: "asc" })

  // A provider whose catalog needs a key stays hidden until one is present —
  // no toggle, no status row, no empty section advertising it.
  const availableProviders = React.useMemo(
    () =>
      PROVIDER_ORDER.filter(
        (p) =>
          !ADAPTERS[p].requiresKeyForCatalog || providerStates[p].connected,
      ),
    [providerStates],
  )

  // A persisted filter naming a now-hidden provider would empty the table with
  // no visible toggle left to release it.
  const activeProviderFilters = React.useMemo(
    () => providerFilters.filter((p) => availableProviders.includes(p)),
    [providerFilters, availableProviders],
  )

  // With a single provider the Provider column is the same value on every row.
  const columns = React.useMemo(
    () =>
      COLUMNS.filter(
        (c) => c.column !== "provider" || availableProviders.length > 1,
      ),
    [availableProviders],
  )

  // Sorting by a column nobody can see leaves no header showing an indicator.
  // Provider-then-name over one provider is just name, so say so.
  const activeSort = React.useMemo(
    () =>
      columns.some((c) => c.column === sort.column)
        ? sort
        : { column: "name" as SortColumn, dir: sort.dir },
    [columns, sort],
  )

  const rows = React.useMemo(() => {
    const visible = models.filter((m) => availableProviders.includes(m.provider))
    const filtered = filterModels(visible, {
      search,
      providers: activeProviderFilters,
      meta: metaFilters,
    })
    return sortModels(filtered, activeSort.column, activeSort.dir)
  }, [
    models,
    availableProviders,
    search,
    activeProviderFilters,
    metaFilters,
    activeSort,
  ])

  const toggleModel = (key: string) => {
    if (selectedKeys.includes(key)) {
      onChange(selectedKeys.filter((s) => s !== key))
      return
    }
    if (selectedKeys.length >= MAX_MODELS) {
      toast.error(`You can compare up to ${MAX_MODELS} models at once`)
      return
    }
    onChange([...selectedKeys, key])
  }

  const toggleSort = (column: SortColumn) => {
    setSort((prev) =>
      prev.column === column
        ? { column, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { column, dir: "asc" },
    )
  }

  const anyLoading = availableProviders.some((p) => providerStates[p].loading)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {/* Header: title, controls, provider status — pinned above the table */}
        <div className="shrink-0 border-b border-border">
          <DialogHeader className="gap-1 p-4 pb-3">
            <DialogTitle>Select models</DialogTitle>
            <DialogDescription>
              Compare up to {MAX_MODELS} models across{" "}
              {LIST_FORMAT.format(
                availableProviders.map((p) => ADAPTERS[p].label),
              )}
              .
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 px-4 pb-3">
            <InputGroup className="h-9">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search model, provider, owner..."
                aria-label="Search models"
              />
              {search && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    <XIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {/* Pointless as a single-option toggle when only one provider is available. */}
              {availableProviders.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Provider
                  </span>
                  <ToggleGroup
                    value={activeProviderFilters}
                    onValueChange={(v) => setProviderFilters(v as ProviderId[])}
                    spacing={2}
                  >
                    {availableProviders.map((p) => (
                      <ToggleGroupItem
                        key={p}
                        value={p}
                        variant="outline"
                        size="sm"
                        className="data-pressed:border-primary/40 data-pressed:bg-primary/10 data-pressed:text-primary"
                      >
                        {ADAPTERS[p].label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Filter
                </span>
                <ToggleGroup
                  value={metaFilters}
                  onValueChange={(v) => setMetaFilters(v as MetaFilter[])}
                  spacing={2}
                >
                  <ToggleGroupItem
                    value="free"
                    variant="outline"
                    size="sm"
                    className="data-pressed:border-primary/40 data-pressed:bg-primary/10 data-pressed:text-primary"
                  >
                    <GiftIcon data-icon="inline-start" />
                    Free
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="long"
                    variant="outline"
                    size="sm"
                    className="data-pressed:border-primary/40 data-pressed:bg-primary/10 data-pressed:text-primary"
                  >
                    <GaugeIcon data-icon="inline-start" />
                    {LONG_CONTEXT_LABEL}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="vision"
                    variant="outline"
                    size="sm"
                    className="data-pressed:border-primary/40 data-pressed:bg-primary/10 data-pressed:text-primary"
                  >
                    <ImageIcon data-icon="inline-start" />
                    Vision
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {/* Per-provider catalog status: count, refresh, key CTA, errors */}
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {availableProviders.map((p) => {
                  const state = providerStates[p]
                  return (
                    <div key={p} className="flex items-center gap-1.5">
                      <ProviderTag provider={p} />
                      <span className="text-[11px] text-muted-foreground">
                        {state.loading ? "loading…" : `${state.count} models`}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRefresh(p)}
                        disabled={state.loading}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                      >
                        <RefreshCwIcon
                          className={cn(
                            "size-3",
                            state.loading && "animate-spin",
                          )}
                        />
                        Refresh
                      </button>
                    </div>
                  )
                })}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {rows.length} model{rows.length === 1 ? "" : "s"} shown ·{" "}
                  {selectedKeys.length}/{MAX_MODELS} selected
                </span>
              </div>

              {/*
                A key that is present but not working surfaces its catalog
                error here — that failure is the only signal the user gets that
                the key is bad, so it is never hidden.
              */}
              {availableProviders.map((p) => {
                const state = providerStates[p]
                if (!state.error) return null
                return (
                  <div
                    key={p}
                    className="flex items-start gap-1.5 rounded border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive"
                  >
                    <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      {ADAPTERS[p].label}: {state.error}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Scrollable table region */}
        <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn("w-9", STICKY_HEAD)} aria-label="Selected" />
                {columns.map((c) => {
                  const isActive = activeSort.column === c.column
                  return (
                    <TableHead
                      key={c.column}
                      className={cn(c.className, STICKY_HEAD)}
                      aria-sort={
                        isActive
                          ? activeSort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(c.column)}
                        className={cn(
                          "flex w-full items-center gap-1 rounded transition-colors hover:text-foreground",
                          c.align === "right" && "justify-end",
                          isActive && "text-foreground",
                        )}
                      >
                        {c.label}
                        {isActive ? (
                          activeSort.dir === "asc" ? (
                            <ChevronUpIcon className="size-3" />
                          ) : (
                            <ChevronDownIcon className="size-3" />
                          )
                        ) : (
                          <ArrowUpDownIcon className="size-3 opacity-50" />
                        )}
                      </button>
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length + 1}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {anyLoading ? "Loading models…" : "No models match."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((m) => {
                  const active = selectedKeys.includes(m.key)
                  return (
                    <TableRow
                      key={m.key}
                      data-selected={active}
                      aria-selected={active}
                      onClick={() => toggleModel(m.key)}
                      className="cursor-pointer"
                    >
                      <TableCell className="pl-4">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={active}
                          aria-label={`Select ${m.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleModel(m.key)
                          }}
                          className={cn(
                            "grid size-4 shrink-0 place-items-center rounded border",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border",
                          )}
                        >
                          {active && <CheckIcon className="size-3" />}
                        </button>
                      </TableCell>

                      <TableCell className="w-full max-w-0">
                        <div className="flex min-w-0 items-start gap-2">
                          <ProviderBadge slug={m.vendor} className="mt-0.5" />
                          <div className="flex min-w-0 flex-col">
                            <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                              <span className="truncate">{m.name}</span>
                              {m.isFree && (
                                <Badge
                                  variant="secondary"
                                  className="h-4 px-1 text-[9px] uppercase"
                                >
                                  Free
                                </Badge>
                              )}
                              {m.preview && (
                                <Badge
                                  variant="outline"
                                  className="h-4 px-1 text-[9px] uppercase"
                                >
                                  Preview
                                </Badge>
                              )}
                              {m.inputModalities?.includes("image") && (
                                <Badge
                                  variant="outline"
                                  className="h-4 gap-0.5 px-1 text-[9px] uppercase"
                                >
                                  <ImageIcon className="size-2.5" />
                                  Vision
                                </Badge>
                              )}
                            </span>
                            <span className="truncate font-mono text-[11px] text-muted-foreground">
                              {m.modelId}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {availableProviders.length > 1 && (
                        <TableCell className="hidden sm:table-cell">
                          <ProviderTag provider={m.provider} />
                        </TableCell>
                      )}

                      <TableCell className="text-right font-mono text-[11px] whitespace-nowrap">
                        {m.contextKnown ? (
                          formatContext(m.contextLength)
                        ) : (
                          <span className="text-muted-foreground">n/a</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right font-mono text-[11px] whitespace-nowrap">
                        <Price model={m} perToken={m.promptPrice} />
                      </TableCell>

                      <TableCell className="hidden text-right font-mono text-[11px] whitespace-nowrap md:table-cell">
                        <Price model={m} perToken={m.completionPrice} />
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {selectedKeys.length}/{MAX_MODELS} selected
          </span>
          <div className="flex items-center gap-2">
            {selectedKeys.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange([])}
                className="text-muted-foreground"
              >
                Clear all
              </Button>
            )}
            <DialogClose render={<Button size="sm" />}>Done</DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
