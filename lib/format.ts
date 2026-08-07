export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n))
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n)
}

/** Format a USD cost, keeping enough precision for tiny per-request amounts. */
export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00"
  if (usd < 0.0001) return "<$0.0001"
  if (usd < 0.01) return `$${usd.toFixed(5)}`
  if (usd < 1) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function formatContext(len: number | undefined): string {
  if (!len) return "—"
  if (len >= 1000) return `${Math.round(len / 1000)}k`
  return String(len)
}

/** Short "time ago" label, e.g. "just now", "4m ago", "2h ago", "Mar 3". */
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.round(diff / 1000)
  if (sec < 45) return "just now"
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

/** Per-million-token price label from OpenRouter per-token pricing string. */
export function pricePerMillion(perToken: string | undefined): string {
  const v = Number(perToken)
  if (!perToken || Number.isNaN(v)) return "—"
  if (v === 0) return "Free"
  return `$${(v * 1_000_000).toFixed(2)}`
}
