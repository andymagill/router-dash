"use client"

import * as React from "react"
import {
  KeyRoundIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  ExternalLinkIcon,
  Trash2Icon,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ADAPTERS, PROVIDER_ORDER, type ProviderId } from "@/lib/providers"

type KeyMap = Record<ProviderId, string>

function ProviderKeyField({
  provider,
  draft,
  onDraftChange,
  onClear,
  onSubmit,
}: {
  provider: ProviderId
  draft: string
  onDraftChange: (value: string) => void
  onClear: () => void
  onSubmit: () => void
}) {
  const adapter = ADAPTERS[provider]
  const [reveal, setReveal] = React.useState(false)
  const connected = draft.trim().length > 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {adapter.label}
          {connected && (
            <span
              className="size-1.5 rounded-full bg-[color:var(--ok)]"
              aria-hidden
            />
          )}
        </span>
        {connected && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
          >
            <Trash2Icon className="size-3" />
            Clear
          </button>
        )}
      </div>
      <div className="relative">
        <Input
          type={reveal ? "text" : "password"}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder={adapter.keyPlaceholder}
          autoComplete="off"
          spellCheck={false}
          className="pr-9 font-mono text-sm"
          aria-label={`${adapter.label} API key`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) onSubmit()
          }}
        />
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={reveal ? "Hide key" : "Show key"}
        >
          {reveal ? (
            <EyeOffIcon className="size-4" />
          ) : (
            <EyeIcon className="size-4" />
          )}
        </button>
      </div>
      <a
        href={adapter.keyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline"
      >
        {adapter.keyHint}
        <ExternalLinkIcon className="size-3" />
      </a>
    </div>
  )
}

export function ApiKeyDialog({
  keys,
  onSave,
  onClear,
}: {
  keys: KeyMap
  onSave: (provider: ProviderId, key: string) => void
  onClear: (provider: ProviderId) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [drafts, setDrafts] = React.useState<KeyMap>(keys)

  React.useEffect(() => {
    if (open) setDrafts(keys)
  }, [open, keys])

  const connectedCount = PROVIDER_ORDER.filter((p) =>
    keys[p]?.trim(),
  ).length

  const save = () => {
    let changed = false
    for (const p of PROVIDER_ORDER) {
      const next = drafts[p]?.trim() ?? ""
      if (next !== (keys[p]?.trim() ?? "")) {
        onSave(p, next)
        changed = true
      }
    }
    if (changed) toast.success("API keys saved to this browser")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            data-api-key-trigger
          >
            <KeyRoundIcon data-icon="inline-start" />
            {connectedCount > 0 ? (
              <Badge
                variant="secondary"
                className="bg-[color:var(--ok)]/15 text-[color:var(--ok)]"
              >
                <CheckCircle2Icon data-icon="inline-start" />
                {connectedCount === PROVIDER_ORDER.length
                  ? "All keys"
                  : `${connectedCount} key${connectedCount === 1 ? "" : "s"}`}
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-[color:var(--warn)]/15 text-[color:var(--warn)]"
              >
                <AlertTriangleIcon data-icon="inline-start" />
                No keys
              </Badge>
            )}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4 text-primary" />
            Provider API Keys
          </DialogTitle>
          <DialogDescription>
            Keys are stored only in this browser&apos;s localStorage and sent
            directly to each provider. They never touch our servers, and are
            never included in saved, shared, or exported benchmarks. Add a key
            only for the providers you want to use.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {PROVIDER_ORDER.map((p, i) => (
            <React.Fragment key={p}>
              {i > 0 && <Separator />}
              <ProviderKeyField
                provider={p}
                draft={drafts[p] ?? ""}
                onDraftChange={(value) =>
                  setDrafts((prev) => ({ ...prev, [p]: value }))
                }
                onClear={() => {
                  setDrafts((prev) => ({ ...prev, [p]: "" }))
                  onClear(p)
                  toast.message(`${ADAPTERS[p].label} key cleared`)
                }}
                onSubmit={save}
              />
            </React.Fragment>
          ))}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" />}>
            Cancel
          </DialogClose>
          <Button size="sm" onClick={save}>
            Save keys
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
