"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { defaultPromptName } from "@/lib/prompt-library"

interface SavePromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt: string
  onSave: (input: { label: string; description: string }) => void
}

export function SavePromptDialog({
  open,
  onOpenChange,
  prompt,
  onSave,
}: SavePromptDialogProps) {
  const [label, setLabel] = React.useState("")
  const [description, setDescription] = React.useState("")

  // Reset to a fresh default each time the dialog opens rather than carrying
  // over whatever was typed the last time it was cancelled.
  React.useEffect(() => {
    if (open) {
      setLabel(defaultPromptName(prompt))
      setDescription("")
    }
  }, [open, prompt])

  const trimmedLabel = label.trim()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmedLabel) return
    onSave({ label: trimmedLabel, description: description.trim() })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Save prompt</DialogTitle>
            <DialogDescription>
              Saves the prompt, system prompt, and generation params to your
              library.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="save-prompt-name">Name</Label>
              <Input
                id="save-prompt-name"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Eval harness v2"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="save-prompt-description">
                Description{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="save-prompt-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this prompt is for"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!trimmedLabel}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
