// Streaming JSONL reader over File[] (e.g. from <input webkitdirectory>).
// Never loads a whole file into memory as a retained array — reads via
// file.stream() + TextDecoderStream, splits on newlines, and yields one
// parsed record at a time. Corpus reaches 116 MB / ~200k lines; this must
// stay O(1) memory per file regardless of file size.

/** Minimal shape of a raw transcript record. Deliberately loose — the
 * corpus has many `type` values and we only care about a handful. */
export type RawRecord = Record<string, unknown> & { type?: string }

export interface FileLine {
  file: File
  /** Path relative to the picked root, when available (webkitdirectory). */
  relPath: string
  record: RawRecord
}

const DEFAULT_EXCLUDE_SUBSTRINGS = ['-Users-amruthnare-Documents-Buildathon']

export interface SelectFilesOptions {
  /** Extra path substrings to exclude, in addition to the self-referential default. */
  excludeSubstrings?: string[]
  /** Set false to include the default self-referential exclusion (default true = excluded). */
  excludeSelf?: boolean
}

/** Filter a raw FileList/File[] down to the .jsonl transcript files we care
 * about, applying the self-referential-corpus exclusion by default. */
export function selectFiles(files: File[], opts: SelectFilesOptions = {}): File[] {
  const exclude = [...(opts.excludeSelf === false ? [] : DEFAULT_EXCLUDE_SUBSTRINGS), ...(opts.excludeSubstrings ?? [])]
  return files.filter((f) => {
    if (!f.name.endsWith('.jsonl')) return false
    const rel = relPathOf(f)
    if (exclude.some((sub) => rel.includes(sub))) return false
    return true
  })
}

export function relPathOf(f: File): string {
  return (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
}

/** Stream every line of every file, in file order, yielding parsed JSON
 * records. Malformed lines are skipped silently (transcripts occasionally
 * have a truncated final line from an interrupted write). */
export async function* streamFiles(files: File[]): AsyncGenerator<FileLine> {
  for (const file of files) {
    yield* streamFile(file)
  }
}

export async function* streamFile(file: File): AsyncGenerator<FileLine> {
  const relPath = relPathOf(file)
  const stream = file.stream().pipeThrough(new TextDecoderStream())
  const reader = stream.getReader()
  let buffer = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (value) {
        buffer += value
        let idx: number
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 1)
          const record = parseLine(line)
          if (record) yield { file, relPath, record }
        }
      }
      if (done) break
    }
  } finally {
    reader.releaseLock()
  }
  const record = parseLine(buffer)
  if (record) yield { file, relPath, record }
}

function parseLine(line: string): RawRecord | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as RawRecord
  } catch {
    return null
  }
}
