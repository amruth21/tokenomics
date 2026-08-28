import type { Analysis } from '../types/analysis'
import { motion } from 'framer-motion'
import { CountUp, EmptyState, Facts, Lede, Masthead, N, Page, Section, ViewSkeleton, money, money0, shortDate, rise, EASE } from './_shared'

/** ASCII-style bar: filled blocks vs dotted remainder, drawn with type. */
function Bar({ fraction, tone }: { fraction: number; tone: string }) {
  const cells = 40
  const filled = Math.max(1, Math.round(fraction * cells))
  return (
    <span className="tracking-[-0.06em]" style={{ color: tone }}>
      {'█'.repeat(filled)}
      <span className="text-[var(--color-line-soft)]">{'░'.repeat(cells - filled)}</span>
    </span>
  )
}

export default function StatementView({ data }: { data: Analysis }) {
  if (!data) return <ViewSkeleton />
  const { summary, meta } = data
  if (!summary || summary.daily.length === 0) {
    return (
      <EmptyState
        title="NO LEDGER LOADED"
        body="Point Tokenomics at ~/.claude/projects. Parsing happens here, in this tab — nothing is uploaded."
      />
    )
  }

  const t = summary.totalTokens
  const total = t.cacheRead + t.cacheWrite + t.output + t.input
  const rows = [
    { k: 'CONTEXT RE-READ', v: t.cacheRead, c: 'var(--color-burn)' },
    { k: 'CONTEXT WRITTEN', v: t.cacheWrite, c: 'var(--color-accent)' },
    { k: 'ACTUAL OUTPUT', v: t.output + t.input, c: 'var(--color-cash)' },
  ]
  const peak = summary.daily.reduce((a, b) => (b.cost > a.cost ? b : a), summary.daily[0])
  const maxDay = peak.cost || 1

  return (
    <Page>
      <Masthead eyebrow={`tokenomics --statement --from ${shortDate(meta.from)} --to ${shortDate(meta.to)}`} />

      <motion.div {...rise(0.06)} className="mb-6">
        <p className="key">TOTAL SPEND</p>
        <div className="display num mt-1 text-[length:var(--text-hero)] text-[var(--color-text)]">
          <CountUp value={summary.totalCost} formatter={money} />
        </div>
      </motion.div>

      <Lede delay={0.18}>
        <N tone="burn">{Math.round(summary.readToWriteRatio)}</N> tokens re-read for every{' '}
        <N tone="default">1</N> written. Only{' '}
        <N tone="cash">{(summary.productiveRateDollars * 100).toFixed(1)}%</N> of this bought new work.
      </Lede>

      {/* Ledger breakdown — type-drawn bars, aligned columns */}
      <motion.div {...rise(0.3)} className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[38rem] text-sm">
          <tbody>
            {rows.map((r, i) => (
              <motion.tr
                key={r.k}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.36 + i * 0.08, duration: 0.4 }}
                className="border-b border-[var(--color-line-soft)] last:border-0"
              >
                <td className="key py-3 pr-6 align-middle whitespace-nowrap">{r.k}</td>
                <td className="py-3 align-middle"><Bar fraction={r.v / total} tone={r.c} /></td>
                <td className="num py-3 pl-6 text-right align-middle" style={{ color: r.c }}>
                  {(r.v / 1e6).toFixed(1)}M
                </td>
                <td className="num py-3 pl-4 text-right align-middle text-[var(--color-muted)]">
                  {((r.v / total) * 100).toFixed(1)}%
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      <Section title="LEDGER SUMMARY" delay={0.46}>
        <Facts
          items={[
            { k: 'Sessions', v: meta.sessions.toLocaleString() },
            { k: 'Turns', v: meta.turns.toLocaleString() },
            { k: 'Dupes skipped', v: meta.deduped.toLocaleString(), sub: 'streaming re-saves' },
            { k: 'Peak day', v: money(peak.cost), sub: shortDate(peak.date), tone: 'burn' },
          ]}
        />
      </Section>

      {/* Daily spend as a printed column chart — no chart library needed */}
      <Section
        title="DAILY SPEND"
        note={`Spiky, not steady. Peak day ran ${(peak.cost / (summary.totalCost / summary.daily.length)).toFixed(1)}× an average day.`}
        delay={0.56}
      >
        <div className="flex h-44 items-end gap-[3px] overflow-x-auto">
          {summary.daily.map((d, i) => (
            <motion.div
              key={d.date}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(2, (d.cost / maxDay) * 100)}%` }}
              transition={{ delay: 0.6 + i * 0.012, duration: 0.5, ease: EASE }}
              title={`${shortDate(d.date)} · ${money(d.cost)}`}
              className="min-w-[7px] flex-1 bg-[var(--color-accent-dim)] transition-colors hover:bg-[var(--color-accent)]"
            />
          ))}
        </div>
        <div className="rule mt-2" />
        <div className="mt-2 flex justify-between text-[0.68rem] text-[var(--color-muted)]">
          <span>{shortDate(summary.daily[0].date)}</span>
          <span className="num">max {money0(maxDay)}</span>
          <span>{shortDate(summary.daily[summary.daily.length - 1].date)}</span>
        </div>
      </Section>
    </Page>
  )
}
