/**
 * Shared helper for OpenAI-compatible chat-completion endpoints. Both
 * OpenRouter and Groq speak this dialect, so request dispatch and response
 * parsing live here once. Errors are converted into sanitized ProviderErrors.
 */

import type {
  ChatMessage,
  CompletionOutcome,
  ProviderId,
  ORUsage,
} from "./types"
import { providerErrorFromResponse, providerErrorFromThrown } from "./errors"

export interface ChatCompletionRequest {
  provider: ProviderId
  url: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  /** Conservative, portable params. Omit any the provider doesn't support. */
  body: Record<string, unknown>
  extraHeaders?: Record<string, string>
  signal?: AbortSignal
}

function parseUsage(raw: unknown): ORUsage | null {
  if (!raw || typeof raw !== "object") return null
  const u = raw as Record<string, unknown>
  const prompt = Number(u.prompt_tokens) || 0
  const completion = Number(u.completion_tokens) || 0
  const total = Number(u.total_tokens) || prompt + completion
  if (!prompt && !completion && !total) return null
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: total,
  }
}

export async function postChatCompletion(
  req: ChatCompletionRequest,
): Promise<CompletionOutcome> {
  let res: Response
  try {
    res = await fetch(req.url, {
      method: "POST",
      signal: req.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${req.apiKey}`,
        ...req.extraHeaders,
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        ...req.body,
      }),
    })
  } catch (err) {
    // AbortError propagates as-is so callers can detect cancellation.
    if (err instanceof DOMException && err.name === "AbortError") throw err
    throw providerErrorFromThrown(req.provider, err)
  }

  let json: unknown = null
  const text = await res.text()
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  if (!res.ok) {
    const rawMessage = extractErrorMessage(json) ?? text ?? ""
    throw providerErrorFromResponse({
      provider: req.provider,
      status: res.status,
      rawMessage,
    })
  }

  const j = (json ?? {}) as Record<string, unknown>
  const choices = Array.isArray(j.choices) ? j.choices : []
  const first = (choices[0] ?? {}) as Record<string, unknown>
  const message = (first.message ?? {}) as Record<string, unknown>
  const content = typeof message.content === "string" ? message.content : ""

  return { content, usage: parseUsage(j.usage) }
}

function extractErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return null
  const j = json as Record<string, unknown>
  const error = j.error
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const msg = (error as Record<string, unknown>).message
    if (typeof msg === "string") return msg
  }
  if (typeof j.message === "string") return j.message
  return null
}
