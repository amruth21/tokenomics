// B3 — recurring charges. The always-on tax paid before you type a single
// character: per-project first-turn cache_creation floor, plus skill_listing
// and deferred_tools_delta injections. Framed as a subscription audit.

import type { Recommendation } from '../types/analysis'
import type { Facts } from '../engine/facts'
import { nextId } from './shared'

const BLENDED_WRITE_RATE = 30 // $/Mtok, opus-class 1h cache write — conservative upper bound for "what you pay to open a session"

export function detectRecurringCharges(facts: Facts): Recommendation[] {
  const evidence: { sessionId: string; label: string; turns: number; cost: number }[] = []
  let monthlyTotal = 0

  for (const [cwd, samples] of facts.recurringFirstTurn) {
    if (samples.length === 0) continue
    const min = Math.min(...samples)
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length
    const perSessionCost = (avg / 1_000_000) * BLENDED_WRITE_RATE
    const monthlyForProject = perSessionCost * samples.length
    monthlyTotal += monthlyForProject
    evidence.push({
      sessionId: cwd,
      label: `${shortCwd(cwd)}: floor ${min.toLocaleString()} tok, median ${Math.round(median(samples)).toLocaleString()} tok across ${samples.length} sessions`,
      turns: samples.length,
      cost: monthlyForProject,
    })
  }

  const skill = facts.attachmentCounts.skillListing
  const deferred = facts.attachmentCounts.deferredTools
  if (skill > 0) {
    const cost = (176 / 1_000_000) * BLENDED_WRITE_RATE * skill
    monthlyTotal += cost
    evidence.push({ sessionId: 'all sessions', label: `skill_listing injected ${skill}x (~176 tok each)`, turns: skill, cost })
  }
  if (deferred > 0) {
    const cost = (1500 / 1_000_000) * BLENDED_WRITE_RATE * deferred
    monthlyTotal += cost
    evidence.push({ sessionId: 'all sessions', label: `deferred_tools_delta injected ${deferred}x (~1.5k tok each)`, turns: deferred, cost })
  }

  if (evidence.length === 0) return []

  evidence.sort((a, b) => b.cost - a.cost)

  return [
    {
      id: nextId('b3-recurring'),
      category: 'habit',
      title: 'You pay a subscription before you type anything',
      body:
        'Every session opens with a fixed floor of context — CLAUDE.md/AGENTS.md, skill listings, and deferred-tool ' +
        'deltas — that gets written to context before the first real turn. This is the closest thing this account has ' +
        'to a recurring monthly charge.',
      monthlySaving: monthlyTotal,
      confidence: 'high',
      fix: 'Trim CLAUDE.md/AGENTS.md to what every session actually needs, and prune unused skills/MCP tools from the always-on set.',
      evidence: evidence.slice(0, 20),
    },
  ]
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function shortCwd(cwd: string): string {
  const parts = cwd.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? cwd
}
