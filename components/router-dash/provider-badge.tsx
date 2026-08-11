import { cn } from "@/lib/utils"
import { providerLabel } from "@/lib/openrouter"
import { ADAPTERS, type ProviderId } from "@/lib/providers"

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

const PROVIDER_TAG_COLORS: Record<ProviderId, string> = {
  openrouter: "bg-primary/12 text-primary",
  groq: "bg-[oklch(0.72_0.16_45)]/15 text-[oklch(0.72_0.16_45)]",
}

/** A small pill naming the routing provider (OpenRouter / Groq). */
export function ProviderTag({
  provider,
  className,
}: {
  provider: ProviderId
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-4 items-center rounded px-1 text-[9px] font-semibold tracking-wide uppercase",
        PROVIDER_TAG_COLORS[provider],
        className,
      )}
    >
      {ADAPTERS[provider].label}
    </span>
  )
}
