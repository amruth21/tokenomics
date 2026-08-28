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
    totalCost: 1244.72,
    productiveRateTokens: 0.0031,
    productiveRateDollars: 0.089,
    readToWriteRatio: 317,
    totalTokens: { input: 59_000, output: 3_010_000, cacheRead: 951_920_000, cacheWrite: 20_800_000 },
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
    runs: 168, medianBootTokens: 16_743, p90BootTokens: 17_631, totalCost: 58.79, shareOfTurns: 0.564,
    byParent: [
      { sessionId: 'c42da6f9', runs: 24, cost: 16.4 },
      { sessionId: 'e5a1f36b', runs: 22, cost: 14.9 },
      { sessionId: '843c244a', runs: 19, cost: 11.2 },
      { sessionId: 'd6f82b9e', runs: 12, cost: 8.1 },
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
      { sessionId: '843c244a', command: 'curl -fsS http://localhost:8000/api/credentials', runs: 11, wastedCost: 0.14 },
      { sessionId: '843c244a', command: 'echo waiting', runs: 10, wastedCost: 0.12 },
      { sessionId: '843c244a', command: 'curl -fsS http://localhost:8000/api/resumes', runs: 6, wastedCost: 0.06 },
      { sessionId: '2c19f0b1', command: 'date', runs: 3, wastedCost: 0.02 },
    ],
  },
  advice: [
    {
      id: 'loop-curl', category: 'loop',
      title: 'You ran the same curl 11 times in one session',
      body: 'Each repeat is a full turn that re-reads the whole session context to produce a few bytes. This one ran in a Haiku-heavy session, so the dollar cost is small — but the same pattern in an Opus session costs 41 cents a repeat.',
      monthlySaving: 0.31, confidence: 'high',
      fix: 'Wrap the polling call in a script that waits for the condition and prints one line, then call it once.',
      evidence: [{ sessionId: '843c244a', label: 'curl -fsS .../api/credentials x11', turns: 10, cost: 0.14 }],
    },
    {
      id: 'subagent-context', category: 'context',
      title: 'Your delegation habit is the one thing to keep',
      body: 'Subagents are 56% of your turns but only 4.7% of your spend, because you route that volume to Haiku. Boot context is uniform at ~17k tokens per agent, which is worth tightening — but the habit itself is saving you money, not costing it.',
      monthlySaving: 0.38, confidence: 'medium',
      fix: 'Keep delegating. Scope each agent to its spec and owned files to trim the uniform 17k boot payload.',
      evidence: [{ sessionId: 'c42da6f9', label: '24 subagent boots, ~17k tokens each', turns: 24, cost: 0.12 }],
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
