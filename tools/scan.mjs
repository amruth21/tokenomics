#!/usr/bin/env node
// tools/scan.mjs — zero-dependency Node ESM CLI.
//
// Walks ~/.claude/projects/**/*.jsonl (Claude Code session transcripts),
// streams each file line-by-line, and emits an ANONYMIZED aggregate snapshot
// that the Tokenomics web app can load in place of live files.
//
// Privacy contract (see tools/SNAPSHOT.md for the full shape):
//   - session ids are sha256-hashed, first 8 hex chars only
//   - absolute file/cwd paths are reduced to basenames ("~" for the home dir)
//   - prompt text, tool_result content, ai-title text, and gitBranch are NEVER
//     copied into the output — only derived numbers (byte counts, token
//     counts, occurrence counts) and a keyed hash for repeat-detection.
//
// Usage:
//   node tools/scan.mjs [--dir <path>] [--out <path>] [--stdout] [--exclude <substr>]...
//
// Flags:
//   --dir <path>       Root to scan (default: ~/.claude/projects)
//   --out <path>       Output file path (default: ./tokenomics-snapshot.json)
//   --stdout           Print the JSON to stdout instead of writing a file
//   --exclude <substr> Skip any file whose path contains this substring.
//                       Repeatable. (Used to keep this project's own working
//                       corpus out of the public demo snapshot.)
//   --rollup           Aggregate to per-session granularity instead of
//                       per-turn. Use when per-turn output would be too large
//                       to ship (see docs/data-model.md scale numbers).

import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { dir: null, out: null, stdout: false, exclude: [], rollup: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') args.dir = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--stdout') args.stdout = true;
    else if (a === '--rollup') args.rollup = true;
    else if (a === '--exclude') args.exclude.push(argv[++i]);
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

const HELP = `
Tokenomics scanner — turns Claude Code transcripts into an anonymized snapshot.

Usage:
  node tools/scan.mjs [options]

Options:
  --dir <path>       Root to scan (default: ~/.claude/projects)
  --out <path>        Output file (default: ./tokenomics-snapshot.json)
  --stdout            Print JSON to stdout instead of writing a file
  --exclude <substr>  Skip file paths containing this substring (repeatable)
  --rollup            Aggregate to per-session instead of per-turn (smaller output)
  -h, --help          Show this help

No network calls. No data leaves your machine unless you drag the output file
onto a web page yourself.
`;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function sha8(str) {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 8);
}

const HOME = os.homedir();

/** Reduce an absolute cwd path to a safe, non-identifying label. */
function cwdLabel(cwdRaw) {
  if (!cwdRaw || typeof cwdRaw !== 'string') return 'unknown';
  if (cwdRaw === HOME) return '~';
  // basename only — never the full path, which could contain the username
  // in every intermediate segment on some setups.
  const base = path.basename(cwdRaw);
  return base || '~';
}

/** Reduce an absolute file path (e.g. Edit/Write tool_use.input.file_path) to a basename. */
function fileBasename(p) {
  if (!p || typeof p !== 'string') return null;
  return path.basename(p);
}

async function* readLines(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line) yield line;
  }
}

async function findJsonlFiles(root, excludes) {
  const out = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (excludes.some((ex) => full.includes(ex))) continue;
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile() && ent.name.endsWith('.jsonl')) {
        out.push(full);
      }
    }
  }
  await walk(root);
  return out.sort();
}

function isSubagentFile(filePath) {
  return filePath.split(path.sep).includes('subagents');
}

function byteLenOfToolResultContent(content) {
  if (content == null) return 0;
  if (typeof content === 'string') return Buffer.byteLength(content, 'utf8');
  try {
    return Buffer.byteLength(JSON.stringify(content), 'utf8');
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// core: two-pass per-file processing
// ---------------------------------------------------------------------------

/**
 * @returns {{
 *   sessionIdRaw: string|null,
 *   isSubagent: boolean,
 *   turns: Map<string, object>,  // requestId -> turn record
 *   rawAssistantCount: number,
 *   dupCount: number,
 *   attachments: Map<string, {count:number, bytes:number}>,
 *   permissionModes: Map<string, number>,
 * }}
 */
async function processFile(filePath, excludes) {
  const subagent = isSubagentFile(filePath);
  const excludeCwd = (cwdRaw) => typeof cwdRaw === 'string' && excludes.some((ex) => cwdRaw.includes(ex));

  // Pass 1: map tool_use id -> {name, requestId} over ALL assistant records,
  // including duplicates, BEFORE any dedup. Required so a tool_result in a
  // later line can always resolve its owning tool name + turn, even if the
  // tool_use only appeared on a since-superseded duplicate occurrence.
  const idToOwner = new Map();
  for await (const line of readLines(filePath)) {
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    if (rec.type !== 'assistant') continue;
    const content = rec.message && rec.message.content;
    if (!Array.isArray(content)) continue;
    const reqId = rec.requestId;
    for (const block of content) {
      if (block && block.type === 'tool_use' && block.id) {
        idToOwner.set(block.id, { name: block.name, reqId, input: block.input });
      }
    }
  }

  // Pass 2: build turn records, deduped by requestId (last occurrence wins —
  // streamed duplicates carry growing/completed usage numbers), and attach
  // tool_result byte sizes via the id -> owner map from pass 1.
  const turns = new Map(); // requestId -> turn
  const attachments = new Map();
  const permissionModes = new Map();
  let sessionIdRaw = null;
  let rawAssistantCount = 0;
  let dupCount = 0;

  for await (const line of readLines(filePath)) {
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    const t = rec.type;

    if (t === 'assistant') {
      sessionIdRaw = rec.sessionId || sessionIdRaw;
      const model = rec.message && rec.message.model;
      if (!model || model === '<synthetic>') continue; // trap #5: exclude synthetic
      if (excludeCwd(rec.cwd)) continue; // this turn's cwd matches an --exclude filter (self-tail)
      const reqId = rec.requestId;
      const usage = (rec.message && rec.message.usage) || {};
      const cc = usage.cache_creation || {};
      const label = cwdLabel(rec.cwd);

      let turn = turns.get(reqId);
      if (!turn) {
        turn = {
          ts: Date.parse(rec.timestamp) || null,
          m: model,
          sc: rec.isSidechain ? 1 : 0,
          eff: rec.effort || null,
          sub: subagent ? 1 : 0,
          cwd: label,
          u: [0, 0, 0, 0, 0],
          tools: [],
          editPath: null,
          toolErr: 0,
          _toolIds: new Set(),
        };
        turns.set(reqId, turn);
        rawAssistantCount++;
      } else {
        dupCount++;
      }

      // Last-write-wins for scalar/usage fields.
      turn.ts = Date.parse(rec.timestamp) || turn.ts;
      turn.m = model;
      turn.sc = rec.isSidechain ? 1 : 0;
      turn.eff = rec.effort || turn.eff;
      turn.cwd = label;
      turn.u = [
        usage.input_tokens || 0,
        cc.ephemeral_5m_input_tokens || 0,
        cc.ephemeral_1h_input_tokens || 0,
        usage.cache_read_input_tokens || 0,
        usage.output_tokens || 0,
      ];

      const content = rec.message && rec.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block && block.type === 'tool_use' && block.id && !turn._toolIds.has(block.id)) {
            turn._toolIds.add(block.id);
            const repeatKey = block.input ? sha8(JSON.stringify(block.input)) : null;
            turn.tools.push({ id: block.id, n: block.name, k: repeatKey, b: 0 });
            if ((block.name === 'Edit' || block.name === 'Write') && block.input && block.input.file_path) {
              turn.editPath = fileBasename(block.input.file_path);
            }
          }
        }
      }
    } else if (t === 'user') {
      const content = rec.message && rec.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block && block.type === 'tool_result' && block.tool_use_id) {
            const owner = idToOwner.get(block.tool_use_id);
            if (!owner) continue;
            const turn = turns.get(owner.reqId);
            if (!turn) continue;
            const bytes = byteLenOfToolResultContent(block.content);
            const slot = turn.tools.find((tt) => tt.id === block.tool_use_id);
            if (slot) slot.b = bytes;
            if (block.is_error) turn.toolErr = (turn.toolErr || 0) + 1;
          }
        }
      }
    } else if (t === 'attachment') {
      const at = rec.attachment || {};
      const kind = at.type || 'unknown';
      const bytes = (() => {
        try {
          return Buffer.byteLength(JSON.stringify(at), 'utf8');
        } catch {
          return 0;
        }
      })();
      const cur = attachments.get(kind) || { count: 0, bytes: 0 };
      cur.count++;
      cur.bytes += bytes;
      attachments.set(kind, cur);
    } else if (t === 'permission-mode') {
      const mode = rec.mode || rec.permissionMode || 'unknown';
      permissionModes.set(mode, (permissionModes.get(mode) || 0) + 1);
    }
  }

  // Strip internal bookkeeping fields before handing back.
  for (const turn of turns.values()) {
    delete turn._toolIds;
    turn.tools = turn.tools.map((tt) => ({ n: tt.n, b: tt.b, k: tt.k }));
  }

  return { sessionIdRaw, isSubagent: subagent, turns, rawAssistantCount, dupCount, attachments, permissionModes };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const dir = args.dir ? path.resolve(args.dir) : path.join(HOME, '.claude', 'projects');
  const outPath = args.out ? path.resolve(args.out) : path.resolve(process.cwd(), 'tokenomics-snapshot.json');

  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
  }

  const files = await findJsonlFiles(dir, args.exclude);
  if (files.length === 0) {
    console.error(`No .jsonl files found under ${dir}`);
    process.exit(1);
  }

  let totalBytes = 0;
  for (const f of files) {
    try {
      totalBytes += fs.statSync(f).size;
    } catch {
      /* ignore */
    }
  }

  process.stderr.write(`Scanning ${files.length} files (${(totalBytes / 1e6).toFixed(1)} MB) under ${dir}...\n`);

  // Aggregate state across the whole corpus.
  const allTurns = []; // finalized turn records with session hash attached
  let rawAssistantTotal = 0;
  let dupTotal = 0;
  const attachmentsTotal = new Map();
  const permissionModesTotal = new Map();
  const sessionSet = new Set(); // hashed session ids seen on MAIN (non-subagent) files
  const subagentFilesWithTurns = new Set(); // count of subagent files that yielded >=1 turn
  let filesScanned = 0;
  let filesSkipped = 0;

  for (const file of files) {
    let result;
    try {
      result = await processFile(file, args.exclude);
    } catch (err) {
      filesSkipped++;
      process.stderr.write(`  ! skipped ${file}: ${err.message}\n`);
      continue;
    }
    filesScanned++;

    if (!result.sessionIdRaw) continue;
    const sessionHash = sha8(result.sessionIdRaw);

    if (result.isSubagent) {
      if (result.turns.size > 0) subagentFilesWithTurns.add(file);
    } else {
      sessionSet.add(sessionHash);
    }

    rawAssistantTotal += result.rawAssistantCount;
    dupTotal += result.dupCount;

    for (const turn of result.turns.values()) {
      turn.s = sessionHash;
      allTurns.push(turn);
    }
    for (const [k, v] of result.attachments) {
      const cur = attachmentsTotal.get(k) || { count: 0, bytes: 0 };
      cur.count += v.count;
      cur.bytes += v.bytes;
      attachmentsTotal.set(k, cur);
    }
    for (const [k, v] of result.permissionModes) {
      permissionModesTotal.set(k, (permissionModesTotal.get(k) || 0) + v);
    }

    if (filesScanned % 25 === 0) {
      process.stderr.write(`  ...${filesScanned}/${files.length} files\n`);
    }
  }

  allTurns.sort((a, b) => (a.ts || 0) - (b.ts || 0));

  // ---- build output -------------------------------------------------------

  const modelDict = [];
  const modelIdx = new Map();
  const cwdDict = [];
  const cwdIdx = new Map();
  const toolDict = [];
  const toolIdx = new Map();

  function dictIndex(dict, idx, value) {
    if (idx.has(value)) return idx.get(value);
    const i = dict.length;
    dict.push(value);
    idx.set(value, i);
    return i;
  }

  const turnsOut = args.rollup ? null : [];
  const sessionRollup = args.rollup ? new Map() : null;

  for (const turn of allTurns) {
    const mIdx = dictIndex(modelDict, modelIdx, turn.m);
    const cIdx = dictIndex(cwdDict, cwdIdx, turn.cwd);
    const tools = turn.tools.map((tt) => {
      const nIdx = dictIndex(toolDict, toolIdx, tt.n);
      return [nIdx, tt.b, tt.k];
    });

    if (!args.rollup) {
      turnsOut.push([
        turn.s, // 0 session hash
        turn.ts, // 1 epoch ms
        mIdx, // 2 model dict index
        turn.sc, // 3 isSidechain
        turn.sub, // 4 isSubagent file
        turn.eff, // 5 effort
        turn.u, // 6 [input, cache5m, cache1h, cacheRead, output]
        cIdx, // 7 cwd dict index
        turn.toolErr, // 8 tool error count on this turn
        turn.editPath, // 9 basename of Edit/Write target, or null
        tools, // 10 [[toolNameIdx, bytes, repeatKeyHash], ...]
      ]);
    } else {
      const key = `${turn.s}|${turn.cwd}`;
      let s = sessionRollup.get(key);
      if (!s) {
        s = {
          s: turn.s,
          cwd: turn.cwd,
          turns: 0,
          sidechainTurns: 0,
          subagentFileTurns: 0,
          from: turn.ts,
          to: turn.ts,
          models: new Map(), // modelIdx -> {turns, u:[5]}
          tools: new Map(), // toolNameIdx -> {calls, bytes}
          toolErr: 0,
          editCounts: new Map(), // basename -> count
        };
        sessionRollup.set(key, s);
      }
      s.turns++;
      if (turn.sc) s.sidechainTurns++;
      if (turn.sub) s.subagentFileTurns++;
      s.from = Math.min(s.from ?? turn.ts, turn.ts ?? s.from);
      s.to = Math.max(s.to ?? turn.ts, turn.ts ?? s.to);
      s.toolErr += turn.toolErr;
      let ms = s.models.get(mIdx);
      if (!ms) {
        ms = { turns: 0, u: [0, 0, 0, 0, 0] };
        s.models.set(mIdx, ms);
      }
      ms.turns++;
      for (let i = 0; i < 5; i++) ms.u[i] += turn.u[i];
      for (const [nIdx, bytes] of tools) {
        let ts = s.tools.get(nIdx);
        if (!ts) {
          ts = { calls: 0, bytes: 0 };
          s.tools.set(nIdx, ts);
        }
        ts.calls++;
        ts.bytes += bytes;
      }
      if (turn.editPath) {
        s.editCounts.set(turn.editPath, (s.editCounts.get(turn.editPath) || 0) + 1);
      }
    }
  }

  let sessionsOut;
  if (args.rollup) {
    sessionsOut = [];
    for (const s of sessionRollup.values()) {
      sessionsOut.push({
        s: s.s,
        cwd: s.cwd,
        turns: s.turns,
        sidechainTurns: s.sidechainTurns,
        subagentFileTurns: s.subagentFileTurns,
        from: s.from,
        to: s.to,
        toolErr: s.toolErr,
        models: Array.from(s.models.entries()).map(([mIdx, v]) => [mIdx, v.turns, v.u]),
        tools: Array.from(s.tools.entries()).map(([nIdx, v]) => [nIdx, v.calls, v.bytes]),
        edits: Array.from(s.editCounts.entries())
          .filter(([, n]) => n > 1)
          .map(([p, n]) => [p, n]),
      });
    }
  }

  const attachmentsOut = Array.from(attachmentsTotal.entries()).map(([type, v]) => ({
    type,
    count: v.count,
    bytes: v.bytes,
  }));
  const permissionModesOut = Object.fromEntries(permissionModesTotal);

  const timestamps = allTurns.map((t) => t.ts).filter(Boolean);
  const from = timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null;
  const to = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;

  const snapshot = {
    schema: 'tokenomics-snapshot@1',
    meta: {
      generatedAt: new Date().toISOString(),
      filesScanned,
      filesSkipped,
      sessions: sessionSet.size,
      subagentRuns: subagentFilesWithTurns.size,
      turnsRawAssistant: rawAssistantTotal + dupTotal,
      turnsUnique: allTurns.length,
      deduped: dupTotal,
      from,
      to,
      rollup: !!args.rollup,
    },
    dict: { models: modelDict, cwds: cwdDict, tools: toolDict },
    ...(args.rollup ? { sessions: sessionsOut } : { turns: turnsOut }),
    attachments: attachmentsOut,
    permissionModes: permissionModesOut,
  };

  const json = JSON.stringify(snapshot);
  const sizeKB = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(1);

  if (args.stdout) {
    process.stdout.write(json + '\n');
  } else {
    fs.writeFileSync(outPath, json);
  }

  // ---- summary --------------------------------------------------------
  const cacheRead = allTurns.reduce((sum, t) => sum + (t.u[3] || 0), 0);
  const output = allTurns.reduce((sum, t) => sum + (t.u[4] || 0), 0);

  process.stderr.write('\n');
  process.stderr.write(`Scanned:        ${filesScanned} files (${filesSkipped} skipped)\n`);
  process.stderr.write(`Sessions:       ${sessionSet.size}\n`);
  process.stderr.write(`Subagent runs:  ${subagentFilesWithTurns.size}\n`);
  process.stderr.write(`Turns:          ${allTurns.length} unique (${rawAssistantTotal + dupTotal} raw assistant records, ${dupTotal} deduped as requestId repeats)\n`);
  process.stderr.write(`Cache-read tok: ${(cacheRead / 1e6).toFixed(2)}M\n`);
  process.stderr.write(`Output tok:     ${(output / 1e6).toFixed(2)}M\n`);
  process.stderr.write(`Date range:     ${from} -> ${to}\n`);
  process.stderr.write(`Output size:    ${sizeKB} KB${args.rollup ? ' (rolled up per-session)' : ' (per-turn)'}\n`);
  if (!args.stdout) {
    process.stderr.write(`Wrote:          ${outPath}\n`);
    process.stderr.write(`\nDrag ${path.basename(outPath)} onto the live Tokenomics URL to load it as your snapshot.\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
