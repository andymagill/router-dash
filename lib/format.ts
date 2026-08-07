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

/** Per-million-token price label from OpenRouter per-token pricing string. */
export function pricePerMillion(perToken: string | undefined): string {
  const v = Number(perToken)
  if (!perToken || Number.isNaN(v)) return "—"
  if (v === 0) return "Free"
  return `$${(v * 1_000_000).toFixed(2)}`
}
