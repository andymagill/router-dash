/**
 * Filtering and sorting for the model selection table.
 *
 * Kept as pure functions so the table's behavior — especially how unknown
 * metadata is ordered — is unit-testable without a DOM.
 */

import { hasFixedPrice } from "@/lib/format"
import {
  type UnifiedModel,
  type ProviderId,
  PROVIDER_ORDER,
  ADAPTERS,
  isLongContext,
} from "@/lib/providers"

export type MetaFilter = "free" | "long" | "vision"

export type SortColumn =
  | "name"
  | "provider"
  | "context"
  | "promptPrice"
  | "completionPrice"

export type SortDir = "asc" | "desc"

export interface ModelFilters {
  search: string
  providers: ProviderId[]
  meta: MetaFilter[]
}

/**
 * Apply the search box and the provider/meta toggles. An empty `providers`
 * array means "all providers", matching the ToggleGroup's empty state.
 */
export function filterModels(
  models: UnifiedModel[],
  { search, providers, meta }: ModelFilters,
): UnifiedModel[] {
  const q = search.trim().toLowerCase()
  return models.filter((m) => {
    if (providers.length > 0 && !providers.includes(m.provider)) return false
    if (meta.includes("free") && !m.isFree) return false
    if (meta.includes("long") && !isLongContext(m)) return false
    if (meta.includes("vision") && !m.inputModalities?.includes("image"))
      return false
    if (!q) return true
    const hay =
      `${m.modelId} ${m.name} ${m.owner ?? ""} ${m.vendor} ${ADAPTERS[m.provider].label}`.toLowerCase()
    return hay.includes(q)
  })
}

/**
 * Models whose metadata a provider never gave us, or priced at runtime rather
 * than by a fixed rate. These always sink to the bottom regardless of direction — flipping the arrow should reorder the
 * models we can actually compare, not float "n/a" rows to the top.
 */
function isUnknown(model: UnifiedModel, column: SortColumn): boolean {
  switch (column) {
    case "context":
      return !model.contextKnown || model.contextLength === undefined
    case "promptPrice":
      return !model.pricingKnown || !hasFixedPrice(model.promptPrice)
    case "completionPrice":
      return !model.pricingKnown || !hasFixedPrice(model.completionPrice)
    default:
      return false
  }
}

function compareBy(
  a: UnifiedModel,
  b: UnifiedModel,
  column: SortColumn,
): number {
  switch (column) {
    case "provider":
      return PROVIDER_ORDER.indexOf(a.provider) - PROVIDER_ORDER.indexOf(b.provider)
    case "context":
      return (a.contextLength ?? 0) - (b.contextLength ?? 0)
    case "promptPrice":
      return (Number(a.promptPrice) || 0) - (Number(b.promptPrice) || 0)
    case "completionPrice":
      return (Number(a.completionPrice) || 0) - (Number(b.completionPrice) || 0)
    case "name":
      return 0 // handled entirely by the name tiebreaker below
  }
}

function compareName(a: UnifiedModel, b: UnifiedModel): number {
  const byName = a.name.localeCompare(b.name, "en", { sensitivity: "base" })
  // Two providers can expose the same display name; the key is unique.
  return byName !== 0 ? byName : a.key.localeCompare(b.key)
}

/**
 * Sort a copy of `models`. Name is the tiebreaker for every column, so equal
 * prices or context windows still read alphabetically rather than in whatever
 * order the catalogs happened to arrive in.
 */
export function sortModels(
  models: UnifiedModel[],
  column: SortColumn,
  dir: SortDir,
): UnifiedModel[] {
  const sign = dir === "asc" ? 1 : -1
  return [...models].sort((a, b) => {
    const aUnknown = isUnknown(a, column)
    const bUnknown = isUnknown(b, column)
    if (aUnknown !== bUnknown) return aUnknown ? 1 : -1
    if (!aUnknown) {
      const primary = compareBy(a, b, column)
      if (primary !== 0) return primary * sign
    }
    return compareName(a, b) * (column === "name" ? sign : 1)
  })
}
