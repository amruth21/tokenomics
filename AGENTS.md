# Agent delegation contract

Work is split so that parallel agents never edit the same files. Read `CLAUDE.md` and
`docs/data-model.md` first — the schema traps there are non-obvious and were derived
from the real corpus, not from documentation.

## Model routing

| Work | Model |
|---|---|
| Schema decisions, waste-rule design, pricing math, demo narrative | Opus (lead) |
| Engine implementation, detectors, React views, chart wiring, styling | Sonnet |
| Mechanical refactors, test fixtures, doc formatting | Haiku |

Sonnet agents implement against a fixed interface; they do not get to redesign it.
If an agent believes the interface is wrong, it reports back rather than changing it.

## File ownership (do not cross these lines)

| Agent | Owns | May read | Never touches |
|---|---|---|---|
| `engine` | `web/src/engine/**` | `docs/**` | `views/**`, `rules/**` |
| `rules` | `web/src/rules/**`, `engine/pricing.json` | `engine/**`, `docs/**` | `views/**`, `components/**` |
| `shell` | `web/src/components/**`, `App.tsx`, Tailwind config | `docs/**` | `views/**`, `engine/**` |
| `views-a` / `views-b` | disjoint files under `web/src/views/**` | `components/**`, engine types | each other, `engine/**` |
| `snapshot` | `tools/snapshot.py`, `public/demo.json` | `engine/**` | everything else |

## The contract between layers

Frozen before any agent starts. Changes come from the lead only.

```ts
// engine — runs in a Web Worker, streams files, emits one object
type Analysis = {
  meta:      { sessions: number; turns: number; deduped: number; from: string; to: string }
  summary:   { totalCost: number; productiveRate: number; readToWriteRatio: number
               daily: { date: string; cost: number }[] }
  flow:      { nodes: {id:string}[]; links: {source:string;target:string;value:number}[] }
  models:    { model: string; turns: number; cost: number; costPerTurn: number }[]
  tools:     { name: string; calls: number; bytes: number; annuityCost: number }[]
  recurring: { label: string; tokensPerSession: number; sessions: number; monthly: number }[]
  subagents: { runs: number; medianBootTokens: number; cost: number }[]
  habits:    { calendar: {day:string;value:number}[]; hourByWeekday: number[][] }
  rework:    { sessionId: string; path: string; edits: number; cost: number }[]
  advice:    Recommendation[]   // see docs/recommendations.md
}
```

Views consume `Analysis` only. **No view does token math or pricing math.** If a view
needs a derived number, it is added to the engine output, not computed in React.

The worker posts progress messages (`{ filesDone, filesTotal }`) so the shell can render
a real loading state on a 116 MB parse.

## Rules for every agent

1. **No network calls in ingest or analyze.** The local-only promise is the pitch.
2. **Never sum usage without deduping `requestId`.** Doubles the bill.
3. Prices belong in `analyze/pricing.json`. Never inline a rate.
4. Chart library is `@nivo/*`. Do not add Recharts, Chart.js, or D3 directly.
4b. No backend. No serverless route that receives transcript data. Parsing is client-side.
5. Do not add features that are not in `docs/features.md`. The cut list is deliberate —
   thinking-mode breakdown and LLM outcome classification have no supporting data.
6. Test against the real corpus (230 files), not a synthetic fixture. If ingest takes
   more than a few seconds, that is a bug worth reporting, not working around.
7. Report back with what you changed and any interface friction. Do not silently widen
   scope to fix something owned by another agent.

## Definition of done per agent

- `engine`: parses the real 230-file corpus in the worker, reports its dedup count, and
  produces a complete `Analysis` object. Must not block the main thread.
- `rules`: every detector in docs/recommendations.md returns cards with evidence, plus a
  unit test pinning total spend so a pricing regression is loud.
- `snapshot`: `public/demo.json` is anonymized (hashed session ids, basenames only, no
  prompt text) and loads on the live URL in under a second.
- `frontend-shell`: sidebar navigates all views, dark theme, motion transitions, no
  layout shift when data loads.
- `frontend-views`: each view renders from its endpoint with an empty state and a
  loading state, and animates on mount.
