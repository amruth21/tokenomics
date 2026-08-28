// Shared helpers for detector rules. Every detector takes `Facts` (built by
// engine/analyze.ts) and returns `Recommendation[]` with real evidence —
// no card ships a dollar figure without the turns behind it.

import type { Facts, SessionFact } from '../engine/facts'

/** Observed window length in whole days, derived from the turns we actually
 * have (min..max timestamp). Used to extrapolate an observed saving to a
 * monthly figure. Falls back to 1 day (no extrapolation) if the window is
 * degenerate (e.g. a tiny test fixture). */
export function windowDays(facts: Facts): number {
  let min: string | null = null
  let max: string | null = null
  for (const t of facts.turns) {
    if (!min || t.timestamp < min) min = t.timestamp
    if (!max || t.timestamp > max) max = t.timestamp
  }
  if (!min || !max) return 1
  const ms = new Date(max).getTime() - new Date(min).getTime()
  const days = ms / (1000 * 60 * 60 * 24)
  return Math.max(1, Math.round(days))
}

export function monthlyExtrapolate(observed: number, days: number): number {
  return observed * (30 / days)
}

export function sessionAvgCostPerTurn(sess: SessionFact | undefined): number {
  if (!sess || sess.turnCount === 0) return 0
  return sess.cost / sess.turnCount
}

let idCounter = 0
export function nextId(prefix: string): string {
  idCounter++
  return `${prefix}-${idCounter}`
}
