"use client"

import * as React from "react"
import {
  PlusIcon,
  XIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  SparklesIcon,
  GiftIcon,
  ImageIcon,
  GaugeIcon,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ProviderBadge } from "@/components/router-dash/provider-badge"
import {
  type ORModel,
  providerOf,
  providerLabel,
  isFreeModel,
  isFlagship,
  isVisionModel,
} from "@/lib/openrouter"
import { formatContext, pricePerMillion } from "@/lib/format"

export const MAX_MODELS = 4

type FilterKey = "free" | "flagship" | "vision" | "context"

const FILTERS: { key: FilterKey; label: string; icon: React.ElementType }[] = [
  { key: "flagship", label: "Top Flagships", icon: SparklesIcon },
  { key: "free", label: "Free Models", icon: GiftIcon },
  { key: "vision", label: "Multimodal / Vision", icon: ImageIcon },
  { key: "context", label: "High Context (>100k)", icon: GaugeIcon },
]

export function ModelPicker({
  models,
  selectedIds,
  onChange,
  loading,
}: {
  models: ORModel[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  loading: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [filters, setFilters] = React.useState<string[]>([])

  const modelById = React.useMemo(() => {
    const map = new Map<string, ORModel>()
    for (const m of models) map.set(m.id, m)
    return map
  }, [models])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return models.filter((m) => {
      if (filters.includes("free") && !isFreeModel(m)) return false
      if (filters.includes("flagship") && !isFlagship(m)) return false
      if (filters.includes("vision") && !isVisionModel(m)) return false
      if (filters.includes("context") && (m.context_length ?? 0) < 100_000)
        return false
      if (!q) return true
      const hay = `${m.id} ${m.name} ${providerLabel(providerOf(m))}`.toLowerCase()
      return hay.includes(q)
    })
  }, [models, filters, search])

  const toggleModel = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id))
      return
    }
    if (selectedIds.length >= MAX_MODELS) {
      toast.error(`You can compare up to ${MAX_MODELS} models at once`)
      return
    }
    onChange([...selectedIds, id])
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Quick filter chips */}
      <ToggleGroup
        value={filters}
        onValueChange={(v) => setFilters(v as string[])}
        toggleMultiple
        spacing={2}
        className="flex-wrap"
      >
        {FILTERS.map(({ key, label, icon: Icon }) => (
          <ToggleGroupItem
            key={key}
            value={key}
            variant="outline"
            size="sm"
            className="data-pressed:border-primary/40 data-pressed:bg-primary/10 data-pressed:text-primary"
          >
            <Icon data-icon="inline-start" />
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* Selected + add trigger */}
      <div className="flex flex-wrap items-center gap-2">
        {selectedIds.map((id, idx) => {
          const m = modelById.get(id)
          const slug = m ? providerOf(m) : id.split("/")[0]
          return (
            <Badge
              key={id}
              variant="outline"
              className="h-7 gap-1.5 border-border bg-surface pr-1 pl-1.5"
            >
              <span className="grid size-4 place-items-center rounded bg-primary/15 font-mono text-[9px] font-semibold text-primary">
                {String.fromCharCode(65 + idx)}
              </span>
              <ProviderBadge slug={slug} className="size-4" />
              <span className="max-w-40 truncate font-medium">
                {m?.name ?? id}
              </span>
              <button
                type="button"
                onClick={() => toggleModel(id)}
                className="ml-0.5 grid size-4 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${m?.name ?? id}`}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          )
        })}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                className="gap-1.5 border-dashed"
              >
                <PlusIcon data-icon="inline-start" />
                {selectedIds.length === 0 ? "Select models" : "Add model"}
                <ChevronsUpDownIcon
                  data-icon="inline-end"
                  className="opacity-50"
                />
              </Button>
            }
          />
          <PopoverContent
            align="start"
            className="w-[min(92vw,26rem)] p-0"
          >
            <Command shouldFilter={false}>
              <CommandInput
                value={search}
                onValueChange={setSearch}
                placeholder="Search model, provider, context..."
              />
              <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground">
                <span>
                  {filtered.length} model{filtered.length === 1 ? "" : "s"}
                </span>
                <span>
                  {selectedIds.length}/{MAX_MODELS} selected
                </span>
              </div>
              <CommandList className="max-h-80">
                <CommandEmpty>
                  {loading ? "Loading models…" : "No models match."}
                </CommandEmpty>
                {filtered.slice(0, 200).map((m) => {
                  const active = selectedIds.includes(m.id)
                  const slug = providerOf(m)
                  return (
                    <CommandItem
                      key={m.id}
                      value={m.id}
                      onSelect={() => toggleModel(m.id)}
                      className="items-start gap-2 py-2"
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-4 shrink-0 place-items-center rounded border",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border",
                        )}
                      >
                        {active && <CheckIcon className="size-3" />}
                      </span>
                      <ProviderBadge slug={slug} className="mt-0.5" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-medium text-foreground">
                          {m.name}
                        </span>
                        <span className="truncate font-mono text-[11px] text-muted-foreground">
                          {m.id}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5 text-[10px] text-muted-foreground">
                        <span className="rounded bg-muted px-1 py-0.5 font-mono">
                          {formatContext(m.context_length)} ctx
                        </span>
                        <span className="font-mono">
                          {isFreeModel(m)
                            ? "Free"
                            : `${pricePerMillion(m.pricing?.prompt)}/M`}
                        </span>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectedIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange([])}
            className="text-muted-foreground"
          >
            Clear all
          </Button>
        )}
      </div>
    </div>
  )
}
