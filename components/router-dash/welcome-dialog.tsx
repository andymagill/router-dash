"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { cn } from "@/lib/utils"

export function WelcomeDialog() {
  const [accepted, setAccepted, hydrated] = useLocalStorage(
    "routerdash:termsAccepted",
    false,
  )
  const [open, setOpen] = React.useState(false)
  const [checkboxChecked, setCheckboxChecked] = React.useState(false)

  React.useEffect(() => {
    if (hydrated && !accepted) {
      setOpen(true)
    }
  }, [hydrated, accepted])

  const handleOpenChange = (nextOpen: boolean) => {
    // Prevent dismissal until terms are accepted
    if (!nextOpen && !checkboxChecked) {
      return
    }
    setOpen(nextOpen)
  }

  const handleAccept = () => {
    if (checkboxChecked) {
      setAccepted(true)
      setOpen(false)
      setCheckboxChecked(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Welcome to RouterDash</DialogTitle>
          <DialogDescription className="pt-2">
            RouterDash is a high-density developer playground to test and
            compare LLM models side by side via the OpenRouter API. Run parallel
            benchmarks, compare latency, token usage, and costs across
            models—all in your browser.
            <br />
            <br />
            Your API keys stay safe: they&apos;re stored only in your browser
            and sent directly to providers. We never store them on our servers
            or include them in shared or exported results.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3">
            <input
              id="terms-check"
              type="checkbox"
              checked={checkboxChecked}
              onChange={(e) => setCheckboxChecked(e.target.checked)}
              className={cn(
                "mt-1 size-4 rounded border border-input cursor-pointer",
                "bg-background appearance-none",
                "checked:bg-primary checked:border-primary",
                "transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              )}
            />
            <label htmlFor="terms-check" className="text-sm text-muted-foreground cursor-pointer">
              I have read and agree to the{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Terms &amp; Conditions
              </a>
            </label>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            onClick={handleAccept}
            disabled={!checkboxChecked}
            className="gap-1.5"
          >
            <CheckIcon className="size-4" />
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
