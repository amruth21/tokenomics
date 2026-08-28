// Three-pass aggregation over the transcript corpus, producing the frozen
// `Analysis` shape. See docs/data-model.md for the traps this code guards
// against:
//
//   1. requestId duplicates are progressive streaming saves and usage grows
//      monotonically — the LAST occurrence per requestId must win (first-wins
//      undercounts output by ~42%). We can't decide "last" until we've seen
//      every occurrence, so dedup happens as an in-memory finalize step
//      between two file-reading passes, not as a single streaming skip.
//   2. tool_use id -> name/input must be resolved from ALL assistant records
//      (incl. duplicates) before dedup, then tool_results are matched only
//      against the ids that survive into the kept (last) turn.
//   3. cache_creation splits ephemeral_5m (1.25x) and ephemeral_1h (2x) — never
//      collapsed into one bucket.
//   4. Self-referential corpus exclusion must check the record's own `cwd`,
//      not just the file path — this project's subagent transcripts are filed
//      under the parent session's (non-Buildathon) directory while carrying
//      cwd: ".../Buildathon/...".

import type { Analysis, ModelId, Recommendation, EngineProgress } from '../types/analysis'
import { selectFiles, streamFile, type SelectFilesOptions } from './parse'
import { costOfUsage, PRICING, SYNTHETIC_MODEL, type UsageLike } from './pricing'
import type { Facts, ToolCallFact, TurnFact, SessionFact, PromptFact, SubagentBootFact } from './facts'

import { detectToolLoops } from '../rules/loops'
import { detectRepeatReads } from '../rules/repeatReads'
import { detectRework } from '../rules/rework'
import { detectErrorRate } from '../rules/errors'
import { detectFatPayloads } from '../rules/fatPayloads'
import { detectSubagentBoot } from '../rules/subagentBoot'
import { detectRecurringCharges } from '../rules/recurring'
import { detectPromptSpecificity } from '../rules/specificity'

const EXCLUDE_CWD_SUBSTRING = 'Documents/Buildathon'

type ContentBlock = {
  type?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  text?: string
  tool_use_id?: string
  is_error?: boolean
  content?: unknown
}

type AssistantRecord = {
  type: 'assistant'
  sessionId: string
  cwd?: string
  uuid: string
  timestamp: string
  requestId: string
  isSidechain?: boolean
  message?: { model?: string; content?: ContentBlock[]; usage?: UsageLike }
}

type UserRecord = {
  type: 'user'
  sessionId: string
  cwd?: string
  uuid: string
  timestamp: string
  isSidechain?: boolean
  isMeta?: boolean
  promptId?: string
  message?: { content?: string | ContentBlock[] }
}

type AttachmentRecord = {
  type: 'attachment'
  sessionId: string
  cwd?: string
  timestamp: string
  attachment?: { type?: string }
}

type ToolUseMeta = { id: string; name: string; filePath?: string; command?: string }

/** One assistant record's extracted essentials, keyed by requestId. Only the
 * LAST occurrence for a given requestId is retained (see trap #1 above). */
type KeptTurn = {
  sessionId: string
  cwd: string
  relPath: string
  timestamp: string
  requestId: string
  model: string
  isSidechain: boolean
  freshInput: number
  output: number
  cacheRead: number
  write5m: number
  write1h: number
  cost: number
  toolUse: ToolUseMeta[]
}

export type ProgressFn = (p: Extract<EngineProgress, { phase: 'scanning' | 'parsing' | 'analyzing' }>) => void

export interface AnalyzeOptions extends SelectFilesOptions {
  source?: Analysis['meta']['source']
}

function isExcluded(cwd: string | undefined): boolean {
  return !!cwd && cwd.includes(EXCLUDE_CWD_SUBSTRING)
}

export async function analyzeFiles(allFiles: File[], onProgress: ProgressFn, opts: AnalyzeOptions = {}): Promise<Analysis> {
  const files = selectFiles(allFiles, opts) // file-path-level exclusion (cheap, catches most of it)
  const filesTotal = files.length || 1

  // ---------- PASS 1 (scanning): tool_use.id -> meta over ALL assistant
  // records, including duplicate requestIds, before any dedup decision. ----------
  const toolUseMap = new Map<string, ToolUseMeta & { sessionId: string }>()
  let filesDone = 0
  for (const file of files) {
    for await (const { record } of streamFile(file)) {
      if (record.type === 'assistant') {
        const rec = record as unknown as AssistantRecord
        if (isExcluded(rec.cwd)) continue
        const content = rec.message?.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string') {
              const input = block.input ?? {}
              toolUseMap.set(block.id, {
                id: block.id,
                name: block.name,
                sessionId: rec.sessionId,
                filePath: typeof input.file_path === 'string' ? input.file_path : undefined,
                command: typeof input.command === 'string' ? input.command : undefined,
              })
            }
          }
        }
      }
    }
    filesDone++
    onProgress({ phase: 'scanning', filesDone, filesTotal })
  }

  // ---------- PASS 2 (parsing, assistant dedup): keep the LAST occurrence
  // per requestId. Duplicates are progressive streaming saves; usage never
  // shrinks, so "last" == "most complete" (== per-request max). ----------
  const kept = new Map<string, KeptTurn>()
  let assistantSeenCount = 0

  filesDone = 0
  for (const file of files) {
    for await (const { record, relPath } of streamFile(file)) {
      if (record.type !== 'assistant') continue
      const rec = record as unknown as AssistantRecord
      if (isExcluded(rec.cwd)) continue

      assistantSeenCount++
      const model = rec.message?.model ?? 'unknown'
      const usage = rec.message?.usage
      const content = rec.message?.content
      const toolUse: ToolUseMeta[] = []
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string') {
            const input = block.input ?? {}
            toolUse.push({
              id: block.id,
              name: block.name,
              filePath: typeof input.file_path === 'string' ? input.file_path : undefined,
              command: typeof input.command === 'string' ? input.command : undefined,
            })
          }
        }
      }

      kept.set(rec.requestId, {
        sessionId: rec.sessionId,
        cwd: rec.cwd ?? '',
        relPath,
        timestamp: rec.timestamp,
        requestId: rec.requestId,
        model,
        isSidechain: !!rec.isSidechain,
        freshInput: usage?.input_tokens ?? 0,
        output: usage?.output_tokens ?? 0,
        cacheRead: usage?.cache_read_input_tokens ?? 0,
        write5m: usage?.cache_creation?.ephemeral_5m_input_tokens ?? 0,
        write1h: usage?.cache_creation?.ephemeral_1h_input_tokens ?? 0,
        cost: costOfUsage(model, usage),
        toolUse,
      })
    }
    filesDone++
    onProgress({ phase: 'parsing', filesDone, filesTotal })
  }

  const deduped = assistantSeenCount - kept.size

  // ---------- Finalize turn order (in-memory, no file re-read) ----------
  const keptTurns = [...kept.values()].sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0))

  const sessions = new Map<string, SessionFact>()
  const sessionTurnCount = new Map<string, number>()
  const turns: TurnFact[] = []
  const toolCalls: ToolCallFact[] = []
  const toolCallById = new Map<string, ToolCallFact>()
  const subagentBootByFile = new Map<string, SubagentBootFact>()
  const recurringFirstTurn = new Map<string, number[]>()
  const sessionFirstTurnRecorded = new Set<string>()

  const modelAgg = new Map<string, { turns: number; cost: number; cacheReadSum: number }>()
  const dailyCost = new Map<string, number>()
  const hourWeekday = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const flowMatrix = new Map<string, Map<string, number>>()
  const FLOW_COMPONENTS = ['Fresh Input', 'Cache Read', 'Cache Write', 'Output']
  for (const c of FLOW_COMPONENTS) flowMatrix.set(c, new Map())

  let totalInput = 0
  let totalOutput = 0
  let totalCacheRead = 0
  let totalCacheWrite = 0
  let minTs: string | null = null
  let maxTs: string | null = null

  for (const t of keptTurns) {
    const turnIndex = sessionTurnCount.get(t.sessionId) ?? 0
    sessionTurnCount.set(t.sessionId, turnIndex + 1)

    let sess = sessions.get(t.sessionId)
    if (!sess) {
      sess = { sessionId: t.sessionId, cwd: t.cwd, turnCount: 0, cost: 0, firstTimestamp: t.timestamp, lastTimestamp: t.timestamp }
      sessions.set(t.sessionId, sess)
    }
    sess.turnCount++
    sess.cost += t.cost
    if (t.timestamp < sess.firstTimestamp) sess.firstTimestamp = t.timestamp
    if (t.timestamp > sess.lastTimestamp) sess.lastTimestamp = t.timestamp

    if (!minTs || t.timestamp < minTs) minTs = t.timestamp
    if (!maxTs || t.timestamp > maxTs) maxTs = t.timestamp

    if (t.model !== SYNTHETIC_MODEL) {
      totalInput += t.freshInput
      totalOutput += t.output
      totalCacheRead += t.cacheRead
      totalCacheWrite += t.write5m + t.write1h

      const m = modelAgg.get(t.model) ?? { turns: 0, cost: 0, cacheReadSum: 0 }
      m.turns++
      m.cost += t.cost
      m.cacheReadSum += t.cacheRead
      modelAgg.set(t.model, m)

      const day = t.timestamp.slice(0, 10)
      dailyCost.set(day, (dailyCost.get(day) ?? 0) + t.cost)

      const d = new Date(t.timestamp)
      hourWeekday[d.getUTCDay()][d.getUTCHours()] += t.cost

      const rate = PRICING[t.model]
      if (rate) {
        addFlow(flowMatrix, 'Fresh Input', t.model, (t.freshInput / 1_000_000) * rate.input)
        addFlow(flowMatrix, 'Cache Read', t.model, (t.cacheRead / 1_000_000) * rate.cacheRead)
        addFlow(flowMatrix, 'Cache Write', t.model, (t.write5m / 1_000_000) * rate.cacheWrite5m + (t.write1h / 1_000_000) * rate.cacheWrite1h)
        addFlow(flowMatrix, 'Output', t.model, (t.output / 1_000_000) * rate.output)
      }
    }

    if (!sessionFirstTurnRecorded.has(t.sessionId) && turnIndex === 0) {
      sessionFirstTurnRecorded.add(t.sessionId)
      const arr = recurringFirstTurn.get(t.cwd) ?? []
      arr.push(t.write1h + t.write5m)
      recurringFirstTurn.set(t.cwd, arr)
    }

    if (t.isSidechain && t.relPath.includes('/subagents/') && !subagentBootByFile.has(t.relPath)) {
      subagentBootByFile.set(t.relPath, {
        sessionId: t.sessionId,
        file: t.relPath,
        tokens: t.freshInput + t.cacheRead + t.write1h + t.write5m,
        timestamp: t.timestamp,
      })
    }

    for (const tu of t.toolUse) {
      const call: ToolCallFact = {
        id: tu.id,
        name: tu.name,
        sessionId: t.sessionId,
        turnIndex,
        timestamp: t.timestamp,
        model: t.model,
        command: tu.command,
        normCommand: tu.command ? normalizeCommand(tu.command) : undefined,
        filePath: tu.filePath,
        bytes: 0,
        tokens: 0,
        isError: false,
      }
      toolCalls.push(call)
      toolCallById.set(tu.id, call)
    }

    turns.push({
      requestId: t.requestId,
      sessionId: t.sessionId,
      turnIndex,
      timestamp: t.timestamp,
      model: t.model,
      cost: t.cost,
      isSidechain: t.isSidechain,
      outputTokens: t.output,
      cacheReadTokens: t.cacheRead,
      toolCallCount: t.toolUse.length,
    })
  }

  // ---------- PASS 3 (parsing, user + attachment records): resolve
  // tool_result payloads against the kept tool_use ids, and collect real
  // user prompts for C1. ----------
  const prompts: PromptFact[] = []
  let errorTotal = 0
  let toolResultTotal = 0
  let skillListingCount = 0
  let deferredToolsCount = 0

  filesDone = 0
  for (const file of files) {
    for await (const { record } of streamFile(file)) {
      const type = (record as { type?: string }).type

      if (type === 'user') {
        const rec = record as unknown as UserRecord
        if (isExcluded(rec.cwd)) continue
        const content = rec.message?.content

        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === 'tool_result' && typeof block.tool_use_id === 'string') {
              const call = toolCallById.get(block.tool_use_id)
              if (!call) continue // superseded by a duplicate that lost to last-wins, or belongs to an excluded record
              const bytes = estimateBytes(block.content)
              toolResultTotal++
              const isErr = !!block.is_error
              if (isErr) errorTotal++
              call.bytes = bytes
              call.tokens = Math.round(bytes / 4)
              call.isError = isErr
              if (isErr) call.errorClass = classifyError(block.content)
            }
          }
        } else if (typeof content === 'string' && !rec.isMeta && !rec.isSidechain) {
          const text = content
          if (isRealPrompt(text)) {
            prompts.push({
              sessionId: rec.sessionId,
              text,
              timestamp: rec.timestamp,
              followingCost: 0,
              followingTurns: 0,
              followingToolCalls: 0,
              followingOutputTokens: 0,
              followingModel: null,
            })
          }
        }
      } else if (type === 'attachment') {
        const rec = record as unknown as AttachmentRecord
        if (isExcluded(rec.cwd)) continue
        const t = rec.attachment?.type
        if (t === 'skill_listing') skillListingCount++
        else if (t === 'deferred_tools_delta') deferredToolsCount++
      }
    }
    filesDone++
    onProgress({ phase: 'parsing', filesDone, filesTotal })
  }

  onProgress({ phase: 'analyzing', filesDone: filesTotal, filesTotal })

  // ---------- Attribute turns to prompts (C1): per session, walk turns in
  // order and accumulate into the most recent prompt at or before it. ----------
  const promptsBySession = new Map<string, PromptFact[]>()
  for (const p of prompts) {
    const arr = promptsBySession.get(p.sessionId) ?? []
    arr.push(p)
    promptsBySession.set(p.sessionId, arr)
  }
  for (const arr of promptsBySession.values()) arr.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))

  const promptCursor = new Map<string, number>()
  for (const t of keptTurns) {
    const arr = promptsBySession.get(t.sessionId)
    if (!arr || arr.length === 0) continue
    let idx = promptCursor.get(t.sessionId) ?? 0
    while (idx + 1 < arr.length && arr[idx + 1].timestamp <= t.timestamp) idx++
    promptCursor.set(t.sessionId, idx)
    const prompt = arr[idx]
    if (prompt.timestamp <= t.timestamp) {
      prompt.followingCost += t.cost
      prompt.followingTurns += 1
      prompt.followingToolCalls += t.toolUse.length
      prompt.followingOutputTokens += t.output
      if (!prompt.followingModel) prompt.followingModel = t.model
    }
  }

  // ---------- Build the Facts object rules/* consume ----------
  const facts: Facts = {
    toolCalls,
    turns,
    sessions,
    prompts,
    subagentBoots: [...subagentBootByFile.values()],
    errorTotal,
    toolResultTotal,
    recurringFirstTurn,
    attachmentCounts: { skillListing: skillListingCount, deferredTools: deferredToolsCount },
  }

  const loopRecs = detectToolLoops(facts)
  const reworkRecs = detectRework(facts)
  const advice: Recommendation[] = [
    ...loopRecs,
    ...detectRepeatReads(facts),
    ...reworkRecs,
    ...detectErrorRate(facts),
    ...detectFatPayloads(facts),
    ...detectSubagentBoot(facts),
    ...detectRecurringCharges(facts),
    ...detectPromptSpecificity(facts),
  ]

  // ---------- Assemble Analysis ----------
  const totalCost = [...modelAgg.values()].reduce((s, m) => s + m.cost, 0)
  const allTokens = totalInput + totalOutput + totalCacheRead + totalCacheWrite
  const productiveRateTokens = allTokens > 0 ? totalOutput / allTokens : 0
  const outputDollars = sumFlowForComponent(flowMatrix, 'Output')
  const productiveRateDollars = totalCost > 0 ? outputDollars / totalCost : 0
  const readToWriteRatio = totalOutput > 0 ? totalCacheRead / totalOutput : 0

  const models: Analysis['models'] = [...modelAgg.entries()]
    .filter(([model]) => model !== SYNTHETIC_MODEL && model !== 'unknown')
    .map(([model, m]) => ({
      model: model as ModelId,
      turns: m.turns,
      cost: m.cost,
      costPerTurn: m.turns > 0 ? m.cost / m.turns : 0,
      avgContextRead: m.turns > 0 ? m.cacheReadSum / m.turns : 0,
      share: totalCost > 0 ? m.cost / totalCost : 0,
    }))
    .sort((a, b) => b.cost - a.cost)

  const toolAgg = new Map<string, { calls: number; bytes: number; tokens: number }>()
  for (const call of toolCalls) {
    const t = toolAgg.get(call.name) ?? { calls: 0, bytes: 0, tokens: 0 }
    t.calls++
    t.bytes += call.bytes
    t.tokens += call.tokens
    toolAgg.set(call.name, t)
  }
  const tools: Analysis['tools'] = [...toolAgg.entries()]
    .map(([name, t]) => ({
      name,
      calls: t.calls,
      bytes: t.bytes,
      avgTokens: t.calls > 0 ? t.tokens / t.calls : 0,
      annuityCost: annuityCostForTool(name, toolCalls, sessionTurnCount),
    }))
    .sort((a, b) => b.bytes - a.bytes)

  const flowNodesSet = new Set<string>()
  const flowLinks: { source: string; target: string; value: number }[] = []
  for (const [component, byModel] of flowMatrix) {
    for (const [model, value] of byModel) {
      if (value <= 0) continue
      flowNodesSet.add(component)
      flowNodesSet.add(model)
      flowLinks.push({ source: component, target: model, value })
    }
  }
  flowNodesSet.add('Total Spend')
  for (const [model, m] of modelAgg) {
    if (model === SYNTHETIC_MODEL || model === 'unknown' || m.cost <= 0) continue
    flowLinks.push({ source: model, target: 'Total Spend', value: m.cost })
  }

  const daily = [...dailyCost.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, cost]) => ({ date, cost }))
  const calendar = daily.map((d) => ({ day: d.date, value: d.cost }))
  const habitsHourByWeekday: Analysis['habits']['hourByWeekday'] = []
  for (let w = 0; w < 7; w++) {
    for (let h = 0; h < 24; h++) {
      habitsHourByWeekday.push({ hour: h, weekday: WEEKDAYS[w], value: hourWeekday[w][h] })
    }
  }

  const analysis: Analysis = {
    meta: {
      sessions: sessions.size,
      turns: turns.length,
      deduped,
      from: (minTs ?? '').slice(0, 10),
      to: (maxTs ?? '').slice(0, 10),
      source: opts.source ?? 'local',
    },
    summary: {
      totalCost,
      productiveRateTokens,
      productiveRateDollars,
      readToWriteRatio,
      totalTokens: { input: totalInput, output: totalOutput, cacheRead: totalCacheRead, cacheWrite: totalCacheWrite },
      daily,
    },
    flow: { nodes: [...flowNodesSet].map((id) => ({ id })), links: flowLinks },
    models,
    tools,
    recurring: buildRecurring(facts),
    subagents: buildSubagents(facts),
    habits: { calendar, hourByWeekday: habitsHourByWeekday },
    rework: { errorRate: toolResultTotal > 0 ? errorTotal / toolResultTotal : 0, cases: reworkCasesFromRecs(reworkRecs) },
    loops: { cases: loopCasesFromRecs(loopRecs) },
    advice,
  }

  return analysis
}

// ---------------- helpers ----------------

function addFlow(matrix: Map<string, Map<string, number>>, component: string, model: string, value: number) {
  if (value <= 0) return
  const byModel = matrix.get(component)!
  byModel.set(model, (byModel.get(model) ?? 0) + value)
}

function sumFlowForComponent(matrix: Map<string, Map<string, number>>, component: string): number {
  const byModel = matrix.get(component)
  if (!byModel) return 0
  let s = 0
  for (const v of byModel.values()) s += v
  return s
}

export function normalizeCommand(cmd: string): string {
  let c = cmd.trim()
  c = c.replace(/^(?:[A-Z_][A-Z0-9_]*=\S+\s+)+/, '')
  c = c.replace(/\s+/g, ' ')
  return c
}

function isRealPrompt(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (t.startsWith('<')) return false
  if (/^Skill\s+\S+\s+is already loaded/i.test(t)) return false
  if (/^Launching skill/i.test(t)) return false
  if (t.startsWith('[Request interrupted')) return false
  return true
}

function estimateBytes(content: unknown): number {
  if (typeof content === 'string') return content.length
  try {
    return JSON.stringify(content ?? '').length
  } catch {
    return 0
  }
}

function classifyError(content: unknown): string {
  const text = typeof content === 'string' ? content : JSON.stringify(content ?? '')
  const lower = text.toLowerCase()
  if (lower.includes('command not found')) return 'command not found'
  if (lower.includes('no such file')) return 'no such file or directory'
  if (lower.includes('permission denied')) return 'permission denied'
  if (lower.includes('enoent')) return 'enoent'
  if (lower.includes('timeout') || lower.includes('timed out')) return 'timeout'
  return 'other'
}

function annuityCostForTool(name: string, toolCalls: ToolCallFact[], sessionTurnCounts: Map<string, number>): number {
  let total = 0
  for (const call of toolCalls) {
    if (call.name !== name || call.tokens <= 0) continue
    const sessionTurns = sessionTurnCounts.get(call.sessionId) ?? 0
    const remaining = Math.max(0, sessionTurns - call.turnIndex - 1)
    const rate = PRICING[call.model]?.cacheRead ?? 0.3
    total += (call.tokens / 1_000_000) * rate * remaining
  }
  return total
}

function buildRecurring(facts: Facts): Analysis['recurring'] {
  const out: Analysis['recurring'] = []
  for (const [cwd, samples] of facts.recurringFirstTurn) {
    if (samples.length === 0) continue
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length
    const dollarsPerSession = (avg / 1_000_000) * 30
    out.push({
      label: `${shortCwd(cwd)} session boot`,
      tokensPerSession: avg,
      sessions: samples.length,
      monthlyCost: dollarsPerSession * samples.length,
      kind: 'claude-md',
    })
  }
  if (facts.attachmentCounts.skillListing > 0) {
    out.push({
      label: 'skill_listing injection',
      tokensPerSession: 176,
      sessions: facts.attachmentCounts.skillListing,
      monthlyCost: (176 / 1_000_000) * 3 * facts.attachmentCounts.skillListing,
      kind: 'skills',
    })
  }
  if (facts.attachmentCounts.deferredTools > 0) {
    out.push({
      label: 'deferred_tools_delta injection',
      tokensPerSession: 1500,
      sessions: facts.attachmentCounts.deferredTools,
      monthlyCost: (1500 / 1_000_000) * 3 * facts.attachmentCounts.deferredTools,
      kind: 'mcp-tools',
    })
  }
  return out.sort((a, b) => b.monthlyCost - a.monthlyCost)
}

function buildSubagents(facts: Facts): Analysis['subagents'] {
  const boots = facts.subagentBoots
  const tokensSorted = boots.map((b) => b.tokens).sort((a, b) => a - b)
  const median = percentile(tokensSorted, 0.5)
  const p90 = percentile(tokensSorted, 0.9)
  const sidechainTurns = facts.turns.filter((t) => t.isSidechain)
  const cost = sidechainTurns.reduce((s, t) => s + t.cost, 0)
  const byParentMap = new Map<string, { runs: number; cost: number }>()
  for (const b of boots) {
    const e = byParentMap.get(b.sessionId) ?? { runs: 0, cost: 0 }
    e.runs++
    byParentMap.set(b.sessionId, e)
  }
  for (const t of sidechainTurns) {
    const e = byParentMap.get(t.sessionId)
    if (e) e.cost += t.cost
  }
  return {
    runs: boots.length,
    medianBootTokens: median,
    p90BootTokens: p90,
    totalCost: cost,
    shareOfTurns: facts.turns.length > 0 ? sidechainTurns.length / facts.turns.length : 0,
    byParent: [...byParentMap.entries()]
      .map(([sessionId, e]) => ({ sessionId, runs: e.runs, cost: e.cost }))
      .sort((a, b) => b.cost - a.cost),
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))
  return sorted[idx]
}

function shortCwd(cwd: string): string {
  const parts = cwd.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? cwd
}

function reworkCasesFromRecs(recs: Recommendation[]): Analysis['rework']['cases'] {
  const cases: Analysis['rework']['cases'] = []
  for (const r of recs) {
    for (const e of r.evidence) {
      cases.push({ sessionId: e.sessionId, path: e.label, edits: e.turns, cost: e.cost })
    }
  }
  return cases
}

function loopCasesFromRecs(recs: Recommendation[]): Analysis['loops']['cases'] {
  const cases: Analysis['loops']['cases'] = []
  for (const r of recs) {
    for (const e of r.evidence) {
      cases.push({ sessionId: e.sessionId, command: e.label, runs: e.turns, wastedCost: e.cost })
    }
  }
  return cases
}
