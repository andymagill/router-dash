"use client"

import * as React from "react"
import Link from "next/link"
import { CheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
        disableOverlayDismiss
        className="max-w-full sm:max-w-[420px] p-0 gap-0 rounded-2xl overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-40 w-full overflow-hidden bg-zinc-900 shrink-0">
          <img
            src="https://images.unsplash.com/photo-1519501025264-65ba15a82390?q=80&w=1000&auto=format&fit=crop"
            alt="Cityscape Banner"
            className="absolute inset-0 w-full h-full object-cover opacity-85 filter contrast-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-popover via-popover/30 to-transparent"></div>
          <div className="absolute bottom-1 left-4 right-4 z-10">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-orange-400 uppercase bg-black/70 rounded border border-orange-500/30 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
              LLM Playground
            </span>
            <DialogTitle className="text-xl font-bold text-white tracking-tight">
              Welcome to <em>Router<span className="text-primary">Dash</span></em>
            </DialogTitle>
          </div>
        </div>

        <div className="px-5 pt-4 pb-5 flex flex-col justify-between overflow-y-auto space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Getting Started</h3>
            <DialogDescription className="text-xs">
              RouterDash is a benchmarking playground to test and compare LLM models side by side. 
              To continue, please acknowledge that you understand and accept full responsibility for any costs, 
              fees, and liabilities incurred while using RouterDash. Read <Link
                  href="/terms"
                  className="underline hover:text-foreground transition-colors"
                >
                   terms and conditions</Link> for more information. 
            </DialogDescription>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <input
                id="terms-check"
                type="checkbox"
                checked={checkboxChecked}
                onChange={(e) => setCheckboxChecked(e.target.checked)}
                className={cn(
                  "mt-0.5 size-4 rounded border border-input cursor-pointer",
                  "bg-input appearance-none",
                  "checked:bg-primary checked:border-primary",
                  "transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                )}
              />
              <label htmlFor="terms-check" className="text-xs text-muted-foreground cursor-pointer group select-none">
                I have read and accept the terms and conditions.{" "}
              </label>
            </div>

            <Button
              onClick={handleAccept}
              disabled={!checkboxChecked}
              className="w-full"
            >
              <CheckIcon className="size-4" />
              Agree &amp; Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
