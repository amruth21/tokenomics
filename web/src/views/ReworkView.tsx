import type { Analysis } from '../types/analysis'
import { motion } from 'framer-motion'
import { EmptyState, Lede, Masthead, N, Page, RankRow, Section, ViewSkeleton, money, pct, rise } from './_shared'

export default function ReworkView({ data }: { data: Analysis }) {
  if (!data) return <ViewSkeleton />
  const rw = data.rework
  if (!rw) return <ViewSkeleton />
  const cases = [...(rw.cases ?? [])].sort((a, b) => b.edits - a.edits)
  const worst = cases[0]
  const maxEdits = worst?.edits || 1
  const totalCost = cases.reduce((s, c) => s + c.cost, 0)

  if (cases.length === 0 && rw.errorRate === 0) {
    return <EmptyState title="CLEAN RUN" body="No repeat edits and no failed tool calls in this window." />
  }

  return (
    <Page>
      <Masthead eyebrow="tokenomics --rework --declined" />
      <motion.div {...rise(0.06)} className="mb-5">
        <p className="key">DECLINED TRANSACTIONS</p>
        <div className="display num mt-1 text-[length:var(--text-hero)] text-[var(--color-burn)]">
          {pct(rw.errorRate, 1)}
        </div>
      </motion.div>

      <Lede delay={0.16}>
        {pct(rw.errorRate, 1)} of tool calls came back as errors, and each one burned a full turn
        before producing anything.
        {worst && (
          <>
            {' '}The worst file was rewritten <N tone="burn">{worst.edits}</N> times in a single
            session — you paid for it {worst.edits} times over.
          </>
        )}
      </Lede>

      {cases.length > 0 && (
        <Section
          title="REPEAT EDITS"
          note="Same file written 3+ times inside one session. Usually a sign the approach was not settled before the edits started."
          delay={0.28}
        >
          <div>
            {cases.slice(0, 12).map((c, i) => (
              <RankRow
                key={`${c.sessionId}-${c.path}-${i}`}
                rank={i + 1}
                label={c.path.split('/').slice(-2).join('/')}
                meta={`session ${c.sessionId.slice(0, 8)} · ${c.edits} writes`}
                fraction={c.edits / maxEdits}
                value={`${c.edits}×`}
                tone={i === 0 ? 'burn' : 'accent'}
                delay={0.34 + i * 0.04}
              />
            ))}
          </div>
          <div className="rule-double mt-6 pt-3 text-right">
            <span className="key">ATTRIBUTED COST </span>
            <span className="display num ml-2 text-lg text-[var(--color-burn)]">{money(totalCost)}</span>
          </div>
        </Section>
      )}

      <Section title="WHAT TO DO" delay={0.5}>
        <div className="border-l-2 border-[var(--color-accent-dim)] bg-[var(--color-surface)] p-5">
          <p className="text-sm leading-relaxed text-[var(--color-text-dim)]">
            Rework is the cheapest waste to remove because it needs no new tooling. Settle the
            approach before the first write — plan mode exists for exactly this shape of work — and
            fix the recurring tool failures at their source: a missing path in CLAUDE.md, a command
            that needs an allowlist entry, a directory the agent never had.
          </p>
        </div>
      </Section>
    </Page>
  )
}
