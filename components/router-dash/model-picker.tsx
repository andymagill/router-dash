"use client"

import * as React from "react"
import { PlusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ProviderBadge,
  ProviderTag,
} from "@/components/router-dash/provider-badge"
import {
  ModelDialog,
  MAX_MODELS,
  type ProviderState,
} from "@/components/router-dash/model-dialog"
import { type UnifiedModel, type ProviderId } from "@/lib/providers"

export { MAX_MODELS }
export type { ProviderState }

interface ModelPickerProps {
  models: UnifiedModel[]
  providerStates: Record<ProviderId, ProviderState>
  selectedKeys: string[]
  onChange: (keys: string[]) => void
  onRefresh: (provider: ProviderId) => void
}

/**
 * Page-level model panel: the selected chips plus the button that opens the
 * browsing dialog. All filtering, searching and the model table live in
 * `ModelDialog`.
 */
export function ModelPicker({
  models,
  providerStates,
  selectedKeys,
  onChange,
  onRefresh,
}: ModelPickerProps) {
  const [open, setOpen] = React.useState(false)

  const modelByKey = React.useMemo(() => {
    const map = new Map<string, UnifiedModel>()
    for (const m of models) map.set(m.key, m)
    return map
  }, [models])

  const removeModel = (key: string) => {
    onChange(selectedKeys.filter((s) => s !== key))
  }

  return (
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
            <ProviderBadge slug={m?.vendor ?? fallbackVendor} className="size-4" />
            <span className="max-w-40 truncate font-medium">
              {m?.name ?? fallbackVendor}
            </span>
            {m && <ProviderTag provider={m.provider} />}
            <button
              type="button"
              onClick={() => removeModel(key)}
              className="ml-0.5 grid size-4 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Remove ${m?.name ?? fallbackVendor}`}
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

      <ModelDialog
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
