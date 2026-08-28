// Intermediate aggregates produced by analyze.ts's two-pass ingest, and
// consumed by the rules/* detectors. Not part of the frozen Analysis
// contract — this is the engine's own working shape.

export type ToolCallFact = {
  id: string
  name: string
  sessionId: string
  /** Sequential index of the owning assistant turn within its session (0-based). */
  turnIndex: number
  timestamp: string
  model: string
  command?: string
  normCommand?: string
  filePath?: string
  bytes: number
  tokens: number
  isError: boolean
  errorClass?: string
}

export type TurnFact = {
  requestId: string
  sessionId: string
  turnIndex: number
  timestamp: string
  model: string
  cost: number
  isSidechain: boolean
  outputTokens: number
  cacheReadTokens: number
  toolCallCount: number
}

export type SessionFact = {
  sessionId: string
  cwd: string
  turnCount: number
  cost: number
  firstTimestamp: string
  lastTimestamp: string
}

export type PromptFact = {
  sessionId: string
  text: string
  timestamp: string
  /** cost/turns/tool-calls/output-tokens attributed to the turns that followed this prompt,
   * up to the next real user prompt. */
  followingCost: number
  followingTurns: number
  followingToolCalls: number
  followingOutputTokens: number
  followingModel: string | null
}

export type SubagentBootFact = {
  sessionId: string
  file: string
  tokens: number
  timestamp: string
}

export type Facts = {
  toolCalls: ToolCallFact[]
  turns: TurnFact[]
  sessions: Map<string, SessionFact>
  prompts: PromptFact[]
  subagentBoots: SubagentBootFact[]
  errorTotal: number
  toolResultTotal: number
  /** cwd -> first-turn cache_creation tokens, one entry per session in that cwd. */
  recurringFirstTurn: Map<string, number[]>
  attachmentCounts: { skillListing: number; deferredTools: number }
}
