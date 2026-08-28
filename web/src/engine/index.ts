// Public entry point for the analysis engine. Spawns the Web Worker, feeds
// it the picked files, and resolves with the finished Analysis. Views/shell
// code should only ever import from here — never reach into engine/analyze.ts
// or engine/parse.ts directly.

import type { Analysis, EngineProgress } from '../types/analysis'
import type { WorkerRequest } from './worker'

export type { EngineProgress } from '../types/analysis'

export function runAnalysis(
  files: File[],
  onProgress?: (p: EngineProgress) => void,
  opts: { source?: 'demo' | 'local' | 'import' } = {},
): Promise<Analysis> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })

    worker.onmessage = (event: MessageEvent<EngineProgress>) => {
      const msg = event.data
      onProgress?.(msg)
      if (msg.phase === 'done') {
        worker.terminate()
        resolve(msg.analysis)
      } else if (msg.phase === 'error') {
        worker.terminate()
        reject(new Error(msg.message))
      }
    }

    worker.onerror = (event: ErrorEvent) => {
      worker.terminate()
      reject(event.error instanceof Error ? event.error : new Error(event.message))
    }

    const request: WorkerRequest = { type: 'analyze', files, source: opts.source }
    worker.postMessage(request)
  })
}
