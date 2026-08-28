// Web Worker entry point. Receives a file list, streams + analyzes it off
// the main thread, and posts progress + the final Analysis back.
/// <reference lib="webworker" />

import type { EngineProgress } from '../types/analysis'
import { analyzeFiles } from './analyze'

export type WorkerRequest = {
  type: 'analyze'
  files: File[]
  source?: 'demo' | 'local' | 'import'
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data
  if (msg.type !== 'analyze') return

  try {
    const analysis = await analyzeFiles(
      msg.files,
      (progress) => {
        post(progress)
      },
      { source: msg.source },
    )
    post({ phase: 'done', analysis })
  } catch (err) {
    post({ phase: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

function post(message: EngineProgress) {
  ;(self as unknown as Worker).postMessage(message)
}
