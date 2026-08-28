# Tokenomics

**Mint for your Claude Code tokens.**

A local-first dashboard that reads your Claude Code session transcripts and reframes AI
spend as personal finance: where tokens go, how much of it was productive, which habits
bleed money, and what to change.

## Privacy

There is no backend, and no upload. This is stronger than "local-only" — there is no
server that *could* receive a transcript. The app is a static SPA; all parsing and
analysis run client-side in a Web Worker. The only optional outbound call is an advisor
blurb, gated behind an explicit opt-in flag, which sends computed aggregates only —
never prompt text or file paths.

## Run locally

```
cd web
npm install
npm run dev
```

Opens on `http://localhost:5173`. The demo view loads a bundled, anonymized snapshot
(`web/public/demo.json`) so you see real numbers immediately. Use the folder picker to
point at your own `~/.claude/projects` and analyze your own transcripts — nothing leaves
the browser.

## Scan your own machine

```
node tools/scan.mjs
```

Generates a local snapshot from your own `~/.claude/projects` corpus that you can drag
into the app's snapshot importer, without going through the folder picker.

## Build

```
cd web
npm run build
```

Static output goes to `web/dist`.

## Deploy

The project deploys to Vercel as a static build from `web/`, configured in
[`vercel.json`](./vercel.json) (build command, output directory, SPA rewrite, and
security headers).

To deploy from a local machine:

```
npx vercel login      # interactive browser login, run this yourself
npx vercel link       # link this directory to a Vercel project
npx vercel --prod      # deploy
```

`vercel login` requires an interactive browser session, so it can't be run
non-interactively — run it yourself (in this Claude Code session, prefix with `!`, e.g.
`!npx vercel login`). Once authenticated, subsequent deploys can be automated.

CI (`.github/workflows/ci.yml`) runs a typecheck and build on every push.
