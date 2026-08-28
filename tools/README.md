# tools/scan.mjs

Scan your own Claude Code transcripts and load your real numbers into
Tokenomics — no upload, no account, no server.

## Run it

```
node tools/scan.mjs
```

That's it. It reads `~/.claude/projects/**/*.jsonl`, writes
`tokenomics-snapshot.json` into your current directory, and prints a summary.
Drag that file onto the live Tokenomics URL to load it as your dataset.

Zero dependencies — just Node (18+). No `npm install` required, so you can
also run it straight from a clone without touching `web/`:

```
node /path/to/tokenomics/tools/scan.mjs --dir ~/.claude/projects --out ~/Desktop/my-snapshot.json
```

Flags:

| Flag | Default | What it does |
|---|---|---|
| `--dir <path>` | `~/.claude/projects` | Where to look for `*.jsonl` transcripts |
| `--out <path>` | `./tokenomics-snapshot.json` | Where to write the snapshot |
| `--stdout` | off | Print JSON to stdout instead of writing a file |
| `--exclude <substr>` | none | Skip files/turns whose path or cwd contains this substring (repeatable) |
| `--rollup` | off | Aggregate to one record per session instead of per turn — use if your snapshot comes out too large to comfortably load |

## What it does and does not contain

**Contains:** hashed session ids, tool names, byte counts of tool results,
the 5 token-usage numbers per turn (input / cache-write-5m / cache-write-1h /
cache-read / output), timestamps, model names, effort levels, and basenames
of files touched (for edit/rework detection) and working directories (for
grouping by project).

**Does not contain, ever:** your prompts, Claude's responses, any tool result
content (file contents, command stdout, search results — only their byte
size), absolute file paths (only basenames; your home directory becomes
`"~"`), your username, git branch names, or session titles. Session ids are
one-way sha256 hashes truncated to 8 characters — they cannot be reversed to
the original id.

Nothing is sent anywhere. The script makes no network calls. You choose
whether to open the output file, and you choose whether to drag it onto a
web page.

See `tools/SNAPSHOT.md` for the exact JSON shape, field by field, and for how
to verify the privacy claim yourself with `grep`.
