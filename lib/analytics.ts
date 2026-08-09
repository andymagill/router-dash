import { track } from "@vercel/analytics"

/**
 * Privacy-safe analytics. Only the events and property keys explicitly listed
 * here are ever sent. Prompt text, responses, and API keys are NEVER tracked.
 */

export type AnalyticsEvent =
  | "benchmark_started"
  | "benchmark_completed"
  | "benchmark_failed"
  | "share_link_copied"
  | "result_exported"
  | "feedback_opened"

/** Allowlisted property keys. Anything else is dropped before sending. */
const ALLOWED_PROPS = new Set([
  "modelIds",
  "modelCount",
  "durationMs",
  "exportFormat",
  "errorCategory",
  "source",
  "truncated",
])

type PropValue = string | number | boolean | null
export interface AnalyticsProps {
  /** Model IDs are non-sensitive catalog identifiers, safe to record. */
  modelIds?: string
  modelCount?: number
  durationMs?: number
  exportFormat?: "json" | "csv"
  errorCategory?: string
  source?: string
  truncated?: boolean
}

/** Strip any property not on the allowlist. Defense in depth. Exported for tests. */
export function sanitizeAnalyticsProps(
  props?: AnalyticsProps,
): Record<string, PropValue> {
  const clean: Record<string, PropValue> = {}
  if (!props) return clean
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_PROPS.has(key)) continue
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      clean[key] = value
    }
  }
  return clean
}

/** Collapse a raw error message into a coarse, non-identifying category. */
export function categorizeError(message: string | undefined): string {
  const m = (message ?? "").toLowerCase()
  if (!m) return "unknown"
  if (m.includes("cancel") || m.includes("abort")) return "cancelled"
  if (m.includes("401") || m.includes("unauth") || m.includes("api key"))
    return "auth"
  if (m.includes("429") || m.includes("rate")) return "rate_limit"
  if (m.includes("timeout") || m.includes("timed out")) return "timeout"
  if (m.includes("network") || m.includes("fetch") || m.includes("failed to"))
    return "network"
  if (m.includes("400") || m.includes("invalid")) return "bad_request"
  if (/50\d/.test(m) || m.includes("server")) return "server"
  return "other"
}

/** Track an allowlisted event with sanitized properties. */
export function trackEvent(
  event: AnalyticsEvent,
  props?: AnalyticsProps,
): void {
  try {
    track(event, sanitizeAnalyticsProps(props))
  } catch {
    // Analytics must never break the app.
  }
}
