/**
 * Provider error handling with strict sanitization.
 *
 * Displayed/diagnostic error text must never leak credentials, auth headers,
 * cookies, stack traces, server file paths, or environment data. We redact
 * aggressively and keep a short, actionable summary separate from the longer
 * (still sanitized) diagnostic detail.
 */

import type { ProviderId } from "./types"
import { PROVIDER_LABELS } from "./types"

export type ErrorCategory =
  | "auth"
  | "rate_limit"
  | "quota"
  | "not_found"
  | "bad_request"
  | "server"
  | "network"
  | "cancelled"
  | "unknown"

const REDACTIONS: { re: RegExp; with: string }[] = [
  // Bearer tokens / Authorization headers
  { re: /\bBearer\s+[A-Za-z0-9._\-]+/gi, with: "Bearer [redacted]" },
  { re: /\bauthorization["'`:=\s]+[^\s"'`,}]+/gi, with: "authorization: [redacted]" },
  // Common API key shapes (OpenRouter sk-or-, OpenAI sk-, Groq gsk_, Cerebras csk-)
  { re: /\bsk-or-[A-Za-z0-9._\-]+/gi, with: "[redacted-key]" },
  { re: /\bgsk_[A-Za-z0-9]+/gi, with: "[redacted-key]" },
  { re: /\bcsk-[A-Za-z0-9._\-]+/gi, with: "[redacted-key]" },
  { re: /\bsk-[A-Za-z0-9]{12,}/gi, with: "[redacted-key]" },
  // api_key / apiKey / token fields in JSON-ish text
  { re: /("?(?:api[_-]?key|token|secret|password)"?\s*[:=]\s*)("?[^\s"',}]+"?)/gi, with: "$1[redacted]" },
  // Absolute file paths (unix + windows)
  { re: /(?:\/[A-Za-z0-9._-]+){2,}/g, with: "[path]" },
  { re: /[A-Za-z]:\\[^\s"']+/g, with: "[path]" },
]

/** Strip anything credential- or environment-sensitive from arbitrary text. */
export function sanitizeErrorText(input: string): string {
  let out = input
  for (const { re, with: replacement } of REDACTIONS) {
    out = out.replace(re, replacement)
  }
  // Drop stack-trace tails ("at fn (...)"). Avoid the dotAll flag so we don't
  // require an es2018 target; match to end-of-line explicitly instead.
  out = out.replace(/\n\s*at\s+[^\n]*/g, "").trim()
  // Collapse whitespace and cap length so a giant HTML body can't flood the UI.
  out = out.replace(/\s+/g, " ").trim()
  if (out.length > 500) out = `${out.slice(0, 500)}…`
  return out
}

export function categorizeStatus(status?: number): ErrorCategory {
  if (status === undefined) return "network"
  if (status === 401 || status === 403) return "auth"
  if (status === 429) return "rate_limit"
  if (status === 402) return "quota"
  if (status === 404) return "not_found"
  if (status >= 400 && status < 500) return "bad_request"
  if (status >= 500) return "server"
  return "unknown"
}

/** Short, actionable summary shown as the primary error line. */
export function summaryForCategory(
  category: ErrorCategory,
  provider: ProviderId,
): string {
  const name = PROVIDER_LABELS[provider]
  switch (category) {
    case "auth":
      return `${name} rejected the API key (check it in Keys)`
    case "rate_limit":
      return `${name} rate limit hit — slow down or retry shortly`
    case "quota":
      return `${name} account quota or credits exhausted`
    case "not_found":
      return `Model not found on ${name}`
    case "bad_request":
      return `${name} rejected the request`
    case "server":
      return `${name} had a server error — try again`
    case "network":
      return `Network error reaching ${name}`
    case "cancelled":
      return "Cancelled"
    default:
      return `${name} request failed`
  }
}

/**
 * A provider error carrying a short summary (safe for persistence/UI) and a
 * longer, still-sanitized diagnostic detail (ephemeral, for technical users;
 * never persisted, shared, or sent to analytics).
 */
export class ProviderError extends Error {
  readonly provider: ProviderId
  readonly category: ErrorCategory
  readonly status?: number
  /** Longer sanitized diagnostic. Never persisted or shared. */
  readonly detail: string

  constructor(args: {
    provider: ProviderId
    category: ErrorCategory
    status?: number
    summary: string
    detail: string
  }) {
    super(args.summary)
    this.name = "ProviderError"
    this.provider = args.provider
    this.category = args.category
    this.status = args.status
    this.detail = sanitizeErrorText(args.detail)
  }
}

/** Build a ProviderError from a raw HTTP failure, sanitizing everything. */
export function providerErrorFromResponse(args: {
  provider: ProviderId
  status: number
  rawMessage: string
}): ProviderError {
  const category = categorizeStatus(args.status)
  const summary = summaryForCategory(category, args.provider)
  const detail = `HTTP ${args.status}: ${sanitizeErrorText(args.rawMessage || "")}`.trim()
  return new ProviderError({
    provider: args.provider,
    category,
    status: args.status,
    summary,
    detail,
  })
}

/** Build a ProviderError from a network/other thrown error. */
export function providerErrorFromThrown(
  provider: ProviderId,
  err: unknown,
): ProviderError {
  const category: ErrorCategory = "network"
  const summary = summaryForCategory(category, provider)
  const raw = err instanceof Error ? err.message : String(err)
  return new ProviderError({
    provider,
    category,
    summary,
    detail: sanitizeErrorText(raw),
  })
}
