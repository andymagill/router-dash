import { describe, it, expect } from "vitest"
import {
  sanitizeErrorText,
  categorizeStatus,
  providerErrorFromResponse,
  providerErrorFromThrown,
  ProviderError,
} from "@/lib/providers"

describe("error sanitization", () => {
  it("redacts bearer tokens and provider keys", () => {
    const raw =
      "401 Unauthorized: Authorization: Bearer sk-or-v1-abcdef123456 rejected"
    const out = sanitizeErrorText(raw)
    expect(out).not.toContain("sk-or-v1-abcdef123456")
    expect(out).not.toMatch(/Bearer\s+sk-/)
    expect(out).toContain("[redacted")
  })

  it("redacts Groq gsk_ keys and json api_key fields", () => {
    expect(sanitizeErrorText("key gsk_ABC123def456")).not.toContain(
      "gsk_ABC123def456",
    )
    const json = '{"api_key":"secret-value-here","model":"x"}'
    const out = sanitizeErrorText(json)
    expect(out).not.toContain("secret-value-here")
  })

  it("strips absolute file paths and stack traces", () => {
    const raw =
      "Error: boom\n    at fetchCatalog (/var/task/lib/providers/groq.ts:42:11)"
    const out = sanitizeErrorText(raw)
    expect(out).not.toContain("/var/task/lib/providers/groq.ts")
    expect(out).not.toContain("at fetchCatalog")
  })

  it("caps runaway length", () => {
    const out = sanitizeErrorText("x".repeat(5000))
    expect(out.length).toBeLessThanOrEqual(501)
  })
})

describe("status categorization", () => {
  it("maps HTTP statuses to categories", () => {
    expect(categorizeStatus(401)).toBe("auth")
    expect(categorizeStatus(403)).toBe("auth")
    expect(categorizeStatus(429)).toBe("rate_limit")
    expect(categorizeStatus(402)).toBe("quota")
    expect(categorizeStatus(404)).toBe("not_found")
    expect(categorizeStatus(400)).toBe("bad_request")
    expect(categorizeStatus(500)).toBe("server")
    expect(categorizeStatus(undefined)).toBe("network")
  })
})

describe("ProviderError construction", () => {
  it("produces a safe summary and sanitized detail from a response", () => {
    const err = providerErrorFromResponse({
      provider: "groq",
      status: 401,
      rawMessage: "Invalid API Key: gsk_supersecretvalue",
    })
    expect(err).toBeInstanceOf(ProviderError)
    expect(err.category).toBe("auth")
    expect(err.message).toContain("Groq")
    // The user-facing message must never carry the raw key.
    expect(err.message).not.toContain("gsk_supersecretvalue")
    expect(err.detail).not.toContain("gsk_supersecretvalue")
  })

  it("classifies thrown network errors", () => {
    const err = providerErrorFromThrown(
      "openrouter",
      new TypeError("Failed to fetch"),
    )
    expect(err.category).toBe("network")
    expect(err.message).toContain("OpenRouter")
  })
})
