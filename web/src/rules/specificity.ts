// C1 — prompt specificity score. Deterministic, local, keyword/pattern-based
// features only — no LLM call. Scores each real user prompt, then correlates
// high-specificity + small/mechanical output against the model it ran on
// (routing candidate) and low-specificity + long follow-up (plan-mode
// candidate).

import type { Recommendation } from '../types/analysis'
import type { Facts, PromptFact } from '../engine/facts'
import { nextId } from './shared'

const HEDGE_WORDS = [
  'maybe', 'something like', 'figure out', 'look into', 'explore', 'what do you think',
  'clean this up', 'some kind of', 'kind of', 'sort of', 'i guess', 'possibly', 'perhaps',
]
const IMPERATIVE_VERBS = [
  'rename', 'add', 'fix', 'remove', 'delete', 'update', 'implement', 'refactor', 'write',
  'create', 'move', 'extract', 'replace', 'bump', 'revert', 'rename', 'wire',
]

const FILE_PATH_RE = /\b[\w./-]+\.[a-zA-Z]{1,5}\b/ // foo/bar.ts, seed.py, etc.
const SYMBOL_RE = /\b[a-z][a-zA-Z0-9]*(?:[A-Z][a-z0-9]*)+\b|\b[a-z0-9_]+_[a-z0-9_]+\b/ // camelCase or snake_case
const LINE_NUMBER_RE = /\bline\s*\d+\b|:\d{2,5}\b/i
const ERROR_TEXT_RE = /"[^"]{6,}"|`[^`]{6,}`|error[:\s]/i
const OPUS_MODELS = new Set(['claude-opus-5', 'claude-opus-4-8'])

/** Score in roughly [-3, 5]: higher = more specific/mechanical. */
export function scorePrompt(text: string): number {
  let score = 0
  const lower = text.toLowerCase()

  if (FILE_PATH_RE.test(text)) score += 1
  if (SYMBOL_RE.test(text)) score += 1
  if (LINE_NUMBER_RE.test(text)) score += 1
  if (ERROR_TEXT_RE.test(text)) score += 1
  if (IMPERATIVE_VERBS.some((v) => lower.trimStart().startsWith(v))) score += 1
  if (text.length < 240) score += 1
  if (text.length < 80) score += 0.5

  const hedgeHits = HEDGE_WORDS.filter((h) => lower.includes(h)).length
  score -= hedgeHits
  const questionMarks = (text.match(/\?/g) ?? []).length
  if (questionMarks > 1) score -= 1

  return score
}

export function detectPromptSpecificity(facts: Facts): Recommendation[] {
  if (facts.prompts.length === 0) return []

  const modelCost = new Map<string, { cost: number; turns: number }>()
  for (const t of facts.turns) {
    const m = modelCost.get(t.model) ?? { cost: 0, turns: 0 }
    m.cost += t.cost
    m.turns += 1
    modelCost.set(t.model, m)
  }
  const avgOpus = avgCostPerTurn(modelCost, 'claude-opus-5') || avgCostPerTurn(modelCost, 'claude-opus-4-8')
  const avgSonnet = avgCostPerTurn(modelCost, 'claude-sonnet-5')
  const repriceRatio = avgOpus > 0 && avgSonnet > 0 ? avgSonnet / avgOpus : 1 / 7.2

  const scored = facts.prompts.map((p) => ({ prompt: p, score: scorePrompt(p.text) }))

  const routingCandidates = scored.filter(
    (s) =>
      s.score >= 3 &&
      s.prompt.followingModel &&
      OPUS_MODELS.has(s.prompt.followingModel) &&
      s.prompt.followingToolCalls <= 3 &&
      s.prompt.followingOutputTokens > 0 &&
      s.prompt.followingOutputTokens < 800,
  )

  const vagueReworkCandidates = scored.filter((s) => s.score <= -1 && s.prompt.followingTurns >= 5)

  const recs: Recommendation[] = []

  if (routingCandidates.length > 0) {
    const evidence = routingCandidates
      .sort((a, b) => b.prompt.followingCost - a.prompt.followingCost)
      .slice(0, 20)
      .map((s) => ({
        sessionId: s.prompt.sessionId,
        label: `"${truncate(s.prompt.text)}" (score ${s.score.toFixed(1)}, ${s.prompt.followingToolCalls} tool calls)`,
        turns: s.prompt.followingTurns,
        cost: s.prompt.followingCost,
      }))
    const totalOpusCost = routingCandidates.reduce((sum, s) => sum + s.prompt.followingCost, 0)
    const saving = totalOpusCost * (1 - repriceRatio)
    const shareOfOpusTurns =
      avgOpus > 0 ? routingCandidates.length / (modelCost.get('claude-opus-5')?.turns ?? 1 || 1) : 0

    recs.push({
      id: nextId('c1-routing'),
      category: 'routing',
      title: `${routingCandidates.length} Opus turns look like mechanical Sonnet work`,
      body:
        `These prompts were specific and bounded (file paths, symbols, or exact error text; single imperative verb; ` +
        `no hedging) and produced small, single-shot output on Opus. ` +
        `${(shareOfOpusTurns * 100).toFixed(0)}% of a sample of your Opus turns fit this pattern.`,
      monthlySaving: saving,
      confidence: 'heuristic',
      fix: 'Route prompts like these to Sonnet — the mechanical edit gets done at a fraction of the cost.',
      evidence,
    })
  }

  if (vagueReworkCandidates.length > 0) {
    const evidence = vagueReworkCandidates
      .sort((a, b) => b.prompt.followingTurns - a.prompt.followingTurns)
      .slice(0, 20)
      .map((s) => ({
        sessionId: s.prompt.sessionId,
        label: `"${truncate(s.prompt.text)}" (score ${s.score.toFixed(1)}, ${s.prompt.followingTurns} turns after)`,
        turns: s.prompt.followingTurns,
        cost: s.prompt.followingCost,
      }))
    const totalCost = vagueReworkCandidates.reduce((sum, s) => sum + s.prompt.followingCost, 0)

    recs.push({
      id: nextId('c1-vague'),
      category: 'routing',
      title: `Vague prompts cost you the most turns`,
      body:
        `${vagueReworkCandidates.length} prompts scored low on specificity (open scope, hedging language, or multiple ` +
        `questions) and were followed by 5+ turns before the task closed — a sign of thrashing rather than a clean edit.`,
      monthlySaving: totalCost * 0.3, // conservative: plan mode won't eliminate all rework, just cut it
      confidence: 'heuristic',
      fix: 'For open-scope asks, start in plan mode so the approach is settled before turns start burning context.',
      evidence,
    })
  }

  return recs
}

function avgCostPerTurn(map: Map<string, { cost: number; turns: number }>, model: string): number {
  const m = map.get(model)
  if (!m || m.turns === 0) return 0
  return m.cost / m.turns
}

function truncate(s: string, n = 70): string {
  const oneLine = s.replace(/\s+/g, ' ').trim()
  return oneLine.length > n ? oneLine.slice(0, n) + '…' : oneLine
}

// re-exported for potential reuse/testing by other rule modules
export type { PromptFact }
