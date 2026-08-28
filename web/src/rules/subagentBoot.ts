// B2 — subagent context scoping. Every subagent boots with roughly the same
// startup token count regardless of its job — that tight spread is the
// finding. docs/recommendations.md: 167 boots, median ~16.7k tokens, p90
// ~17.6k, spent purely on boilerplate context before the subagent does
// anything task-specific.

import type { Recommendation } from '../types/analysis'
import type { Facts } from '../engine/facts'
import { PRICING } from '../engine/pricing'
import { monthlyExtrapolate, nextId, windowDays } from './shared'

export function detectSubagentBoot(facts: Facts): Recommendation[] {
  const boots = facts.subagentBoots
  if (boots.length === 0) return []
  const days = windowDays(facts)

  const tokens = boots.map((b) => b.tokens).sort((a, b) => a - b)
  const median = percentile(tokens, 0.5)
  const p90 = percentile(tokens, 0.9)
  const max = tokens[tokens.length - 1]

  // Cost the boot tokens at a blended cache-read rate (subagents mostly run
  // on whatever model the parent delegated to; fall back to sonnet's rate).
  const blendedRate = PRICING['claude-sonnet-5']?.cacheRead ?? 0.3
  const totalBootCost = boots.reduce((s, b) => s + (b.tokens / 1_000_000) * blendedRate, 0)

  const byParent = new Map<string, { sessionId: string; runs: number; tokens: number }>()
  for (const b of boots) {
    const g = byParent.get(b.sessionId) ?? { sessionId: b.sessionId, runs: 0, tokens: 0 }
    g.runs++
    g.tokens += b.tokens
    byParent.set(b.sessionId, g)
  }

  const evidence = [...byParent.values()]
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 20)
    .map((g) => ({
      sessionId: g.sessionId,
      label: `${g.runs} subagent boots, ${Math.round(g.tokens / g.runs / 1000)}k tok avg`,
      turns: g.runs,
      cost: (g.tokens / 1_000_000) * blendedRate,
    }))

  return [
    {
      id: nextId('b2-subagent-boot'),
      category: 'context',
      title: `Your subagents all start with ~${Math.round(median / 1000)}k tokens of context`,
      body:
        `${boots.length} subagent boots, median ${median.toLocaleString()} startup tokens (p90 ${p90.toLocaleString()}, ` +
        `max ${max.toLocaleString()}). The tight spread means every subagent gets handed the same boilerplate ` +
        `regardless of its job — a subagent that renames a symbol needs the spec and two files, not the whole repo.`,
      monthlySaving: monthlyExtrapolate(totalBootCost * 0.5, days), // assume scoping could halve boot cost
      confidence: 'high',
      fix: "Scope each subagent's context to its job instead of handing it the full CLAUDE.md/AGENTS.md boilerplate.",
      evidence,
    },
  ]
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))
  return sorted[idx]
}
