"use client"

import * as React from "react"
import {
  PlusIcon,
  XIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  GiftIcon,
  GaugeIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
  KeyRoundIcon,
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
import {
  ProviderBadge,
  ProviderTag,
} from "@/components/router-dash/provider-badge"
import { formatContext, pricePerMillion } from "@/lib/format"
import { useLocalStorage } from "@/hooks/use-local-storage"
import {
  type UnifiedModel,
  type ProviderId,
  PROVIDER_ORDER,
  ADAPTERS,
  isLongContext,
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

type MetaFilter = "free" | "long"

const LONG_CONTEXT_LABEL = `Long context (\u2265${LONG_CONTEXT_THRESHOLD / 1000}K)`

interface ModelPickerProps {
  models: UnifiedModel[]
  providerStates: Record<ProviderId, ProviderState>
  selectedKeys: string[]
  onChange: (keys: string[]) => void
  onRefresh: (provider: ProviderId) => void
  onOpenKeys: () => void
}

export function ModelPicker({
  models,
  providerStates,
  selectedKeys,
  onChange,
  onRefresh,
  onOpenKeys,
}: ModelPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [providerFilters, setProviderFilters] = useLocalStorage<ProviderId[]>(
    "routerdash:providerFilters",
    [],
  )
  const [metaFilters, setMetaFilters] = useLocalStorage<MetaFilter[]>(
    "routerdash:metaFilters",
    [],
  )

  const modelByKey = React.useMemo(() => {
    const map = new Map<string, UnifiedModel>()
    for (const m of models) map.set(m.key, m)
    return map
  }, [models])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return models.filter((m) => {
      if (providerFilters.length > 0 && !providerFilters.includes(m.provider)) {
        return false
      }
      if (metaFilters.includes("free") && !m.isFree) return false
      if (metaFilters.includes("long") && !isLongContext(m)) return false
      if (!q) return true
      const hay =
        `${m.modelId} ${m.name} ${m.owner ?? ""} ${ADAPTERS[m.provider].label}`.toLowerCase()
      return hay.includes(q)
    })
  }, [models, providerFilters, metaFilters, search])

  // Group the filtered list by provider so the dropdown reads clearly.
  const groups = React.useMemo(() => {
    const byProvider = new Map<ProviderId, UnifiedModel[]>()
    for (const p of PROVIDER_ORDER) byProvider.set(p, [])
    for (const m of filtered) byProvider.get(m.provider)?.push(m)
    return PROVIDER_ORDER.map((provider) => ({
      provider,
      models: (byProvider.get(provider) ?? []).slice(0, 150),
    }))
  }, [filtered])

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

  const anyLoading = PROVIDER_ORDER.some((p) => providerStates[p].loading)

  return (
    <div className="flex flex-col gap-3">
      {/* Quick filters: provider + cross-provider metadata */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Provider
          </span>
          <ToggleGroup
            value={providerFilters}
            onValueChange={(v) => setProviderFilters(v as ProviderId[])}
            spacing={2}
          >
            {PROVIDER_ORDER.map((p) => (
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
          </ToggleGroup>
        </div>
      </div>

      {/* Selected model chips + add trigger */}
      <div className="flex flex-wrap items-center gap-2">
        {selectedKeys.map((key, idx) => {
          const m = modelByKey.get(key)
          const fallbackVendor = key.split(":").pop()?.split("/")[0] ?? key
          return (
            <Badge
              key={key}
              variant="outline"
              className="h-7 gap-1.5 border-border bg-surface pr-1 pl-1.5"
            >
              <span className="grid size-4 place-items-center rounded bg-primary/15 font-mono text-[9px] font-semibold text-primary">
                {String.fromCharCode(65 + idx)}
              </span>
              <ProviderBadge
                slug={m?.vendor ?? fallbackVendor}
                className="size-4"
              />
              <span className="max-w-40 truncate font-medium">
                {m?.name ?? fallbackVendor}
              </span>
              {m && <ProviderTag provider={m.provider} />}
              <button
                type="button"
                onClick={() => toggleModel(key)}
                className="ml-0.5 grid size-4 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${m?.name ?? fallbackVendor}`}
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
                className="gap-1.5 border-dashed"
              >
                <PlusIcon data-icon="inline-start" />
                {selectedKeys.length === 0 ? "Select models" : "Add model"}
                <ChevronsUpDownIcon
                  data-icon="inline-end"
                  className="opacity-50"
                />
              </Button>
            }
          />
          <PopoverContent align="start" className="w-[min(92vw,28rem)] p-0">
            <Command shouldFilter={false}>
              <CommandInput
                value={search}
                onValueChange={setSearch}
                placeholder="Search model, provider, owner..."
              />
              <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground">
                <span>
                  {filtered.length} model{filtered.length === 1 ? "" : "s"}
                </span>
                <span>
                  {selectedKeys.length}/{MAX_MODELS} selected
                </span>
              </div>
              <CommandList className="max-h-80">
                <CommandEmpty>
                  {anyLoading ? "Loading models…" : "No models match."}
                </CommandEmpty>
                {groups.map((g) => {
                  const state = providerStates[g.provider]
                  const needsKey =
                    ADAPTERS[g.provider].requiresKeyForCatalog &&
                    !state.connected
                  // Only render a section when it has content or something to say.
                  if (
                    g.models.length === 0 &&
                    !state.loading &&
                    !state.error &&
                    !needsKey
                  ) {
                    return null
                  }
                  return (
                    <div key={g.provider} className="pb-1">
                      <div className="flex items-center justify-between px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <ProviderTag provider={g.provider} />
                          <span className="text-[11px] text-muted-foreground">
                            {state.loading
                              ? "loading…"
                              : `${g.models.length} shown`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRefresh(g.provider)}
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

                      {needsKey && (
                        <button
                          type="button"
                          onClick={onOpenKeys}
                          className="mx-2 mb-1 flex w-[calc(100%-1rem)] items-center gap-2 rounded border border-dashed border-border px-2 py-2 text-left text-[11px] text-muted-foreground hover:bg-muted"
                        >
                          <KeyRoundIcon className="size-3.5 shrink-0" />
                          Add your {ADAPTERS[g.provider].label} key to load its
                          catalog
                        </button>
                      )}

                      {state.error && (
                        <div className="mx-2 mb-1 flex items-start gap-1.5 rounded border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
                          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                          <span>{state.error}</span>
                        </div>
                      )}

                      {g.models.map((m) => {
                        const active = selectedKeys.includes(m.key)
                        return (
                          <CommandItem
                            key={m.key}
                            value={m.key}
                            onSelect={() => toggleModel(m.key)}
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
                            <ProviderBadge slug={m.vendor} className="mt-0.5" />
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="flex items-center gap-1.5 truncate text-[13px] font-medium text-foreground">
                                {m.name}
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
                              </span>
                              <span className="truncate font-mono text-[11px] text-muted-foreground">
                                {m.modelId}
                              </span>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-0.5 text-[10px] text-muted-foreground">
                              <span className="rounded bg-muted px-1 py-0.5 font-mono">
                                {m.contextKnown
                                  ? `${formatContext(m.contextLength ?? 0)} ctx`
                                  : "ctx n/a"}
                              </span>
                              <span className="font-mono">
                                {m.isFree
                                  ? "Free"
                                  : m.pricingKnown
                                    ? `${pricePerMillion(m.promptPrice)}/M`
                                    : "price n/a"}
                              </span>
                            </div>
                          </CommandItem>
                        )
                      })}
                    </div>
                  )
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

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
      </div>
    </div>
  )
}
