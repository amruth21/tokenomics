# Recommendation engine

## The unifying model: cost per turn

Every recommendation reduces one of two quantities.

```
session cost  =  turns  x  (context re-read + context written + output)
```

Measured on the real corpus:

| model | turns | $/turn | avg context re-read per turn |
|---|---|---|---|
| opus-5 | 2,711 | **$0.410** | 177k tok |
| sonnet-5 | 1,508 | $0.057 | 141k tok |
| haiku-4.5 | 5,276 | $0.007 | 49k tok |

This is the number that makes every rule below concrete: **an avoidable Opus turn costs
41 cents regardless of how small its output was.** A repeated `curl` returning 2 KB is
not a 2 KB problem — it is a 41-cent problem, because the entire context is re-read to
produce it.

Confidence is displayed on every card (high / medium / heuristic). We are explicitly not
aiming for 100% accuracy; we are aiming for *defensible* — every card opens an evidence
drawer listing the exact turns it was computed from.

---

## A. Turn-count reducers (biggest lever)

### A1. Tool loops that should be scripts — `high` signal, `low` dollar value
Same normalized command run 3+ times in one session. **4 real cases** — worst is
`curl -fsS http://localhost:8000/api/credentials` at **11x**, then `echo waiting` 10x
and `curl .../api/resumes` 6x.

CORRECTION: earlier drafts claimed "26 cases, worst 17x". That was a measurement
artifact — the probe truncated commands to their first 100 characters, so distinct
heredocs sharing a prefix collapsed into one group. Full-command normalization gives 4.

Honest dollar value: **~$0.30/month.** These loops happen in cheap, Haiku-heavy
sessions, so pricing the avoided turns at the session's real cost-per-turn (~$0.012)
rather than the Opus rate ($0.41) makes this card nearly worthless in dollars.
Keep it for the narrative — it is the most *legible* waste on screen — but do not lead
the demo with its saving figure. Lead with B1.

Detector: `tool_calls.name = 'Bash'`, normalize `input.command` (strip whitespace, env
prefixes, trailing args), group by session, flag count >= 3.

### A2. Polling / verification loops — `high`
A1 with a shape filter: commands matching `curl|status|ps |tail|test|pytest|npm run` that
repeat with near-identical output. Distinct framing — the model is *waiting*, not working.
Fix: a script that blocks until the condition is met and prints one line.

### A3. Re-reading files already in context — `high`
Same `file_path` read 2+ times in a session. **39 cases**, worst a 66 KB browser snapshot
read twice. The content is already in the context being re-read every turn — the second
Read pays for it a second time.

### A4. Rework loops — `medium`
Same `file_path` edited 3+ times in one session. **43 cases across 7 sessions**, worst
29 edits to `chalk/scripts/seed.py`. Framing: "you paid for this file 29 times."
Fix: plan mode first, or write the whole file once.

### A5. Declined transactions — `high`
**892 of 10,139 tool results are errors (8.8%)**. Each failed tool call burns a full turn.
Group by error class (command not found, no such file, permission denied) and name the
top recurring failure. Fix: an allowlist entry, a correct path in CLAUDE.md, a
`cd` that was missing.

---

## B. Per-turn context reducers

### B1. Fat tool payloads are annuities — `high`
One `browser_take_screenshot` = 153 KB ≈ **38k tokens**, and it is re-read on every later
turn in the session. Cost as `tokens x turns_remaining x cache_read_rate`.
Fix: screenshot to a file path and let the model read it only if needed; prefer
`browser_snapshot` (5.8 KB) over full screenshots for assertions.

### B2. Subagent context scoping — `high`
**168 subagent boots, median 16,743 startup tokens, p90 17,631.**
The tight spread is the finding: every subagent is handed the *same* boilerplate context
regardless of its job. ~2.8M tokens spent just booting subagents.

Dollar value is small (**~$0.38/month**) because those boots are Haiku-priced. Present
this as a context-discipline observation, not a savings card.

Fix: "Your subagents all start with ~17k tokens of context. A subagent that renames a
symbol needs the spec and 2 files, not the repo. Scope each agent's context to its job."
This is a direct read of the user's own AGENTS.md/CLAUDE.md discipline.

### B3. Recurring charges — `high`
Always-on tax paid before you type: per-project first-turn `cache_creation` floor
(jobpilot 13,380 tok min across 31 sessions), plus `skill_listing` (~176 tok x231) and
`deferred_tools_delta` (~1.5k tok x253) injections. Multiply by session count for a
monthly figure. Framed as a subscription audit.

### B4. Context hygiene / session length — `medium`
Sessions run to 1,032 turns (p90 593). Once per-turn `cache_read` crosses ~150k, every
subsequent turn pays near-max context for possibly-unrelated work.
Fix: "Sessions past N turns cost $X/turn. Start fresh after a task closes."

### B5. Cache TTL mismatch — `medium`, and nobody else surfaces this
Cache writes split **11.29M @ 1h (2x input price)** vs **9.38M @ 5m (1.25x)**.
Compare the chosen TTL against the actual inter-turn gap distribution: 1h writes on a
session with 30-second gaps overpay; 5m writes with long think-gaps force re-writes.
Quantify both directions from timestamps we already have.

---

## C. Model routing (the prompt-specificity idea)

### C1. Prompt specificity score — `heuristic`, and this is the differentiated one
Score each user prompt on local, deterministic features — no LLM needed:

- **+** contains file paths, function/symbol names, line numbers, exact error text
- **+** imperative single verb ("rename", "add", "fix"), explicit acceptance criteria
- **+** short and bounded, references prior turn output
- **−** hedges and open scope: "maybe", "something like", "figure out", "look into",
  "explore", "what do you think", "clean this up"
- **−** no nouns the repo recognizes; multiple questions in one prompt

High specificity + the turn's actual output was small + few tool calls
→ **"a smaller model could have done this."** Show the prompt, the score, and the
Sonnet/Haiku reprice. Aggregate: "38% of your Opus turns were high-specificity mechanical
edits — routing those to Sonnet saves $X/mo at 7.2x cheaper per turn."

The inverse recommendation matters just as much: **low specificity + long session +
rework** → "this prompt was vague and cost 9 turns. Prompts like this are where plan mode
pays." That is the advisor voice, not the accountant voice.

### C2. Turn-shape routing — `medium`
Independent of prompt text: turns whose output is a single tool call with a small result
and no thinking block are mechanical by shape. Cross-check against C1 — agreement raises
confidence, disagreement lowers it. Honest about being a heuristic.

### C3. Plan mode advocacy — `medium`
**Plan mode appears in 8 of 241 permission-mode records.** Correlate sessions that
thrashed (A4 rework, high turn count) against plan usage and state the observed delta
from the user's own history rather than generic advice.

### C4. Effort routing — `medium`
`effort` is logged per turn (medium 3,439 / high 766). High effort on turns that turned
out mechanical is a direct overspend.

---

## D. Habits

### D1. Time-of-day burn — `high`
Calendar + hour x weekday heatmap. 24 days, all 7 weekdays, 16 of 24 hours.

### D2. Delegation ROI — `medium`
**56% of turns are subagents but only ~4.7% of dollars ($58.79 of $1,245).** The reason
is that subagent turns are overwhelmingly Haiku at $0.008/turn.

This inverts the expected story and is *better* than the one we planned: delegation is
already working. The honest card reads "you route the volume to the cheap model —
this is the one habit you should not change." An advisor that only ever scolds is not
credible; this is the card that proves the tool is measuring, not moralizing.

---

## Card contract

```ts
type Recommendation = {
  id: string
  category: 'loop' | 'context' | 'routing' | 'habit'
  title: string             // advisor voice, second person
  monthlySaving: number     // extrapolated from observed window
  confidence: 'high' | 'medium' | 'heuristic'
  evidence: { sessionId: string; turns: string[]; detail: string }[]
  fix: string               // one concrete action
}
```

Never show a saving without evidence behind it. A judge will click.
