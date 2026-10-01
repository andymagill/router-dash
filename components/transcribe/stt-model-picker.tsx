"use client"

import * as React from "react"
import {
  CheckIcon,
  Loader2Icon,
  PlusIcon,
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
  DialogContent,
  DialogDescription,
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
  ProviderBadge,
  ProviderTag,
} from "@/components/router-dash/provider-badge"
import type { ProviderState } from "@/components/router-dash/model-picker"
import { ADAPTERS, type UnifiedModel } from "@/lib/providers"
import {
  MAX_STT_MODELS,
  STT_PROVIDER_ORDER,
  type SttProviderId,
} from "@/lib/transcription"
import { resolveSttModel } from "@/lib/transcription/models"

interface SttModelPickerProps {
  models: UnifiedModel[]
  modelByKey: Map<string, UnifiedModel>
  providerStates: Record<SttProviderId, ProviderState>
  selectedKeys: string[]
  onChange: (keys: string[]) => void
  onRefresh: (provider: SttProviderId) => void
}

/** Selected-model chips plus the button that opens the browsing dialog. */
export function SttModelPicker({
  models,
  modelByKey,
  providerStates,
  selectedKeys,
  onChange,
  onRefresh,
}: SttModelPickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedKeys.map((key, idx) => {
        const m = resolveSttModel(key, modelByKey)
        return (
          <Badge
            key={key}
            variant="outline"
            className="h-7 gap-1.5 border-border bg-surface pr-1 pl-1.5"
          >
            <span className="grid size-4 place-items-center rounded bg-primary/15 font-mono text-[9px] font-semibold text-primary">
              {String.fromCharCode(65 + idx)}
            </span>
            <ProviderBadge slug={m.vendor} className="size-4" />
            <span className="max-w-40 truncate font-medium">{m.name}</span>
            <ProviderTag provider={m.provider} />
            <button
              type="button"
              onClick={() => onChange(selectedKeys.filter((s) => s !== key))}
              className="ml-0.5 grid size-4 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Remove ${m.name}`}
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        )
      })}

      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 border-dashed"
      >
        <PlusIcon data-icon="inline-start" />
        {selectedKeys.length === 0 ? "Select models" : "Add model"}
      </Button>

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

      <SttModelDialog
        open={open}
        onOpenChange={setOpen}
        models={models}
        providerStates={providerStates}
        selectedKeys={selectedKeys}
        onChange={onChange}
        onRefresh={onRefresh}
      />
    </div>
  )
}

function SttModelDialog({
  open,
  onOpenChange,
  models,
  providerStates,
  selectedKeys,
  onChange,
  onRefresh,
}: Omit<SttModelPickerProps, "modelByKey"> & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [search, setSearch] = React.useState("")

  const toggle = (key: string) => {
    if (selectedKeys.includes(key)) {
      onChange(selectedKeys.filter((s) => s !== key))
      return
    }
    if (selectedKeys.length >= MAX_STT_MODELS) {
      toast.error(`You can compare up to ${MAX_STT_MODELS} models at once`)
      return
    }
    onChange([...selectedKeys, key])
  }

  const query = search.trim().toLowerCase()
  const matches = (m: UnifiedModel) =>
    !query ||
    m.name.toLowerCase().includes(query) ||
    m.modelId.toLowerCase().includes(query) ||
    m.vendor.toLowerCase().includes(query)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="shrink-0 border-b border-border">
          <DialogHeader className="gap-1 p-4 pb-3">
            <DialogTitle>Select transcription models</DialogTitle>
            <DialogDescription>
              Compare up to {MAX_STT_MODELS} models. Groq runs Whisper;
              OpenRouter lists chat models that accept audio.
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 pb-3">
            <InputGroup className="h-9">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                aria-label="Search transcription models"
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
          </div>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          {STT_PROVIDER_ORDER.map((provider) => {
            const state = providerStates[provider]
            const adapter = ADAPTERS[provider]
            const rows = models.filter(
              (m) => m.provider === provider && matches(m),
            )
            const needsKey = adapter.requiresKeyForCatalog && !state.connected
            return (
              <section key={provider} className="border-b border-border/60 last:border-b-0">
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-popover px-4 py-2 shadow-[inset_0_-1px_0_var(--border)]">
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    {adapter.label}
                    <span className="font-mono text-[10px] font-normal text-muted-foreground">
                      {state.count}
                    </span>
                  </span>
                  {!needsKey && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRefresh(provider)}
                      disabled={state.loading}
                      aria-label={`Refresh ${adapter.label} models`}
                      className="text-muted-foreground"
                    >
                      <RefreshCwIcon
                        className={cn("size-3.5", state.loading && "animate-spin")}
                      />
                    </Button>
                  )}
                </div>

                {needsKey ? (
                  <p className="px-4 pb-3 text-xs text-muted-foreground">
                    Add your {adapter.label} key (Keys button, top right) to list
                    its transcription models.
                  </p>
                ) : state.loading && rows.length === 0 ? (
                  <p className="flex items-center gap-2 px-4 pb-3 text-xs text-muted-foreground">
                    <Loader2Icon className="size-3.5 animate-spin" />
                    Loading models…
                  </p>
                ) : state.error ? (
                  <p className="flex items-start gap-2 px-4 pb-3 text-xs text-destructive">
                    <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                    {state.error}
                  </p>
                ) : rows.length === 0 ? (
                  <p className="px-4 pb-3 text-xs text-muted-foreground">
                    {query
                      ? "No matching models."
                      : "No transcription models found."}
                  </p>
                ) : (
                  <ul className="pb-1">
                    {rows.map((m) => {
                      const selected = selectedKeys.includes(m.key)
                      return (
                        <li key={m.key}>
                          <button
                            type="button"
                            onClick={() => toggle(m.key)}
                            aria-pressed={selected}
                            className={cn(
                              "flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] transition-colors hover:bg-accent/50",
                              selected && "bg-primary/5",
                            )}
                          >
                            <span
                              className={cn(
                                "grid size-4 shrink-0 place-items-center rounded border",
                                selected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border",
                              )}
                            >
                              {selected && <CheckIcon className="size-3" />}
                            </span>
                            <ProviderBadge slug={m.vendor} className="size-5" />
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {m.name}
                            </span>
                            <span className="hidden max-w-48 truncate font-mono text-[11px] text-muted-foreground sm:inline">
                              {m.modelId}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
