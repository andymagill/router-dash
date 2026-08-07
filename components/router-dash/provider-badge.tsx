import { cn } from "@/lib/utils"
import { providerLabel } from "@/lib/openrouter"

const PROVIDER_COLORS: Record<string, string> = {
  openai: "bg-[oklch(0.7_0.14_155)]/15 text-[oklch(0.7_0.14_155)]",
  anthropic: "bg-[oklch(0.72_0.13_45)]/15 text-[oklch(0.72_0.13_45)]",
  google: "bg-[oklch(0.68_0.15_255)]/15 text-[oklch(0.68_0.15_255)]",
  "meta-llama": "bg-[oklch(0.66_0.16_265)]/15 text-[oklch(0.66_0.16_265)]",
  meta: "bg-[oklch(0.66_0.16_265)]/15 text-[oklch(0.66_0.16_265)]",
  mistralai: "bg-[oklch(0.72_0.16_45)]/15 text-[oklch(0.72_0.16_45)]",
  "x-ai": "bg-foreground/10 text-foreground",
  deepseek: "bg-[oklch(0.68_0.15_255)]/15 text-[oklch(0.68_0.15_255)]",
  qwen: "bg-[oklch(0.66_0.18_300)]/15 text-[oklch(0.66_0.18_300)]",
  cohere: "bg-[oklch(0.7_0.15_330)]/15 text-[oklch(0.7_0.15_330)]",
}

export function ProviderBadge({
  slug,
  className,
}: {
  slug: string
  className?: string
}) {
  const label = providerLabel(slug)
  const color =
    PROVIDER_COLORS[slug] ?? "bg-primary/15 text-primary"
  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-semibold uppercase",
        color,
        className,
      )}
      title={label}
      aria-hidden
    >
      {label.slice(0, 2)}
    </span>
  )
}
