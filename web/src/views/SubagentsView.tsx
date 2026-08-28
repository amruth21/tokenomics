import type { Analysis } from '../types/analysis'
import { motion } from 'framer-motion'
import { EmptyState, Facts, Lede, Masthead, N, Page, RankRow, Section, ViewSkeleton, compactTokens, money, pct, rise } from './_shared'

export default function SubagentsView({ data }: { data: Analysis }) {
  if (!data) return <ViewSkeleton />
  const s = data.subagents
  if (!s || s.runs === 0) {
    return <EmptyState title="NO DELEGATION" body="No subagent runs in this window — every turn ran in the main session." />
  }
  const totalCost = data.summary?.totalCost ?? 0
  const dollarShare = totalCost > 0 ? s.totalCost / totalCost : 0
  const working = s.shareOfTurns > dollarShare * 1.5
  const maxParent = Math.max(...s.byParent.map((p) => p.cost), 1)
  const spread = s.p90BootTokens - s.medianBootTokens

  return (
    <Page>
      <Masthead eyebrow="tokenomics --subagents --delegation-roi" />
      <motion.div {...rise(0.06)} className="mb-5">
        <p className="key">SHARE OF TURNS / SHARE OF DOLLARS</p>
        <div className="display num mt-1 text-[length:var(--text-hero)]">
          <span className="text-[var(--color-text)]">{pct(s.shareOfTurns, 0)}</span>
          <span className="mx-3 text-[var(--color-muted)]">/</span>
          <span className="text-[var(--color-cash)]">{pct(dollarShare, 1)}</span>
        </div>
      </motion.div>

      <Lede delay={0.16}>
        {working ? (
          <>
            Delegation is <span className="text-[var(--color-cash)]">working</span>. Subagents are{' '}
            <N tone="default">{pct(s.shareOfTurns, 0)}</N> of your turns but only{' '}
            <N tone="cash">{pct(dollarShare, 1)}</N> of the spend, because that volume runs on the
            cheap model. This is the one habit not to change.
          </>
        ) : (
          <>
            Subagents are <N tone="burn">{pct(dollarShare, 1)}</N> of spend against{' '}
            <N tone="default">{pct(s.shareOfTurns, 0)}</N> of turns — delegation is costing more per
            turn than working inline.
          </>
        )}
      </Lede>

      <Section title="BOOT COST" note="Every agent pays a startup context before it does any work." delay={0.28}>
        <Facts
          cols={4}
          items={[
            { k: 'Runs', v: s.runs.toLocaleString() },
            { k: 'Median boot', v: compactTokens(s.medianBootTokens), sub: 'tokens before work' },
            { k: 'p90 boot', v: compactTokens(s.p90BootTokens), sub: `spread ${compactTokens(spread)}` },
            { k: 'Total cost', v: money(s.totalCost), tone: 'accent' },
          ]}
        />
        <div className="mt-8 border border-[var(--color-line-soft)] bg-[var(--color-surface)] p-5">
          <p className="key !text-[var(--color-accent)]">THE TELL</p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--color-text-dim)]">
            The p50→p90 spread is only <span className="num text-[var(--color-text)]">{compactTokens(spread)}</span>{' '}
            tokens. Every agent boots with nearly the same payload regardless of its job — a rename
            agent is handed what an architecture agent gets. Scope each agent to its spec and the
            files it owns.
          </p>
          <div className="mt-4 flex items-center gap-1 text-[0.7rem]">
            <span className="key">p50</span>
            <div className="h-3 flex-1 bg-[var(--color-line-soft)]">
              <div className="h-full bg-[var(--color-accent-dim)]" style={{ width: `${(s.medianBootTokens / s.p90BootTokens) * 100}%` }} />
            </div>
            <span className="key">p90</span>
          </div>
        </div>
      </Section>

      <Section title="BY PARENT SESSION" delay={0.46}>
        <div>
          {s.byParent.slice(0, 10).map((p, i) => (
            <RankRow
              key={p.sessionId}
              rank={i + 1}
              label={p.sessionId}
              meta={`${p.runs} runs`}
              fraction={p.cost / maxParent}
              value={money(p.cost)}
              tone="cash"
              delay={0.5 + i * 0.04}
            />
          ))}
        </div>
      </Section>
    </Page>
  )
}
