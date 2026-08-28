# Snapshot shape (`tokenomics-snapshot@1`)

Produced by `tools/scan.mjs`. This is **not** a finished `Analysis` object (see
`web/src/types/analysis.ts`) — it is the reduced set of per-turn records the
browser-side engine needs to *compute* a full `Analysis` without ever seeing
the original transcripts. Consuming code in `web/src/engine/**` owns turning
this into `Analysis` (pricing, recommendations, chart data all live there).

## Top level

```jsonc
{
  "schema": "tokenomics-snapshot@1",
  "meta": {
    "generatedAt": "2026-08-28T...Z",
    "filesScanned": 237,
    "filesSkipped": 0,
    "sessions": 62,          // unique hashed session ids, main files only
    "subagentRuns": 167,     // subagent transcript files that yielded >=1 real turn
    "turnsRawAssistant": 32885, // total assistant record occurrences seen (pre-dedup)
    "turnsUnique": 9845,     // deduped by requestId — this many turns are in `turns`
    "deduped": 11520,        // records skipped as requestId repeats
    "from": "2026-07-26T...Z",
    "to": "2026-08-28T...Z",
    "rollup": false          // true if generated with --rollup (see below)
  },
  "dict": {
    "models": ["claude-opus-5", "claude-sonnet-5", ...],
    "cwds":   ["~", "jobpilot", "tokenomics", ...],   // basenames only, "~" = home dir
    "tools":  ["Bash", "Read", "Edit", ...]
  },
  "turns": [ ... ],          // present unless --rollup was used
  "sessions": [ ... ],       // present only if --rollup was used, instead of `turns`
  "attachments": [ { "type": "skill_listing", "count": 231, "bytes": 162865 }, ... ],
  "permissionModes": { "bypassPermissions": 173, "auto": 56, "plan": 8, "default": 4 }
}
```

## `turns[]` (default, per-turn mode)

Each turn is a **positional array**, not an object, to keep the file small.
Strings are dictionary-encoded — look them up in `dict`.

```
turns[i] = [
  0  s        string   sha256(sessionId).slice(0,8) — anonymized session id
  1  ts       number   epoch ms (from the record's timestamp)
  2  mIdx     number   index into dict.models
  3  sc       0|1      isSidechain (subagent turn)
  4  sub      0|1      this turn came from a subagents/*.jsonl file
  5  eff      string|null   effort ("medium"|"high"|null)
  6  u        [n,n,n,n,n]   the 5 usage numbers:
                       [input_tokens, cache_creation.ephemeral_5m_input_tokens,
                        cache_creation.ephemeral_1h_input_tokens,
                        cache_read_input_tokens, output_tokens]
  7  cIdx     number   index into dict.cwds (basename of the record's cwd, or "~")
  8  toolErr  number   count of tool_result blocks on this turn with is_error:true
  9  editPath string|null  basename of an Edit/Write target on this turn (rework signal)
  10 tools    [[toolNameIdx, bytes, repeatKeyHash], ...]
                       one entry per tool_use on this turn:
                         toolNameIdx — index into dict.tools
                         bytes       — byte size of the matching tool_result content
                                       (0 if no result was found, e.g. still pending)
                         repeatKeyHash — sha256(JSON.stringify(tool_use.input)).slice(0,8),
                                       or null. Lets the engine detect "same command run
                                       N times" (loop detection) WITHOUT storing the
                                       command text itself.
]
```

Turns are sorted by `ts` ascending. Model `<synthetic>` is dropped entirely
before this point (never appears in `dict.models` or `turns`).

## `sessions[]` (only with `--rollup`)

Used when per-turn output would be too large to ship. Rolls every turn up to
one record per `(session, cwd)` pair:

```jsonc
{
  "s": "a1b2c3d4",
  "cwd": "jobpilot",
  "turns": 342,
  "sidechainTurns": 190,
  "subagentFileTurns": 190,
  "from": 1755000000000, "to": 1755100000000,
  "toolErr": 12,
  "models": [ [mIdx, turnCount, [in,c5m,c1h,cread,out]], ... ],   // summed usage per model
  "tools":  [ [toolNameIdx, calls, totalBytes], ... ],
  "edits":  [ [basename, editCount], ... ]   // only paths edited more than once
}
```

This loses per-turn timing/ordering and per-call repeat-key detail — noted
explicitly wherever it's used (see `tools/README.md` and the commit that
generated `web/public/demo.json`).

## What is deliberately NOT in here

- No prompt text, ever (user or assistant `text`/`thinking` blocks are never read for content).
- No `tool_result` content — only its byte length.
- No absolute paths — `cwd` and Edit/Write targets are reduced to basenames;
  the literal home directory is replaced with `"~"`.
- No `gitBranch`, no `ai-title` (session titles are free text and are skipped
  entirely — not even hashed).
- No raw session ids — sha256, truncated to 8 hex chars, one-way.
- No raw tool inputs — only `repeatKeyHash`, a one-way hash of the input used
  purely for grouping identical calls.

Verify this yourself: `grep` the output for your username, `/Users/`, or any
known session UUID from `~/.claude/projects` — none of it should appear.
