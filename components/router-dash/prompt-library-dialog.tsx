"use client"

import * as React from "react"
import { SearchIcon, Trash2Icon, XIcon } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import { PROMPT_PRESETS, type PromptPreset } from "@/lib/presets"
import { filterLibrary, type SavedPrompt } from "@/lib/prompt-library"

interface PromptLibraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  savedPrompts: SavedPrompt[]
  onLoad: (item: PromptPreset | SavedPrompt) => void
  onDelete: (id: string) => void
}

/**
 * Horizontal card: title + description share one left-aligned row on
 * desktop (a middle dot between them), stacking on mobile where a row is
 * too narrow for both plus the prompt snippet beneath.
 */
function Row({
  item,
  onLoad,
  onDelete,
}: {
  item: PromptPreset | SavedPrompt
  onLoad: () => void
  onDelete?: () => void
}) {
  return (
    <div className="group flex items-stretch gap-1 rounded-lg border border-border bg-card/40 transition-colors hover:border-primary/40 hover:bg-muted/40">
      <button
        type="button"
        onClick={onLoad}
        className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg px-3.5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <div className="flex flex-col gap-x-2 gap-y-0.5 sm:flex-row sm:items-baseline">
          <span className="font-medium">{item.label}</span>
          {item.description && (
            <span className="flex items-baseline gap-2 text-[11px] text-muted-foreground sm:min-w-0">
              <span className="hidden text-muted-foreground/40 sm:inline">
                ·
              </span>
              <span className="truncate">{item.description}</span>
            </span>
          )}
        </div>
        <span className="line-clamp-2 font-mono text-[11px] text-muted-foreground/70">
          {item.prompt}
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label={`Delete ${item.label}`}
          className="mr-2 grid shrink-0 place-items-center self-center rounded px-1.5 py-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2Icon className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/**
 * Each group gets its own sticky, uppercase header with a bottom rule, and
 * groups are separated by a full-width divider — distinct bands instead of
 * a continuous list.
 */
function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="sticky top-0 z-10 border-b border-border/70 bg-popover px-4 py-2">
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </span>
        <span className="ml-1.5 text-[11px] text-muted-foreground/50">
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-3">{children}</div>
    </div>
  )
}

export function PromptLibraryDialog({
  open,
  onOpenChange,
  savedPrompts,
  onLoad,
  onDelete,
}: PromptLibraryDialogProps) {
  const [search, setSearch] = React.useState("")

  React.useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  const filteredSaved = React.useMemo(
    () => filterLibrary(savedPrompts, search),
    [savedPrompts, search],
  )
  const filteredPresets = React.useMemo(
    () => filterLibrary(PROMPT_PRESETS, search),
    [search],
  )

  const handleLoad = (item: PromptPreset | SavedPrompt) => {
    onLoad(item)
    onOpenChange(false)
  }

  const isEmpty = filteredSaved.length === 0 && filteredPresets.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="shrink-0 border-b border-border">
          <DialogHeader className="gap-1 p-4 pb-3">
            <DialogTitle>Prompt library</DialogTitle>
            <DialogDescription>
              Load a saved prompt or a built-in preset.
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
                placeholder="Search prompts..."
                aria-label="Search prompts"
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

        <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
          {isEmpty ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {search
                ? `No prompts match "${search}".`
                : "No saved prompts yet — write a prompt and hit Save."}
            </div>
          ) : (
            <>
              {(filteredSaved.length > 0 || !search) && (
                <Section title="My prompts" count={filteredSaved.length}>
                  {filteredSaved.length === 0 ? (
                    <p className="px-0.5 py-1 text-[12px] text-muted-foreground">
                      No saved prompts yet.
                    </p>
                  ) : (
                    filteredSaved.map((item) => (
                      <Row
                        key={item.id}
                        item={item}
                        onLoad={() => handleLoad(item)}
                        onDelete={() => onDelete(item.id)}
                      />
                    ))
                  )}
                </Section>
              )}

              {filteredPresets.length > 0 && (
                <Section title="Presets" count={filteredPresets.length}>
                  {filteredPresets.map((item) => (
                    <Row
                      key={item.id}
                      item={item}
                      onLoad={() => handleLoad(item)}
                    />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-t-none">
          <DialogClose render={<Button size="sm" variant="outline" />}>
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
