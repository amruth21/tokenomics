import rates from './pricing.json'

export type RateCard = {
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
}

export const PRICING: Record<string, RateCard> = rates

export const SYNTHETIC_MODEL = '<synthetic>'

/** $/Mtok rates -> $ for a given token count. */
function priceTokens(tokens: number, dollarsPerMtok: number): number {
  return (tokens / 1_000_000) * dollarsPerMtok
}

export type UsageLike = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number }
}

/** Family-level fallback so a transcript from ANY Claude model still prices.
 * Exact ids change often and a visitor's history will contain models this table
 * has never seen; pricing those at 0 would silently show them a $0 dashboard,
 * which reads as "the tool is broken" rather than "the model is unknown".
 * We match on family and use that family's current rate as an estimate. */
export function rateFor(model: string): { rate: RateCard; estimated: boolean } | null {
  const exact = PRICING[model]
  if (exact) return { rate: exact, estimated: false }
  const m = model.toLowerCase()
  if (m.includes('opus')) return { rate: PRICING['claude-opus-5'], estimated: true }
  if (m.includes('sonnet')) return { rate: PRICING['claude-sonnet-5'], estimated: true }
  if (m.includes('haiku')) return { rate: PRICING['claude-haiku-4-5-20251001'], estimated: true }
  return null
}

/** True when this model priced via a family fallback rather than an exact match. */
export function isEstimatedRate(model: string): boolean {
  if (model === SYNTHETIC_MODEL) return false
  return rateFor(model)?.estimated ?? false
}

/** Compute the $ cost of one turn's usage block. Returns 0 for synthetic or
 * wholly unrecognized models — never inline a rate outside this module. */
export function costOfUsage(model: string, usage: UsageLike | undefined | null): number {
  if (!usage || model === SYNTHETIC_MODEL) return 0
  const resolved = rateFor(model)
  if (!resolved) return 0
  const rate = resolved.rate
  const input = usage.input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const write5m = usage.cache_creation?.ephemeral_5m_input_tokens ?? 0
  const write1h = usage.cache_creation?.ephemeral_1h_input_tokens ?? 0
  return (
    priceTokens(input, rate.input) +
    priceTokens(output, rate.output) +
    priceTokens(cacheRead, rate.cacheRead) +
    priceTokens(write5m, rate.cacheWrite5m) +
    priceTokens(write1h, rate.cacheWrite1h)
  )
}
