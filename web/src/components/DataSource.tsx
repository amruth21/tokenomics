import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { Database, HardDrive, FileJson, Loader2, UploadCloud } from 'lucide-react'
import type { Analysis, EngineProgress } from '../types/analysis'
import { mockAnalysis } from '../data/mock'

// ---------------------------------------------------------------------------
// Engine loading — defensive & lazy. src/engine/** is owned by a parallel agent
// and may not exist yet, or may land under any of these conventional entry
// names. We probe for whichever one shows up on disk via import.meta.glob,
// which only matches files that actually exist, so a missing engine never
// breaks the build.
// ---------------------------------------------------------------------------
type EngineModule = {
  runAnalysis?: (files: File[], onProgress: (p: EngineProgress) => void) => Promise<Analysis>
}

const engineCandidates = import.meta.glob<EngineModule>(
  '../engine/{index,engine,worker,analyze}.{ts,tsx}',
)

async function loadEngine(): Promise<EngineModule | null> {
  const preferredOrder = ['index', 'engine', 'analyze', 'worker']
  const keys = Object.keys(engineCandidates).sort((a, b) => {
    const ai = preferredOrder.findIndex((p) => a.includes(p))
    const bi = preferredOrder.findIndex((p) => b.includes(p))
    return ai - bi
  })
  const key = keys[0]
  if (!key) return null
  try {
    return await engineCandidates[key]()
  } catch (err) {
    console.error('[DataSource] engine module failed to load', err)
    return null
  }
}

// A finished Analysis has these blocks. The scanner's snapshot format does not.
function isAnalysis(d: unknown): d is Analysis {
  if (!d || typeof d !== 'object') return false
  const o = d as Record<string, unknown>
  return (
    !!o.meta && typeof o.meta === 'object' &&
    !!o.summary && typeof o.summary === 'object' &&
    typeof (o.summary as Record<string, unknown>).totalCost === 'number' &&
    Array.isArray(o.advice)
  )
}

// ---------------------------------------------------------------------------
// Types & context
// ---------------------------------------------------------------------------
export type DataStatus = 'idle' | 'loading' | 'ready' | 'error'

type DataSourceState = {
  analysis: Analysis
  status: DataStatus
  progress: EngineProgress | null
  error: string | null
  engineAvailable: boolean
  loadDemo: () => void
  loadLocalFolder: (files: File[]) => void
  loadImportFile: (file: File) => void
}

const DataSourceContext = createContext<DataSourceState | null>(null)

export function useDataSource(): DataSourceState {
  const ctx = useContext(DataSourceContext)
  if (!ctx) throw new Error('useDataSource must be used within DataSourceProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function DataSourceProvider({ children }: { children: ReactNode }) {
  const [analysis, setAnalysis] = useState<Analysis>(mockAnalysis)
  const [status, setStatus] = useState<DataStatus>('idle')
  const [progress, setProgress] = useState<EngineProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [engineAvailable, setEngineAvailable] = useState(false)
  const engineRef = useRef<EngineModule | null>(null)

  useEffect(() => {
    loadEngine().then((mod) => {
      engineRef.current = mod
      setEngineAvailable(!!mod?.runAnalysis)
    })
  }, [])

  const loadDemo = useCallback(() => {
    setStatus('loading')
    setError(null)
    fetch('/demo.json')
      .then((res) => {
        if (!res.ok) throw new Error(`demo.json ${res.status}`)
        return res.json() as Promise<unknown>
      })
      .then((data) => {
        // demo.json may be the raw scanner SNAPSHOT (schema/dict/turns), which is
        // NOT an Analysis. Only accept a fully-formed Analysis; anything else
        // falls through to the verified mock rather than blanking the app.
        if (!isAnalysis(data)) throw new Error('demo.json is a raw snapshot, not an Analysis')
        setAnalysis({ ...data, meta: { ...data.meta, source: 'demo' } })
        setStatus('ready')
      })
      .catch(() => {
        // demo.json not generated yet — fall back to the verified mock fixture
        setAnalysis({ ...mockAnalysis, meta: { ...mockAnalysis.meta, source: 'demo' } })
        setStatus('ready')
      })
  }, [])

  const loadLocalFolder = useCallback((files: File[]) => {
    if (!files.length) return
    setStatus('loading')
    setError(null)
    setProgress({ phase: 'scanning', filesDone: 0, filesTotal: files.length })

    const mod = engineRef.current
    if (!mod?.runAnalysis) {
      setStatus('error')
      setError('The analysis engine is still coming online. Try demo data for now.')
      return
    }

    mod
      .runAnalysis(files, (p) => setProgress(p))
      .then((result) => {
        setAnalysis({ ...result, meta: { ...result.meta, source: 'local' } })
        setStatus('ready')
      })
      .catch((err: unknown) => {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Failed to analyze folder')
      })
  }, [])

  const loadImportFile = useCallback((file: File) => {
    setStatus('loading')
    setError(null)
    file
      .text()
      .then((text) => JSON.parse(text) as unknown)
      .then((data) => {
        if (!isAnalysis(data)) throw new Error('Not a finished Analysis snapshot')
        setAnalysis({ ...data, meta: { ...data.meta, source: 'import' } })
        setStatus('ready')
      })
      .catch((err: unknown) => {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Could not read snapshot JSON')
      })
  }, [])

  // default: load demo on first mount
  useEffect(() => {
    loadDemo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo<DataSourceState>(
    () => ({
      analysis,
      status,
      progress,
      error,
      engineAvailable,
      loadDemo,
      loadLocalFolder,
      loadImportFile,
    }),
    [analysis, status, progress, error, engineAvailable, loadDemo, loadLocalFolder, loadImportFile],
  )

  return <DataSourceContext.Provider value={value}>{children}</DataSourceContext.Provider>
}

// ---------------------------------------------------------------------------
// UI: source switcher + progress bar + drag & drop
// ---------------------------------------------------------------------------
function progressLabel(p: EngineProgress | null): string {
  if (!p) return 'Loading…'
  if (p.phase === 'done') return 'Done'
  if (p.phase === 'error') return p.message
  const pct = p.filesTotal > 0 ? Math.round((p.filesDone / p.filesTotal) * 100) : 0
  return `${p.phase === 'scanning' ? 'Scanning' : p.phase === 'parsing' ? 'Parsing' : 'Analyzing'} ${p.filesDone}/${p.filesTotal} (${pct}%)`
}

export default function DataSourceControl() {
  const { status, progress, error, loadDemo, loadLocalFolder, loadImportFile, analysis } = useDataSource()
  const [dragOver, setDragOver] = useState(false)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file && file.type === 'application/json') loadImportFile(file)
    },
    [loadImportFile],
  )

  const pct =
    progress && progress.phase !== 'done' && progress.phase !== 'error' && progress.filesTotal > 0
      ? Math.round((progress.filesDone / progress.filesTotal) * 100)
      : status === 'loading'
        ? 100
        : 0

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className="flex items-center gap-2"
    >
      <div className="flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] p-1">
        <SourceButton
          icon={Database}
          label="Demo"
          active={analysis.meta.source === 'demo'}
          onClick={loadDemo}
        />
        <SourceButton
          icon={HardDrive}
          label="Your machine"
          active={analysis.meta.source === 'local'}
          onClick={() => folderInputRef.current?.click()}
        />
        <SourceButton
          icon={FileJson}
          label="Import"
          active={analysis.meta.source === 'import'}
          onClick={() => importInputRef.current?.click()}
        />
      </div>

      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error non-standard attrs for directory selection
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          loadLocalFolder(files)
          e.target.value = ''
        }}
      />
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) loadImportFile(file)
          e.target.value = ''
        }}
      />

      <AnimatePresence>
        {status === 'loading' && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 160 }}
            exit={{ opacity: 0, width: 0 }}
            className="flex items-center gap-2 overflow-hidden rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5"
          >
            <Loader2 size={13} className="shrink-0 animate-spin text-[var(--color-accent)]" />
            <div className="min-w-0 flex-1">
              <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                <motion.div
                  className="h-full rounded-full bg-[var(--color-accent)]"
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <p className="mt-1 truncate text-[10px] text-[var(--color-muted)]">{progressLabel(progress)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {status === 'error' && error && (
        <span className="rounded-full border border-[var(--color-burn)]/25 bg-[var(--color-burn)]/10 px-3 py-1 text-xs text-[var(--color-burn)]">
          {error}
        </span>
      )}

      {dragOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-accent)] px-12 py-10">
            <UploadCloud size={28} className="text-[var(--color-accent)]" />
            <p className="text-sm text-[#e8edf5]">Drop a snapshot JSON to import</p>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function SourceButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Database
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
          : 'text-[var(--color-muted)] hover:text-[#e8edf5]',
      )}
    >
      <Icon size={13} strokeWidth={1.75} />
      {label}
    </button>
  )
}
