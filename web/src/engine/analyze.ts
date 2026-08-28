// Two-pass aggregation over the transcript corpus, producing the frozen
// `Analysis` shape. See docs/data-model.md for the traps this code guards
// against (requestId dedup, two-pass tool_use resolution, split cache-write
// pricing, <synthetic> exclusion, file-history-delta being useless for rework).

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

type ToolUseMeta = { name: string; sessionId: string; filePath?: string; command?: string }

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
  timestamp: string
  attachment?: { type?: string }
}

export type ProgressFn = (p: Extract<EngineProgress, { phase: 'scanning' | 'parsing' | 'analyzing' }>) => void

export interface AnalyzeOptions extends SelectFilesOptions {
  source?: Analysis['meta']['source']
}

export async function analyzeFiles(allFiles: File[], onProgress: ProgressFn, opts: AnalyzeOptions = {}): Promise<Analysis> {
  const files = selectFiles(allFiles, opts)
  const filesTotal = files.length || 1

  // ---------- PASS 1 (scanning): tool_use.id -> {name, input} over ALL
  // assistant records, including duplicate requestIds, before any dedup. ----------
  const toolUseMap = new Map<string, ToolUseMeta>()
  let filesDone = 0
  for (const file of files) {
    for await (const { record } of streamFile(file)) {
      if (record.type === 'assistant') {
        const rec = record as unknown as AssistantRecord
        const content = rec.message?.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string') {
              const input = block.input ?? {}
              toolUseMap.set(block.id, {
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

  // ---------- PASS 2 (parsing): dedup by requestId, resolve tool_result
  // payloads via the map built above, and accumulate facts. ----------
  const seenRequestIds = new Set<string>()
  let deduped = 0

  const sessions = new Map<string, SessionFact>()
  const sessionTurnSeq = new Map<string, number>() // running turn index per session
  const turns: TurnFact[] = []
  const toolCalls: ToolCallFact[] = []
  const subagentBoots: SubagentBootFact[] = []

  let errorTotal = 0
  let toolResultTotal = 0

  const recurringFirstTurn = new Map<string, number[]>()
  const sessionRecordedFirstTurn = new Set<string>()
  let skillListingCount = 0
  let deferredToolsCount = 0

  // model/day/calendar/hour aggregates
  const modelAgg = new Map<string, { turns: number; cost: number; cacheReadSum: number }>()
  const dailyCost = new Map<string, number>()
  const hourWeekday = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // token totals for summary
  let totalInput = 0
  let totalOutput = 0
  let totalCacheRead = 0
  let totalCacheWrite = 0

  // flow: token-type -> model -> $
  const flowMatrix = new Map<string, Map<string, number>>()
  const FLOW_COMPONENTS = ['Fresh Input', 'Cache Read', 'Cache Write', 'Output']
  for (const c of FLOW_COMPONENTS) flowMatrix.set(c, new Map())

  // prompts for C1 (prompt specificity)
  const prompts: PromptFact[] = []
  const openPromptBySession = new Map<string, PromptFact | null>()

  let minTs: string | null = null
  let maxTs: string | null = null

  filesDone = 0
  for (const file of files) {
    // Each subagent file boots at most once — track by relPath.
    let bootedThisFile = false

    for await (const { record, relPath } of streamFile(file)) {
      const type = (record as { type?: string }).type

      if (type === 'assistant') {
        const rec = record as unknown as AssistantRecord
        const sessionId = rec.sessionId
        const model = rec.message?.model ?? 'unknown'
        const usage = rec.message?.usage

        if (!minTs || rec.timestamp < minTs) minTs = rec.timestamp
        if (!maxTs || rec.timestamp > maxTs) maxTs = rec.timestamp

        // dedup by requestId — first occurrence wins
        if (seenRequestIds.has(rec.requestId)) {
          deduped++
          continue
        }
        seenRequestIds.add(rec.requestId)

        const cost = costOfUsage(model, usage)
        const outputTokens = usage?.output_tokens ?? 0
        const cacheReadTokens = usage?.cache_read_input_tokens ?? 0
        const freshInput = usage?.input_tokens ?? 0
        const write5m = usage?.cache_creation?.ephemeral_5m_input_tokens ?? 0
        const write1h = usage?.cache_creation?.ephemeral_1h_input_tokens ?? 0

        if (model !== SYNTHETIC_MODEL) {
          totalInput += freshInput
          totalOutput += outputTokens
          totalCacheRead += cacheReadTokens
          totalCacheWrite += write5m + write1h

          const m = modelAgg.get(model) ?? { turns: 0, cost: 0, cacheReadSum: 0 }
          m.turns++
          m.cost += cost
          m.cacheReadSum += cacheReadTokens
          modelAgg.set(model, m)

          const day = rec.timestamp.slice(0, 10)
          dailyCost.set(day, (dailyCost.get(day) ?? 0) + cost)

          const d = new Date(rec.timestamp)
          hourWeekday[d.getUTCDay()][d.getUTCHours()] += cost

          const rate = PRICING[model]
          if (rate) {
            addFlow(flowMatrix, 'Fresh Input', model, (freshInput / 1_000_000) * rate.input)
            addFlow(flowMatrix, 'Cache Read', model, (cacheReadTokens / 1_000_000) * rate.cacheRead)
            addFlow(
              flowMatrix,
              'Cache Write',
              model,
              (write5m / 1_000_000) * rate.cacheWrite5m + (write1h / 1_000_000) * rate.cacheWrite1h,
            )
            addFlow(flowMatrix, 'Output', model, (outputTokens / 1_000_000) * rate.output)
          }
        }

        // session bookkeeping
        let sess = sessions.get(sessionId)
        if (!sess) {
          sess = { sessionId, cwd: rec.cwd ?? '', turnCount: 0, cost: 0, firstTimestamp: rec.timestamp, lastTimestamp: rec.timestamp }
          sessions.set(sessionId, sess)
        }
        sess.turnCount++
        sess.cost += cost
        if (rec.timestamp < sess.firstTimestamp) sess.firstTimestamp = rec.timestamp
        if (rec.timestamp > sess.lastTimestamp) sess.lastTimestamp = rec.timestamp

        const turnIndex = sessionTurnSeq.get(sessionId) ?? 0
        sessionTurnSeq.set(sessionId, turnIndex + 1)

        // first-turn cache_creation floor, per (cwd) -- one sample per session
        if (!sessionRecordedFirstTurn.has(sessionId) && turnIndex === 0 && rec.cwd) {
          sessionRecordedFirstTurn.add(sessionId)
          const arr = recurringFirstTurn.get(rec.cwd) ?? []
          arr.push((usage?.cache_creation?.ephemeral_1h_input_tokens ?? 0) + (usage?.cache_creation?.ephemeral_5m_input_tokens ?? 0))
          recurringFirstTurn.set(rec.cwd, arr)
        }

        // subagent boot: first (unique, post-dedup) assistant record of a
        // sidechain file is the boot record.
        if (rec.isSidechain && relPath.includes('/subagents/') && !bootedThisFile) {
          bootedThisFile = true
          subagentBoots.push({
            sessionId,
            file: relPath,
            tokens: freshInput + cacheReadTokens + (usage?.cache_creation?.ephemeral_1h_input_tokens ?? 0) + (usage?.cache_creation?.ephemeral_5m_input_tokens ?? 0),
            timestamp: rec.timestamp,
          })
        }

        // tool_use blocks -> ToolCallFact rows (name/session/turnIndex only;
        // payload size/error resolved when we hit the matching tool_result).
        const content = rec.message?.content
        let toolCallCount = 0
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string') {
              toolCallCount++
              const input = block.input ?? {}
              const command = typeof input.command === 'string' ? input.command : undefined
              toolCalls.push({
                id: block.id,
                name: block.name,
                sessionId,
                turnIndex,
                timestamp: rec.timestamp,
                model,
                command,
                normCommand: command ? normalizeCommand(command) : undefined,
                filePath: typeof input.file_path === 'string' ? input.file_path : undefined,
                bytes: 0,
                tokens: 0,
                isError: false,
              })
            }
          }
        }

        turns.push({
          requestId: rec.requestId,
          sessionId,
          turnIndex,
          timestamp: rec.timestamp,
          model,
          cost,
          isSidechain: !!rec.isSidechain,
          outputTokens,
          cacheReadTokens,
          toolCallCount,
        })

        // close out any open prompt tracking for this session with this turn's stats
        const open = openPromptBySession.get(sessionId)
        if (open) {
          open.followingCost += cost
          open.followingTurns += 1
          open.followingToolCalls += toolCallCount
          open.followingOutputTokens += outputTokens
          if (!open.followingModel) open.followingModel = model
        }
      } else if (type === 'user') {
        const rec = record as unknown as UserRecord
        const content = rec.message?.content

        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === 'tool_result' && typeof block.tool_use_id === 'string') {
              const meta = toolUseMap.get(block.tool_use_id)
              const call = findToolCallById(toolCalls, block.tool_use_id)
              const bytes = estimateBytes(block.content)
              toolResultTotal++
              const isError = !!block.is_error
              if (isError) errorTotal++
              if (call) {
                call.bytes = bytes
                call.tokens = Math.round(bytes / 4)
                call.isError = isError
                if (isError) call.errorClass = classifyError(block.content)
                if (!call.name && meta) call.name = meta.name
              }
            }
          }
        } else if (typeof content === 'string' && !rec.isMeta && !rec.isSidechain) {
          // Real (non-tool-result) user turn -> candidate prompt for C1.
          const text = content
          if (isRealPrompt(text)) {
            const prompt: PromptFact = {
              sessionId: rec.sessionId,
              text,
              timestamp: rec.timestamp,
              followingCost: 0,
              followingTurns: 0,
              followingToolCalls: 0,
              followingOutputTokens: 0,
              followingModel: null,
            }
            prompts.push(prompt)
            openPromptBySession.set(rec.sessionId, prompt)
          } else {
            openPromptBySession.set(rec.sessionId, null)
          }
        }
      } else if (type === 'attachment') {
        const rec = record as unknown as AttachmentRecord
        const t = rec.attachment?.type
        if (t === 'skill_listing') skillListingCount++
        else if (t === 'deferred_tools_delta') deferredToolsCount++
      }
    }

    filesDone++
    onProgress({ phase: 'parsing', filesDone, filesTotal })
  }

  onProgress({ phase: 'analyzing', filesDone: filesTotal, filesTotal })

  // ---------- Build the Facts object rules/* consume ----------
  const facts: Facts = {
    toolCalls,
    turns,
    sessions,
    prompts,
    subagentBoots,
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
  const productiveOutputTokens = totalOutput
  const allTokens = totalInput + totalOutput + totalCacheRead + totalCacheWrite
  const productiveRateTokens = allTokens > 0 ? productiveOutputTokens / allTokens : 0
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
      annuityCost: annuityCostForTool(name, toolCalls, sessions, sessionTurnSeq),
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

function findToolCallById(calls: ToolCallFact[], id: string): ToolCallFact | undefined {
  // Linear scan is fine here for correctness-first; called once per tool_result.
  // (Corpus scale: ~10k tool results — acceptable in a worker.)
  for (let i = calls.length - 1; i >= 0; i--) {
    if (calls[i].id === id) return calls[i]
  }
  return undefined
}

export function normalizeCommand(cmd: string): string {
  let c = cmd.trim()
  // strip leading VAR=val env-prefixes
  c = c.replace(/^(?:[A-Z_][A-Z0-9_]*=\S+\s+)+/, '')
  // collapse whitespace
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

function annuityCostForTool(
  name: string,
  toolCalls: ToolCallFact[],
  _sessions: Map<string, SessionFact>,
  sessionTurnSeq: Map<string, number>,
): number {
  let total = 0
  for (const call of toolCalls) {
    if (call.name !== name || call.tokens <= 0) continue
    const sessionTurns = sessionTurnSeq.get(call.sessionId) ?? 0
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
    // representative rate: blended cacheWrite1h (most first-turn cache creation is a fresh 1h write)
    const dollarsPerSession = (avg / 1_000_000) * 30 // $/Mtok for 1h write, opus-class; conservative blended default
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
