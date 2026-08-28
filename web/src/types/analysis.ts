// THE CONTRACT. Frozen. Changes come from the lead agent only.
// Every number here is display-ready. Views do no token math and no pricing math.

export type ModelId =
  | 'claude-opus-5' | 'claude-opus-4-8' | 'claude-sonnet-5' | 'claude-haiku-4-5-20251001'

export type Confidence = 'high' | 'medium' | 'heuristic'

export type Evidence = {
  sessionId: string
  label: string           // human-readable: "curl -fsS .../api/profile x17"
  turns: number
  cost: number
}

export type Recommendation = {
  id: string
  category: 'loop' | 'context' | 'routing' | 'habit'
  title: string           // advisor voice, second person
  body: string
  monthlySaving: number
  confidence: Confidence
  fix: string             // one concrete action
  evidence: Evidence[]
}

export type Analysis = {
  meta: {
    sessions: number
    turns: number
    deduped: number       // records skipped as duplicate requestIds
    from: string          // ISO date
    to: string
    source: 'demo' | 'local' | 'import'
  }
  summary: {
    totalCost: number
    productiveRateTokens: number   // 0..1
    productiveRateDollars: number  // 0..1
    readToWriteRatio: number       // e.g. 496
    totalTokens: { input: number; output: number; cacheRead: number; cacheWrite: number }
    daily: { date: string; cost: number }[]
  }
  flow: {
    nodes: { id: string }[]
    links: { source: string; target: string; value: number }[]
  }
  models: {
    model: ModelId | string
    turns: number
    cost: number
    costPerTurn: number
    avgContextRead: number
    share: number          // share of total dollars, 0..1
  }[]
  tools: {
    name: string
    calls: number
    bytes: number
    avgTokens: number
    annuityCost: number    // re-read cost across remaining turns
  }[]
  recurring: {
    label: string
    tokensPerSession: number
    sessions: number
    monthlyCost: number
    kind: 'claude-md' | 'mcp-tools' | 'skills' | 'system'
  }[]
  subagents: {
    runs: number
    medianBootTokens: number
    p90BootTokens: number
    totalCost: number
    shareOfTurns: number   // 0..1
    byParent: { sessionId: string; runs: number; cost: number }[]
  }
  habits: {
    calendar: { day: string; value: number }[]        // nivo calendar
    hourByWeekday: { hour: number; weekday: string; value: number }[]
  }
  rework: {
    errorRate: number
    cases: { sessionId: string; path: string; edits: number; cost: number }[]
  }
  loops: {
    cases: { sessionId: string; command: string; runs: number; wastedCost: number }[]
  }
  advice: Recommendation[]
}

export type EngineProgress =
  | { phase: 'scanning' | 'parsing' | 'analyzing'; filesDone: number; filesTotal: number }
  | { phase: 'done'; analysis: Analysis }
  | { phase: 'error'; message: string }
