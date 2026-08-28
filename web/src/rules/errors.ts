// A5 — declined transactions. 892/10,139 tool results are errors (8.8%) in
// the reference corpus. Each failed tool call burns a full turn. Group by
// error class and name the top recurring failure per session.

import type { Recommendation } from '../types/analysis'
import type { Facts } from '../engine/facts'
import { monthlyExtrapolate, nextId, sessionAvgCostPerTurn, windowDays } from './shared'

export function detectErrorRate(facts: Facts): Recommendation[] {
  const days = windowDays(facts)
  const errorCalls = facts.toolCalls.filter((c) => c.isError)
  if (errorCalls.length === 0) return []

  const byClass = new Map<string, number>()
  const bySession = new Map<string, { sessionId: string; count: number; topClass: string }>()
  const classBySession = new Map<string, Map<string, number>>()

  for (const c of errorCalls) {
    byClass.set(c.errorClass ?? 'other', (byClass.get(c.errorClass ?? 'other') ?? 0) + 1)
    const s = bySession.get(c.sessionId) ?? { sessionId: c.sessionId, count: 0, topClass: c.errorClass ?? 'other' }
    s.count++
    bySession.set(c.sessionId, s)
    const cm = classBySession.get(c.sessionId) ?? new Map<string, number>()
    cm.set(c.errorClass ?? 'other', (cm.get(c.errorClass ?? 'other') ?? 0) + 1)
    classBySession.set(c.sessionId, cm)
  }
  for (const s of bySession.values()) {
    const cm = classBySession.get(s.sessionId)!
    s.topClass = [...cm.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }

  const errorRate = facts.toolResultTotal > 0 ? errorCalls.length / facts.toolResultTotal : 0
  const topClass = [...byClass.entries()].sort((a, b) => b[1] - a[1])[0]

  const evidence = [...bySession.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map((s) => {
      const sess = facts.sessions.get(s.sessionId)
      const avgCost = sessionAvgCostPerTurn(sess)
      return { sessionId: s.sessionId, label: `${s.count}x "${s.topClass}"`, turns: s.count, cost: s.count * avgCost }
    })

  const totalWasted = evidence.reduce((s, e) => s + e.cost, 0)

  return [
    {
      id: nextId('a5-errors'),
      category: 'loop',
      title: `${(errorRate * 100).toFixed(1)}% of your tool calls failed`,
      body:
        `${errorCalls.length} of ${facts.toolResultTotal} tool results were errors. ` +
        `The most common failure was "${topClass[0]}" (${topClass[1]} occurrences). ` +
        `Each failed call still burns a full turn of context.`,
      monthlySaving: monthlyExtrapolate(totalWasted, days),
      confidence: 'high',
      fix: 'Fix the top recurring failure class first — usually an allowlist entry, a path in CLAUDE.md, or a missing cd.',
      evidence,
    },
  ]
}
