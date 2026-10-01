/**
 * Resolve a stored model key to a model, synthesizing a stub when it isn't in
 * the loaded catalog (e.g. a saved session whose provider key is absent, or a
 * model that has since been retired). The stub keeps the key's identity so the
 * result card can still be labeled.
 */

import { parseModelKey, type UnifiedModel } from "@/lib/providers/types"

export function resolveSttModel(
  key: string,
  modelByKey: Map<string, UnifiedModel>,
): UnifiedModel {
  const found = modelByKey.get(key)
  if (found) return found
  const { provider, modelId } = parseModelKey(key)
  return {
    key,
    provider,
    modelId,
    name: modelId,
    // OpenRouter ids are "vendor/model"; other providers' ids are bare.
    vendor: modelId.includes("/") ? modelId.split("/")[0] : "unknown",
    contextKnown: false,
    pricingKnown: false,
    isFree: false,
  }
}
