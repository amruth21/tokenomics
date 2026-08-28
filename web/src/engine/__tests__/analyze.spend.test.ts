// Pins total spend against a small synthetic fixture so a pricing or dedup
// regression is loud. Uses a tiny hand-built transcript (not the real
// corpus) so the assertion is exact and fast.
//
// NOTE: vitest is not present in this repo's devDependencies and this agent
// does not own package.json (out of scope per its file-ownership brief), so
// this test cannot currently be run via `npm test`. Once `vitest` is added
// as a devDependency and a `test` script wired up, this file runs as-is.

import { describe, expect, it } from 'vitest'
import { analyzeFiles } from '../analyze'

function makeFile(name: string, lines: unknown[]): File {
  const body = lines.map((l) => JSON.stringify(l)).join('\n') + '\n'
  const file = new File([body], name, { type: 'application/x-ndjson' })
  Object.defineProperty(file, 'webkitRelativePath', { value: `projects/-Users-test/${name}`, writable: false })
  return file
}

const SESSION = 'sess-1'
const CWD = '/Users/test/project'

describe('analyzeFiles — pinned spend', () => {
  it('dedupes requestId by last occurrence and computes exact $ from pricing.json', async () => {
    // Two occurrences of the SAME requestId (progressive streaming save) —
    // the second (larger) usage must win, per docs/data-model.md trap #1.
    const dupFirst = {
      type: 'assistant',
      sessionId: SESSION,
      cwd: CWD,
      uuid: 'u1',
      timestamp: '2026-08-01T10:00:00.000Z',
      requestId: 'req-1',
      isSidechain: false,
      message: {
        model: 'claude-sonnet-5',
        content: [{ type: 'tool_use', id: 'tool-1', name: 'Bash', input: { command: 'echo hi' } }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 1000,
          cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
        },
      },
    }
    const dupLast = {
      ...dupFirst,
      uuid: 'u2',
      timestamp: '2026-08-01T10:00:01.000Z',
      message: {
        ...dupFirst.message,
        usage: {
          input_tokens: 100,
          output_tokens: 200, // grew, per the monotonic-growth trap
          cache_read_input_tokens: 1000,
          cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
        },
      },
    }
    const toolResult = {
      type: 'user',
      sessionId: SESSION,
      cwd: CWD,
      uuid: 'u3',
      timestamp: '2026-08-01T10:00:02.000Z',
      message: { content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'hi' }] },
    }
    // A second, distinct turn on opus so the models table has two rows.
    const opusTurn = {
      type: 'assistant',
      sessionId: SESSION,
      cwd: CWD,
      uuid: 'u4',
      timestamp: '2026-08-01T10:00:03.000Z',
      requestId: 'req-2',
      isSidechain: false,
      message: {
        model: 'claude-opus-5',
        content: [],
        usage: {
          input_tokens: 10,
          output_tokens: 10,
          cache_read_input_tokens: 500,
          cache_creation: { ephemeral_5m_input_tokens: 400, ephemeral_1h_input_tokens: 300 },
        },
      },
    }
    // Synthetic model turn — must be excluded from pricing entirely.
    const syntheticTurn = {
      type: 'assistant',
      sessionId: SESSION,
      cwd: CWD,
      uuid: 'u5',
      timestamp: '2026-08-01T10:00:04.000Z',
      requestId: 'req-3',
      isSidechain: false,
      message: { model: '<synthetic>', content: [], usage: { input_tokens: 999999, output_tokens: 999999 } },
    }

    const file = makeFile('sess-1.jsonl', [dupFirst, dupLast, toolResult, opusTurn, syntheticTurn])

    const analysis = await analyzeFiles([file], () => {}, { source: 'import', excludeSelf: false })

    // dedup: 2 assistant records shared req-1 -> 1 kept, 1 deduped.
    expect(analysis.meta.deduped).toBe(1)
    expect(analysis.meta.turns).toBe(3) // req-1 (last), req-2, req-3

    // Last-occurrence usage must win: output_tokens 200, not 50.
    const sonnetRow = analysis.models.find((m) => m.model === 'claude-sonnet-5')
    expect(sonnetRow?.turns).toBe(1)

    // sonnet rates: input 3, output 15, cacheRead 0.3 ($/Mtok)
    const sonnetExpected = (100 / 1e6) * 3 + (200 / 1e6) * 15 + (1000 / 1e6) * 0.3
    expect(sonnetRow?.cost).toBeCloseTo(sonnetExpected, 10)

    // opus rates: input 15, output 75, cacheRead 1.5, cacheWrite5m 18.75, cacheWrite1h 30
    const opusRow = analysis.models.find((m) => m.model === 'claude-opus-5')
    const opusExpected = (10 / 1e6) * 15 + (10 / 1e6) * 75 + (500 / 1e6) * 1.5 + (400 / 1e6) * 18.75 + (300 / 1e6) * 30
    expect(opusRow?.cost).toBeCloseTo(opusExpected, 10)

    // <synthetic> must contribute exactly $0 and not appear in the models table.
    expect(analysis.models.find((m) => m.model === '<synthetic>')).toBeUndefined()

    expect(analysis.summary.totalCost).toBeCloseTo(sonnetExpected + opusExpected, 10)
  })
})
