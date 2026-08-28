# Transcript data model (verified against 230 files / 116 MB / 2026-07-26 → 2026-08-28)

Source: `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`
plus `<session-id>/subagents/agent-*.jsonl` for sidechains.

## Record types present (by volume)

| type | n | use |
|---|---|---|
| `assistant` | 21,418 (9,524 unique) | usage, model, tool_use, effort |
| `user` | 10,612 | prompts, `tool_result` payloads, `toolUseResult` |
| `attachment` | 1,983 | injected context: skill listings, tool deltas |
| `last-prompt` | 931 | prompt replay |
| `ai-title` | 247 | session titles (only 9 sessions have one) |
| `permission-mode` | 241 | plan mode detection |
| `mode` | 239 | normal/other |
| `file-history-delta` | 107 | file edit tracking — **weak, see traps** |

## assistant record

Top level: `timestamp, sessionId, cwd, gitBranch, version, requestId, uuid, parentUuid,
isSidechain, effort, entrypoint, userType`.

`message.usage`:
```json
{"input_tokens": 2, "cache_creation_input_tokens": 24908, "cache_read_input_tokens": 0,
 "output_tokens": 266, "service_tier": "standard",
 "cache_creation": {"ephemeral_1h_input_tokens": 24908, "ephemeral_5m_input_tokens": 0},
 "server_tool_use": {"web_search_requests": 0, "web_fetch_requests": 0},
 "iterations": [...]}
```

`message.content[]` block types: `text`, `thinking`, `tool_use`.

## Verified corpus totals (deduped, public API rates)

| | tokens | $ |
|---|---|---|
| output | 1.92 M | 101 |
| cache read | 952.61 M | 809 |
| cache write (11.29 M @1h, 9.38 M @5m) | 20.67 M | 320 |
| fresh input | 0.06 M | ~0 |
| **total** | | **~1,230** |

- Productive token rate: **0.2% of tokens / 8.2% of dollars**. 496:1 read-to-output.
- Models: haiku 5,276 turns, opus-5 2,697, sonnet-5 1,508, `<synthetic>` 39.
  Opus is 22% of turns and **90% of dollars**.
- `isSidechain: true` on **5,373 of 9,524 turns (56%)** — subagents are the majority.
- `effort`: medium 3,439, high 766, null 5,319.
- Permission modes: bypassPermissions 173, auto 56, **plan 8**, default 4.
- 59 sessions, median 22 turns, p90 593, max 1,032.
- 24 calendar days, all 7 weekdays, 16 of 24 hours → calendar + hour heatmaps viable.

## Tool result attribution (two-pass required)

`tool_use` (name + id + input) is in `assistant`; the payload is a `tool_result` block in
the next `user` message, keyed by `tool_use_id`. Build the id→name map over **all**
assistant records including duplicates, then dedup.

Top payloads (deduped by `tool_use_id`):

| tool | total | calls | avg/call |
|---|---|---|---|
| `browser_take_screenshot` (jobpilot) | 7.34 MB | 48 | 153 KB ≈ **38k tok** |
| `browser_snapshot` (jobpilot) | 6.15 MB | 1,055 | 5.8 KB ≈ 1.5k tok |
| `Read` | 5.91 MB | 270 | 21.9 KB ≈ 5.5k tok |
| `browser_take_screenshot` (plugin) | 3.13 MB | 47 | 66 KB ≈ 17k tok |
| `Bash` | 2.48 MB | 2,004 | 1.2 KB ≈ 300 tok |

Total resolved tool payload: ~31 MB. Error rate: **892 / 10,139 tool results = 8.8%**.

## Always-on overhead (the "subscriptions")

First-turn `cache_creation` per project, min across sessions = the floor you pay
before typing anything:

| cwd | sessions | min | median |
|---|---|---|---|
| `~/jobpilot` | 31 | 13,380 | 21,945 |
| `~` | 5 | 3,631 | 9,456 |

Also directly measurable from `attachment` records:
- `skill_listing`: 231 injections, ~705 B (~176 tok) each
- `deferred_tools_delta`: 253 injections, median 6,225 B (~1.5k tok)
- `total_tokens_reminder`: 674 — carries remaining context window as text

## Traps (found the hard way)

1. **`requestId` duplicates**: 11,894 of 21,418 assistant records. Dedup or double-bill.
2. **Thinking text is not persisted**: 6,943 thinking blocks, **all with empty
   `thinking` string**. Thinking tokens cannot be separated from `output_tokens`.
   Do not ship a "thinking spend" category — there is no data for it.
3. **`file-history-delta` is not a rework signal**: 107 records, every `trackingPath`
   appears exactly once. Zero paths touched 3+ times. Use `tool_use.input.file_path`
   on Edit/Write instead — that yields **43 rework cases across 7 sessions**
   (worst: `chalk/scripts/seed.py` edited 29x in one session).
4. **Session titles are sparse**: 9 of 59 have `ai-title`. Fall back to first user
   prompt (39 usable), and filter injected prompts — many begin with
   `Skill /... is already loaded` or `<`.
5. `<synthetic>` appears as a model value (39 turns). Exclude from pricing.
