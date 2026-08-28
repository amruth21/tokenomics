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

/** Compute the $ cost of one turn's usage block. Returns 0 for unknown/synthetic models —
 * never inline a rate outside this module. */
export function costOfUsage(model: string, usage: UsageLike | undefined | null): number {
  if (!usage || model === SYNTHETIC_MODEL) return 0
  const rate = PRICING[model]
  if (!rate) return 0
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
