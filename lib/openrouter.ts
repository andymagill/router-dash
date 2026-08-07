export const OPENROUTER_BASE = "https://openrouter.ai/api/v1"

export interface ORPricing {
  prompt: string
  completion: string
  request?: string
  image?: string
}

export interface ORArchitecture {
  modality?: string
  input_modalities?: string[]
  output_modalities?: string[]
  tokenizer?: string
}

export interface ORTopProvider {
  context_length?: number
  max_completion_tokens?: number
  is_moderated?: boolean
}

export interface ORModel {
  id: string
  name: string
  description?: string
  created?: number
  context_length?: number
  architecture?: ORArchitecture
  pricing?: ORPricing
  top_provider?: ORTopProvider
  supported_parameters?: string[]
}

export interface ORUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface RunParams {
  systemPrompt: string
  temperature: number
  topP: number
  maxTokens: number
}

/** Parse the provider slug out of a model id, e.g. "anthropic/claude-3.5-sonnet" -> "anthropic". */
export function providerOf(model: ORModel): string {
  return model.id.split("/")[0] ?? "unknown"
}

/** A friendly, capitalized label for a provider slug. */
export function providerLabel(slug: string): string {
  const map: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    "meta-llama": "Meta",
    meta: "Meta",
    mistralai: "Mistral",
    mistral: "Mistral",
    "x-ai": "xAI",
    deepseek: "DeepSeek",
    qwen: "Qwen",
    cohere: "Cohere",
    perplexity: "Perplexity",
    microsoft: "Microsoft",
    nvidia: "NVIDIA",
    amazon: "Amazon",
  }
  return map[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1)
}

export function isFreeModel(model: ORModel): boolean {
  const p = model.pricing
  if (!p) return false
  return Number(p.prompt) === 0 && Number(p.completion) === 0
}

export function isVisionModel(model: ORModel): boolean {
  const inputs = model.architecture?.input_modalities ?? []
  if (inputs.some((m) => m === "image")) return true
  const modality = model.architecture?.modality ?? ""
  return modality.includes("image")
}

export function supportsParam(model: ORModel, param: string): boolean {
  // If metadata is missing, assume supported to avoid false warnings.
  if (!model.supported_parameters || model.supported_parameters.length === 0)
    return true
  return model.supported_parameters.includes(param)
}

const FLAGSHIP_MATCHERS = [
  "claude-3.5-sonnet",
  "claude-3.7",
  "claude-sonnet-4",
  "claude-opus-4",
  "gpt-4o",
  "gpt-4.1",
  "gpt-5",
  "o1",
  "o3",
  "gemini-1.5-pro",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
  "llama-3.1-405b",
  "llama-3.3-70b",
  "grok-2",
  "grok-3",
  "deepseek-chat",
  "deepseek-r1",
  "mistral-large",
]

export function isFlagship(model: ORModel): boolean {
  const id = model.id.toLowerCase()
  return FLAGSHIP_MATCHERS.some((m) => id.includes(m))
}

/** Estimated cost in USD for a single completion given token usage. */
export function estimateCost(model: ORModel, usage: ORUsage | null): number {
  if (!usage || !model.pricing) return 0
  const promptPrice = Number(model.pricing.prompt) || 0
  const completionPrice = Number(model.pricing.completion) || 0
  return (
    usage.prompt_tokens * promptPrice +
    usage.completion_tokens * completionPrice
  )
}

/** Rough token estimate (~4 chars per token) for the prompt hint. */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

export async function fetchModels(): Promise<ORModel[]> {
  const res = await fetch(`${OPENROUTER_BASE}/models`, {
    headers: { Accept: "application/json" },
  })
  if (!res.ok) {
    throw new Error(`Failed to load models (${res.status})`)
  }
  const json = await res.json()
  const data: ORModel[] = json?.data ?? []
  return data
}

export interface CompletionResult {
  content: string
  usage: ORUsage | null
  raw: unknown
}

export async function runCompletion(
  apiKey: string,
  modelId: string,
  prompt: string,
  params: RunParams,
  model: ORModel | undefined,
  signal?: AbortSignal,
): Promise<CompletionResult> {
  const messages: ChatMessage[] = []
  if (params.systemPrompt.trim()) {
    messages.push({ role: "system", content: params.systemPrompt })
  }
  messages.push({ role: "user", content: prompt })

  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    max_tokens: params.maxTokens,
  }
  // Only send parameters the model actually supports.
  if (!model || supportsParam(model, "temperature")) {
    body.temperature = params.temperature
  }
  if (!model || supportsParam(model, "top_p")) {
    body.top_p = params.topP
  }

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": "RouterDash",
    },
    body: JSON.stringify(body),
  })

  const json = await res.json()
  if (!res.ok) {
    const message =
      json?.error?.message || json?.message || `Request failed (${res.status})`
    throw new Error(message)
  }

  const content: string = json?.choices?.[0]?.message?.content ?? ""
  const usage: ORUsage | null = json?.usage
    ? {
        prompt_tokens: json.usage.prompt_tokens ?? 0,
        completion_tokens: json.usage.completion_tokens ?? 0,
        total_tokens: json.usage.total_tokens ?? 0,
      }
    : null

  return { content, usage, raw: json }
}
