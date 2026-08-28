// B1 — fat tool payloads are annuities. A large tool_result (e.g. a full
// browser screenshot) gets re-read on every later turn of the session, not
// just paid once. Cost = tokens x turns_remaining x cache_read_rate.

import type { Recommendation } from '../types/analysis'
import type { Facts } from '../engine/facts'
import { PRICING } from '../engine/pricing'
import { monthlyExtrapolate, nextId, windowDays } from './shared'

const FAT_THRESHOLD_TOKENS = 4000 // ~16 KB, comfortably above a normal tool result

export function detectFatPayloads(facts: Facts): Recommendation[] {
  const days = windowDays(facts)

  // sessionId -> total turns (max turnIndex + 1), used to compute "remaining" turns.
  const sessionTurnCount = new Map<string, number>()
  for (const t of facts.turns) {
    sessionTurnCount.set(t.sessionId, Math.max(sessionTurnCount.get(t.sessionId) ?? 0, t.turnIndex + 1))
  }

  const fat = facts.toolCalls.filter((c) => c.tokens >= FAT_THRESHOLD_TOKENS)
  if (fat.length === 0) return []

  const byName = new Map<string, { name: string; calls: number; annuity: number }>()
  const evidence: { sessionId: string; label: string; turns: number; cost: number }[] = []

  for (const c of fat) {
    const totalTurns = sessionTurnCount.get(c.sessionId) ?? 1
    const remaining = Math.max(0, totalTurns - c.turnIndex - 1)
    const rate = PRICING[c.model]?.cacheRead ?? 0.3
    const annuity = (c.tokens / 1_000_000) * rate * remaining

    const g = byName.get(c.name) ?? { name: c.name, calls: 0, annuity: 0 }
    g.calls++
    g.annuity += annuity
    byName.set(c.name, g)

    if (annuity > 0) {
      evidence.push({
        sessionId: c.sessionId,
        label: `${c.name} ≈${Math.round(c.tokens / 1000)}k tok re-read across ${remaining} turns`,
        turns: remaining,
        cost: annuity,
      })
    }
  }

  evidence.sort((a, b) => b.cost - a.cost)
  const topEvidence = evidence.slice(0, 20)
  const totalAnnuity = evidence.reduce((s, e) => s + e.cost, 0)
  const worst = [...byName.values()].sort((a, b) => b.annuity - a.annuity)[0]

  if (topEvidence.length === 0) return []

  return [
    {
      id: nextId('b1-fat-payloads'),
      category: 'context',
      title: `${worst.name} payloads keep getting re-read for the rest of the session`,
      body:
        `${fat.length} tool results over ${FAT_THRESHOLD_TOKENS.toLocaleString()} tokens were injected into context ` +
        `and then re-read on every subsequent turn. \`${worst.name}\` alone accounts for an estimated ` +
        `$${worst.annuity.toFixed(2)} of pure re-read cost across ${worst.calls} calls.`,
      monthlySaving: monthlyExtrapolate(totalAnnuity, days),
      confidence: 'high',
      fix: 'Write large tool output (screenshots, full-page snapshots) to a file path and let the model read it only if needed; prefer compact snapshot tools over full screenshots.',
      evidence: topEvidence,
    },
  ]
}
