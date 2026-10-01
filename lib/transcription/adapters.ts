/**
 * Speech-to-text adapter registry. Kept separate from "./index" so the runner
 * can import it without an import cycle (index re-exports the runner).
 */

import { groqSttAdapter } from "./groq"
import { openRouterSttAdapter } from "./openrouter"
import type { SttAdapter, SttProviderId } from "./types"

export const STT_ADAPTERS: Record<SttProviderId, SttAdapter> = {
  groq: groqSttAdapter,
  openrouter: openRouterSttAdapter,
}
