import { describe, it, expect } from "vitest"
import { sanitizeAnalyticsProps, categorizeError } from "@/lib/analytics"
import { buildFeedbackUrl } from "@/lib/feedback"

describe("analytics prop allowlist", () => {
  it("keeps only allowlisted keys", () => {
    // Cast through unknown to simulate a caller smuggling in disallowed keys
    // at runtime; the allowlist must strip them regardless of the type system.
    const tainted = {
      modelCount: 3,
      exportFormat: "json",
      prompt: "secret user prompt",
      apiKey: "sk-or-LEAK",
    } as unknown as Parameters<typeof sanitizeAnalyticsProps>[0]
    const clean = sanitizeAnalyticsProps(tainted)
    expect(clean).toEqual({ modelCount: 3, exportFormat: "json" })
    expect(clean).not.toHaveProperty("prompt")
    expect(clean).not.toHaveProperty("apiKey")
  })

  it("returns an empty object for undefined props", () => {
    expect(sanitizeAnalyticsProps()).toEqual({})
  })

  it("drops non-primitive values even for allowlisted keys", () => {
    const clean = sanitizeAnalyticsProps({
      // @ts-expect-error intentionally wrong type
      modelCount: { nested: true },
    })
    expect(clean).toEqual({})
  })
})

describe("categorizeError", () => {
  it("maps messages to coarse categories", () => {
    expect(categorizeError(undefined)).toBe("unknown")
    expect(categorizeError("Request was cancelled")).toBe("cancelled")
    expect(categorizeError("401 Unauthorized")).toBe("auth")
    expect(categorizeError("Invalid API key")).toBe("auth")
    expect(categorizeError("429 Too Many Requests")).toBe("rate_limit")
    expect(categorizeError("Request timed out")).toBe("timeout")
    expect(categorizeError("network error")).toBe("network")
    expect(categorizeError("500 server error")).toBe("server")
  })
})

describe("feedback URL", () => {
  it("targets the configured repo and never includes prompt/keys", () => {
    const url = buildFeedbackUrl({
      modelIds: ["openai/gpt-4o-mini"],
      page: "/",
      userAgent: "TestAgent/1.0",
    })
    expect(url).toContain("github.com/andymagill/router-dash/issues/new")
    expect(url).toContain("labels=feedback")
    const decoded = decodeURIComponent(url)
    expect(decoded).toContain("openai/gpt-4o-mini")
    expect(decoded).toContain("TestAgent/1.0")
    // No prompt text or key material should ever be embedded.
    expect(decoded).not.toContain("sk-or-")
  })

  it("handles missing diagnostics gracefully", () => {
    const url = buildFeedbackUrl()
    expect(url).toContain("issues/new")
    // URLSearchParams encodes spaces as "+" (x-www-form-urlencoded), which
    // GitHub decodes back to spaces; normalize before asserting.
    const body = new URL(url).searchParams.get("body") ?? ""
    expect(body).toContain("(none selected)")
  })
})
