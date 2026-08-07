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

export function ApiKeyDialog({
  apiKey,
  onSave,
  onClear,
}: {
  apiKey: string
  onSave: (key: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const [reveal, setReveal] = React.useState(false)
  const connected = apiKey.trim().length > 0

  React.useEffect(() => {
    if (open) {
      setDraft(apiKey)
      setReveal(false)
    }
  }, [open, apiKey])

  const save = () => {
    if (!draft.trim()) {
      toast.error("Enter a valid OpenRouter API key")
      return
    }
    onSave(draft.trim())
    toast.success("API key saved to this browser")
    setOpen(false)
  }

  const clear = () => {
    onClear()
    setDraft("")
    toast.message("API key cleared")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <KeyRoundIcon data-icon="inline-start" />
            {connected ? (
              <Badge
                variant="secondary"
                className="bg-[color:var(--ok)]/15 text-[color:var(--ok)]"
              >
                <CheckCircle2Icon data-icon="inline-start" />
                Connected
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-[color:var(--warn)]/15 text-[color:var(--warn)]"
              >
                <AlertTriangleIcon data-icon="inline-start" />
                Missing Key
              </Badge>
            )}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4 text-primary" />
            OpenRouter API Key
          </DialogTitle>
          <DialogDescription>
            Your key is stored only in this browser&apos;s localStorage and sent
            directly to OpenRouter. It never touches our servers.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="relative">
            <Input
              type={reveal ? "text" : "password"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="sk-or-v1-..."
              autoComplete="off"
              spellCheck={false}
              className="pr-9 font-mono text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) save()
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
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline"
          >
            Get a key from openrouter.ai/keys
            <ExternalLinkIcon className="size-3" />
          </a>
        </div>

        <DialogFooter>
          {connected && (
            <Button
              variant="destructive"
              size="sm"
              onClick={clear}
              className="gap-1.5 sm:mr-auto"
            >
              <Trash2Icon data-icon="inline-start" />
              Clear / Disconnect
            </Button>
          )}
          <DialogClose render={<Button variant="outline" size="sm" />}>
            Cancel
          </DialogClose>
          <Button size="sm" onClick={save}>
            Save key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
