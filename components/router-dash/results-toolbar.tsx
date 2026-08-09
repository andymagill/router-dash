"use client"

import * as React from "react"
import {
  Share2Icon,
  DownloadIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  CheckIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"

/** Helper text shown near every sharing affordance. */
export const SHARE_HELPER_TEXT =
  "Shared links include benchmark settings, prompt, and results. They never include your API key."

export function ResultsToolbar({
  onShare,
  onExportJson,
  onExportCsv,
}: {
  onShare: () => void
  onExportJson: () => void
  onExportCsv: () => void
}) {
  const [copied, setCopied] = React.useState(false)

  const handleShare = () => {
    onShare()
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleShare}
        >
          {copied ? (
            <CheckIcon
              data-icon="inline-start"
              className="text-[color:var(--ok)]"
            />
          ) : (
            <Share2Icon data-icon="inline-start" />
          )}
          {copied ? "Link copied" : "Copy share link"}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="gap-1.5">
                <DownloadIcon data-icon="inline-start" />
                Export
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onExportJson} className="gap-2">
                <FileJsonIcon className="size-4" />
                <div className="flex flex-col">
                  <span>Export JSON</span>
                  <span className="text-[10px] text-muted-foreground">
                    Full runs with responses
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportCsv} className="gap-2">
                <FileSpreadsheetIcon className="size-4" />
                <div className="flex flex-col">
                  <span>Export CSV</span>
                  <span className="text-[10px] text-muted-foreground">
                    Summary, no response bodies
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <p className="ml-auto max-w-md text-pretty text-[10px] leading-tight text-muted-foreground">
          {SHARE_HELPER_TEXT}
        </p>
      </div>
    </div>
  )
}
