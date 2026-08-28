import type { Analysis } from '../types/analysis'
import { EmptyState, Lede, Masthead, N, Page, RankRow, Section, ViewSkeleton, compactTokens, money, rise } from './_shared'
import { motion } from 'framer-motion'

export default function ToolsView({ data }: { data: Analysis }) {
  if (!data) return <ViewSkeleton />
  const tools = [...(data.tools ?? [])].sort((a, b) => b.annuityCost - a.annuityCost)
  if (tools.length === 0) return <EmptyState title="NO TOOL CALLS" body="No tool output was recorded in this window." />

  const worst = tools[0]
  const maxCost = worst.annuityCost || 1
  const totalAnnuity = tools.reduce((s, t) => s + t.annuityCost, 0)

  return (
    <Page>
      <Masthead eyebrow="tokenomics --tools --sort annuity" />
      <motion.div {...rise(0.06)} className="mb-5">
        <p className="key">RE-READ COST OF TOOL OUTPUT</p>
        <div className="display num mt-1 text-[length:var(--text-hero)] text-[var(--color-burn)]">
          {money(totalAnnuity)}
        </div>
      </motion.div>

      <Lede delay={0.16}>
        A fat tool result is not a one-time charge, it is an annuity. One{' '}
        <span className="text-[var(--color-text)]">{worst.name}</span> returns{' '}
        <N tone="burn">{compactTokens(worst.avgTokens)}</N> tokens, and every turn after it in the
        session pays to read them again.
      </Lede>

      <Section title="VENDORS BY RE-READ COST" note="Ranked by what the payload costs across the rest of the session, not by call count." delay={0.28}>
        <div>
          {tools.map((t, i) => (
            <RankRow
              key={t.name}
              rank={i + 1}
              label={t.name}
              meta={`${t.calls.toLocaleString()} calls · ${compactTokens(t.avgTokens)} tok avg · ${(t.bytes / 1e6).toFixed(2)} MB total`}
              fraction={t.annuityCost / maxCost}
              value={money(t.annuityCost)}
              tone={i === 0 ? 'burn' : 'accent'}
              delay={0.34 + i * 0.05}
            />
          ))}
        </div>
      </Section>

      <Section title="THE ARITHMETIC" delay={0.5}>
        <div className="border border-[var(--color-line-soft)] bg-[var(--color-surface)] p-5 text-sm leading-relaxed">
          <pre className="overflow-x-auto text-[0.78rem] text-[var(--color-text-dim)]">
{`payload        ${compactTokens(worst.avgTokens).padStart(8)} tokens
× turns after it in session
× cache-read rate
────────────────────────────────
annuity        ${money(worst.annuityCost).padStart(8)}  ← ${worst.name}`}
          </pre>
          <p className="mt-4 text-[var(--color-muted)]">
            Cheapest fix: capture to a file and read it only when you need to look. Prefer a
            structured snapshot over a full screenshot when you are asserting, not inspecting.
          </p>
        </div>
      </Section>
    </Page>
  )
}
