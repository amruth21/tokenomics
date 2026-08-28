# Features — views, data dependencies, verification status

Every feature below is annotated with the exact fields it needs and whether the data
was **verified present** in the real corpus. Nothing is speculative.

Priority: **P0** = demo spine, **P1** = strong differentiator, **P2** = if time allows.

---

## 1. Statement (P0) — landing view

The reframe. Big number, instantly credible because it is the user's real month.

- Hero: **productive token rate** with count-up animation (0.2% tokens / 8.2% dollars)
- Total spend, date range, session count
- "496 tokens read for every 1 written" as a single wince line
- Sparkline of daily spend

Needs: `usage.*`, `timestamp`, `model`. **Verified.**

## 2. Where It Goes (P0) — Sankey

Animated flow: total spend → model → category (output / cache read / cache write 5m /
cache write 1h) → main vs subagent. Clicking a node filters the whole view.

Needs: `usage` four-way split + `cache_creation` sub-split + `isSidechain` + `model`.
**Verified.** Sankey is `@nivo/sankey`.

## 3. Recurring Charges (P1) — the forgotten-subscriptions panel

Framed as Rocket Money's subscription screen. Each row: what it is, tokens per session,
sessions billed, projected monthly cost, and a cancel-style "what if I trimmed this".

Rows come from two independent sources, both verified:
- Per-project first-turn `cache_creation` floor (jobpilot: 13,380 tok min, 31 sessions)
- `attachment` records: `skill_listing` (~176 tok x231), `deferred_tools_delta`
  (~1.5k tok x253)

Needs: first non-sidechain turn per session + attachment payload sizes. **Verified.**

## 4. Vendors / Tool Bloat (P1) — treemap + the annuity insight

Treemap of tool payload bytes. The differentiator: a fat tool result is not a one-time
charge, it is re-read on every later turn in the session. Cost each call as
`bytes/4 * turns_remaining_in_session * cache_read_rate`.

Headline row already in the data: **one Playwright screenshot = 153 KB ≈ 38k tokens.**

Needs: two-pass `tool_use_id` → name map, `tool_result` bytes, turn index in session.
**Verified** (31 MB resolved, top offenders listed in data-model.md).

## 5. Model Portfolio (P1) — allocation + downgrade simulator

Donut of turns vs donut of dollars, side by side — the gap is the story
(Opus = 22% of turns, 90% of dollars). Slider: "route turns with output < N tokens and
no tool_use to Sonnet" → recomputed monthly total, animated.

Needs: `model`, `output_tokens`, presence of `tool_use`, pricing table. **Verified.**

## 6. Subagent Ledger (P1)

56% of turns are `isSidechain`. Nobody surfaces this. Cost per subagent run, which
parent session spawned it, and average tokens per delegated task.

Needs: `isSidechain`, `sessionId`, subagent file paths. **Verified** (5,373 turns).

## 7. Habits (P2) — calendar + hour heatmap

`@nivo/calendar` for daily spend, hour-of-day x weekday heatmap for when you burn.
24 calendar days, 16/24 hours, all 7 weekdays present — enough to look alive.

Needs: `timestamp`. **Verified.**

## 8. Rework Detector (P2)

Sessions where the same `file_path` was edited 3+ times, plus tool error rate.
Verified: 43 cases across 7 sessions; worst is 29 edits to one file.
Corpus tool error rate is 8.8% (892/10,139) — shown as "declined transactions".

Needs: `tool_use.input.file_path` on Edit/Write, `tool_result.is_error`. **Verified.**
Do **not** use `file-history-delta` — it has no repeats (see data-model.md trap 3).

## 9. Advisor (P1) — savings cards

Two or three cards, each with a dollar figure computed from this user's own history and
an explicit "here is the evidence" drawer. Deterministic rules only.
Optional flourish behind `--advisor-llm`: one `claude -p` call that writes the
paragraph from the computed JSON. Must be killable without breaking the view.

---

## Cut list (data does not support these)

- **Thinking-mode spend breakdown.** Thinking text is not persisted and thinking tokens
  are not separated in `usage`. No data. Cut.
- **LLM session-outcome classifier.** Unreliable and slow; the rework detector and
  turn-gap heuristics cover the same ground deterministically.
- Org/multi-user rollups, live proxy, auth, deploy.
