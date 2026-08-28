// A4 — rework loops. Same file_path edited (Edit/Write) 3+ times in one
// session. docs/recommendations.md: 43 cases across 7 sessions, worst 29
// edits to one file. Explicitly NOT using file-history-delta (traps #3 in
// docs/data-model.md — it has zero repeats in the real corpus).

import type { Recommendation } from '../types/analysis'
import type { Facts } from '../engine/facts'
import { monthlyExtrapolate, nextId, sessionAvgCostPerTurn, windowDays } from './shared'

const EDIT_TOOLS = new Set(['Edit', 'Write'])

export function detectRework(facts: Facts): Recommendation[] {
  const days = windowDays(facts)
  const groups = new Map<string, { sessionId: string; path: string; count: number }>()

  for (const call of facts.toolCalls) {
    if (!EDIT_TOOLS.has(call.name) || !call.filePath) continue
    const key = `${call.sessionId} ${call.filePath}`
    const g = groups.get(key) ?? { sessionId: call.sessionId, path: call.filePath, count: 0 }
    g.count++
    groups.set(key, g)
  }

  const cases = [...groups.values()]
    .filter((g) => g.count >= 3)
    .sort((a, b) => b.count - a.count)

  if (cases.length === 0) return []

  const evidence = cases.map((c) => {
    const sess = facts.sessions.get(c.sessionId)
    const avgCost = sessionAvgCostPerTurn(sess)
    const wastedCost = (c.count - 1) * avgCost
    return { sessionId: c.sessionId, label: `${shortPath(c.path)} edited ${c.count}x`, turns: c.count, cost: wastedCost }
  })

  const totalWasted = evidence.reduce((s, e) => s + e.cost, 0)
  const worst = cases[0]
  const sessionCount = new Set(cases.map((c) => c.sessionId)).size

  return [
    {
      id: nextId('a4-rework'),
      category: 'loop',
      title: `You paid for ${shortPath(worst.path)} ${worst.count} times`,
      body:
        `${cases.length} file${cases.length === 1 ? '' : 's'} across ${sessionCount} session${sessionCount === 1 ? '' : 's'} ` +
        `were edited 3+ times in a single session — each edit re-reads the whole file's surrounding context. ` +
        `Worst case: \`${shortPath(worst.path)}\` edited ${worst.count} times in one session.`,
      monthlySaving: monthlyExtrapolate(totalWasted, days),
      confidence: 'medium',
      fix: 'Use plan mode to settle the approach first, or write the whole file once instead of iterating in place.',
      evidence,
    },
  ]
}

function shortPath(p: string): string {
  const parts = p.split('/')
  return parts.length > 2 ? '…/' + parts.slice(-2).join('/') : p
}
