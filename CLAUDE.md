# Tokenomics — Mint for your Claude Code tokens

Local-first dashboard that reads Claude Code session transcripts and reframes AI spend as
personal finance: where tokens go, how much was productive, which habits bleed money, and
what to change.

**Deployed on Vercel as a static SPA. All parsing and analysis run in the browser.**
There is no backend and no upload. The privacy claim is stronger than "local-only" —
there is no server that *could* receive a transcript.

Do not add a Node/serverless API that receives transcript data. Do not add telemetry.
The only outbound call permitted is the optional advisor blurb, behind an explicit flag,
which sends computed aggregates only — never prompt text or file paths.

## Stack

- **Vite + React 19 + TypeScript**, Tailwind v4, shadcn/ui
- **Analysis engine**: TypeScript, runs in a **Web Worker**, streams JSONL, retains only
  aggregates. Same code path for the demo snapshot and for user-loaded folders.
- **Charts**: `@nivo/*` only (bar, line, calendar, sankey, treemap) — animated via react-spring
- **Motion**: Framer Motion for view transitions and number count-ups
- **Cache**: IndexedDB for computed aggregates, so a revisit is instant

No second chart library. No router beyond sidebar view state. No Python in the shipped
app (a Python script may exist under `tools/` to generate the demo snapshot, offline).

## Three data sources, one engine

1. **Demo snapshot** (default on the live URL) — a precomputed, anonymized aggregate
   bundled as a static JSON so a judge sees real numbers in under a second with no setup.
   Anonymize: hash session ids, strip absolute paths to basenames, drop prompt text and
   keep only derived specificity features.
2. **Folder picker** — `<input type="file" webkitdirectory>` pointed at
   `~/.claude/projects`. Works across Chrome, Edge, Safari, Firefox. Use the File System
   Access API only as a progressive enhancement where available.
3. **Snapshot import** — drag in a JSON exported by another machine.

The engine must handle the real scale: **230 files, 116 MB, ~200k lines.** Stream and
aggregate in the worker; never hold parsed records in an array that outlives the file.

## Layout

```
web/src/engine/     JSONL streaming, dedup, pricing, aggregation   (data agent)
web/src/rules/      waste detectors -> Recommendation[]            (analysis agent)
web/src/views/      one file per sidebar view                      (view agents)
web/src/components/ layout, sidebar, cards, primitives             (shell agent)
public/demo.json    anonymized demo snapshot
docs/               data-model.md, features.md, recommendations.md
```

Read `docs/data-model.md` before touching the engine. Its traps were derived from 230
real files, not from documentation.

## Non-negotiable invariants

1. **Dedup by `requestId`.** 21,418 assistant records, 9,524 unique. Summing without
   dedup overstates spend by ~2.2x.
2. **Two-pass ingest.** Map `tool_use` id -> name over *all* assistant records before
   dedup, or ~28 MB of tool results resolve to "unknown".
3. **Cache writes are two prices.** `usage.cache_creation` splits `ephemeral_5m` (1.25x
   input) and `ephemeral_1h` (2x input). Never collapse into `cache_creation_input_tokens`.
4. **Prices live in `web/src/engine/pricing.json`**, never inline.
5. **Every recommendation carries evidence.** No dollar figure without the turns behind it.
6. Keep this file short. It is re-sent every turn — a bloated CLAUDE.md is literally one
   of the waste categories this product diagnoses.

## Commands

```
npm run dev       # :5173
npm run build     # static output for Vercel
npm run snapshot  # regenerate public/demo.json from the local corpus (offline tool)
```

## Demo safety

Exclude `~/.claude/projects/-Users-amruthnare-Documents-Buildathon` from the demo
aggregate — building this logs into the same corpus and the dashboard eats its own tail.
