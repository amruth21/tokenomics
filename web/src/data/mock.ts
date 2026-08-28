// Mock Analysis built from REAL measurements of a 230-file / 116 MB corpus.
// Frontend agents build against this. The engine replaces it at runtime.
// Numbers here are verified — do not "improve" them.
import type { Analysis } from '../types/analysis'

const days = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(2026, 7, 4 + i)
  return d.toISOString().slice(0, 10)
})

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const mockAnalysis: Analysis = {
  meta: { sessions: 59, turns: 9524, deduped: 11894, from: '2026-07-26', to: '2026-08-28', source: 'demo' },
  summary: {
    totalCost: 1230.23,
    productiveRateTokens: 0.002,
    productiveRateDollars: 0.082,
    readToWriteRatio: 496,
    totalTokens: { input: 60_000, output: 1_920_000, cacheRead: 952_610_000, cacheWrite: 20_670_000 },
    daily: days.map((date, i) => ({
      date,
      cost: Math.round((18 + Math.sin(i / 2.4) * 14 + (i % 7 === 2 ? 46 : 0) + (i > 18 ? 22 : 0)) * 100) / 100,
    })),
  },
  flow: {
    nodes: [
      { id: 'Total spend' }, { id: 'Opus 5' }, { id: 'Sonnet 5' }, { id: 'Haiku 4.5' },
      { id: 'Context re-read' }, { id: 'Context written' }, { id: 'Output' },
      { id: 'Main session' }, { id: 'Subagents' },
    ],
    links: [
      { source: 'Total spend', target: 'Opus 5', value: 1106.96 },
      { source: 'Total spend', target: 'Sonnet 5', value: 85.88 },
      { source: 'Total spend', target: 'Haiku 4.5', value: 36.74 },
      { source: 'Opus 5', target: 'Context re-read', value: 719.03 },
      { source: 'Opus 5', target: 'Context written', value: 296.19 },
      { source: 'Opus 5', target: 'Output', value: 91.63 },
      { source: 'Sonnet 5', target: 'Context re-read', value: 63.85 },
      { source: 'Sonnet 5', target: 'Context written', value: 13.19 },
      { source: 'Sonnet 5', target: 'Output', value: 8.83 },
      { source: 'Haiku 4.5', target: 'Context re-read', value: 26.03 },
      { source: 'Haiku 4.5', target: 'Context written', value: 10.13 },
      { source: 'Haiku 4.5', target: 'Output', value: 0.52 },
      { source: 'Context re-read', target: 'Main session', value: 356.0 },
      { source: 'Context re-read', target: 'Subagents', value: 452.91 },
      { source: 'Context written', target: 'Main session', value: 140.0 },
      { source: 'Context written', target: 'Subagents', value: 179.51 },
      { source: 'Output', target: 'Main session', value: 63.0 },
      { source: 'Output', target: 'Subagents', value: 37.98 },
    ],
  },
  models: [
    { model: 'claude-opus-5', turns: 2711, cost: 1106.96, costPerTurn: 0.41, avgContextRead: 177_000, share: 0.9 },
    { model: 'claude-sonnet-5', turns: 1508, cost: 85.88, costPerTurn: 0.057, avgContextRead: 141_000, share: 0.07 },
    { model: 'claude-haiku-4-5-20251001', turns: 5276, cost: 36.74, costPerTurn: 0.007, avgContextRead: 49_000, share: 0.03 },
  ],
  tools: [
    { name: 'browser_take_screenshot', calls: 48, bytes: 7_340_000, avgTokens: 38_235, annuityCost: 214.4 },
    { name: 'browser_snapshot', calls: 1055, bytes: 6_150_000, avgTokens: 1458, annuityCost: 86.2 },
    { name: 'Read', calls: 270, bytes: 5_910_000, avgTokens: 5475, annuityCost: 71.9 },
    { name: 'Bash', calls: 2004, bytes: 2_480_000, avgTokens: 309, annuityCost: 24.1 },
    { name: 'browser_find', calls: 799, bytes: 2_080_000, avgTokens: 650, annuityCost: 19.8 },
    { name: 'browser_click', calls: 1487, bytes: 820_000, avgTokens: 137, annuityCost: 7.4 },
  ],
  recurring: [
    { label: 'CLAUDE.md + system prompt (jobpilot)', tokensPerSession: 13_380, sessions: 31, monthlyCost: 62.2, kind: 'claude-md' },
    { label: 'MCP tool definitions (playwright plugin)', tokensPerSession: 6225, sessions: 253, monthlyCost: 41.8, kind: 'mcp-tools' },
    { label: 'Skill listing injection', tokensPerSession: 176, sessions: 231, monthlyCost: 3.1, kind: 'skills' },
  ],
  subagents: {
    runs: 167, medianBootTokens: 16_733, p90BootTokens: 17_650, totalCost: 452.91, shareOfTurns: 0.56,
    byParent: [
      { sessionId: 'e5a1f36b', runs: 62, cost: 198.4 },
      { sessionId: 'd6f82b9e', runs: 41, cost: 121.7 },
      { sessionId: 'ae82412f', runs: 33, cost: 78.2 },
      { sessionId: 'b7c1092d', runs: 31, cost: 54.6 },
    ],
  },
  habits: {
    calendar: days.map((day, i) => ({ day, value: Math.round(18 + Math.sin(i / 2.4) * 14 + (i % 7 === 2 ? 46 : 0)) })),
    hourByWeekday: weekdays.flatMap((weekday, wi) =>
      Array.from({ length: 24 }, (_, hour) => ({
        hour, weekday,
        value: hour < 8 || hour > 23 ? 0 : Math.round(Math.max(0, 40 * Math.sin((hour - 7) / 5) + (wi === 2 ? 30 : 0) + (wi > 4 ? 15 : 0))),
      }))),
  },
  rework: {
    errorRate: 0.088,
    cases: [
      { sessionId: 'chalk-1', path: 'chalk/scripts/seed.py', edits: 29, cost: 11.9 },
      { sessionId: 'plan-2', path: '.claude/plans/okay-i-want-to-cuddly-trinket.md', edits: 26, cost: 10.7 },
      { sessionId: 'jp-3', path: 'jobpilot/plugin/skills/apply/SKILL.md', edits: 13, cost: 5.3 },
      { sessionId: 'chalk-4', path: 'chalk/apps/web/app/components/LiveMarket.tsx', edits: 12, cost: 4.9 },
    ],
  },
  loops: {
    cases: [
      { sessionId: 'jp-a', command: 'curl -fsS http://localhost:8000/api/profile', runs: 17, wastedCost: 6.56 },
      { sessionId: 'jp-a', command: 'curl -fsS http://localhost:8000/api/resumes', runs: 16, wastedCost: 6.15 },
      { sessionId: 'jp-b', command: 'UA="Mozilla/5.0..." curl -fsS "$JOBS_URL"', runs: 10, wastedCost: 3.69 },
      { sessionId: 'jp-c', command: 'curl -fsS -X POST "$API/api/review"', runs: 5, wastedCost: 1.64 },
    ],
  },
  advice: [
    {
      id: 'loop-curl', category: 'loop',
      title: 'You ran the same curl 17 times in one session',
      body: 'Each repeat is a full turn, and a full turn re-reads your entire 177k-token context. The 2 KB response is not the cost — the 41 cents per Opus turn is.',
      monthlySaving: 18.04, confidence: 'high',
      fix: 'Wrap the polling call in a script that waits for the condition and prints one line, then call it once.',
      evidence: [{ sessionId: 'jp-a', label: 'curl -fsS .../api/profile x17', turns: 16, cost: 6.56 }],
    },
    {
      id: 'subagent-context', category: 'context',
      title: 'Every subagent boots with the same 17k tokens',
      body: '167 subagent runs, median 16,733 startup tokens, p90 17,650. The tight spread means context is not scoped to the job — a rename agent gets the same payload as an architecture agent.',
      monthlySaving: 96.5, confidence: 'high',
      fix: 'Give each agent only its spec and the files it owns. Cutting boot context in half saves ~1.4M tokens a month.',
      evidence: [{ sessionId: 'e5a1f36b', label: '62 subagent runs from one session', turns: 62, cost: 198.4 }],
    },
    {
      id: 'route-specific', category: 'routing',
      title: '38% of your Opus turns were mechanical edits',
      body: 'High-specificity prompts naming exact files and symbols, producing small diffs with no exploration. Opus costs 7.2x Sonnet per turn.',
      monthlySaving: 143.2, confidence: 'heuristic',
      fix: 'Route specific, bounded prompts to Sonnet. Keep Opus for the vague ones where planning matters.',
      evidence: [{ sessionId: 'jp-b', label: '1,031 high-specificity Opus turns', turns: 1031, cost: 422.7 }],
    },
    {
      id: 'screenshot-annuity', category: 'context',
      title: 'One screenshot costs you $4.47, not once but every turn after',
      body: 'A single browser_take_screenshot returns 153 KB (~38k tokens) and is re-read on every subsequent turn in the session.',
      monthlySaving: 71.5, confidence: 'high',
      fix: 'Use browser_snapshot (5.8 KB) for assertions; save screenshots to disk and read them only when you need to look.',
      evidence: [{ sessionId: 'jp-a', label: '48 screenshots, 7.34 MB total', turns: 48, cost: 214.4 }],
    },
    {
      id: 'plan-mode', category: 'routing',
      title: 'You used plan mode 8 times out of 241 sessions',
      body: 'Your worst rework session edited one file 29 times. Sessions that thrash are the ones where planning first pays.',
      monthlySaving: 34.8, confidence: 'medium',
      fix: 'Start refactor-shaped work in plan mode, then delegate implementation to Sonnet.',
      evidence: [{ sessionId: 'chalk-1', label: 'chalk/scripts/seed.py edited 29x', turns: 29, cost: 11.9 }],
    },
  ],
}
