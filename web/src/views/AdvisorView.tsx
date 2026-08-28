import { useState } from 'react'
import type { Analysis, Recommendation } from '../types/analysis'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge, EmptyState, Lede, Masthead, N, Page, ViewSkeleton, money, rise, EASE } from './_shared'

function Card({ r, i }: { r: Recommendation; i: number }) {
  const [open, setOpen] = useState(false)
  const tone = r.monthlySaving >= 50 ? 'var(--color-burn)' : 'var(--color-accent)'
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28 + i * 0.07, duration: 0.55, ease: EASE }}
      className="border border-[var(--color-line-soft)] bg-[var(--color-surface)]"
    >
      <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="key !text-[var(--color-accent)]">{r.category}</span>
            <Badge tone={r.confidence}>{r.confidence}</Badge>
          </div>
          <h3 className="mt-2.5 text-[0.98rem] font-semibold leading-snug text-[var(--color-text)]">
            {r.title}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-text-dim)]">{r.body}</p>
          <div className="mt-4 border-l-2 border-[var(--color-accent-dim)] pl-3">
            <p className="key">FIX</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-dim)]">{r.fix}</p>
          </div>
        </div>
        <div className="sm:min-w-[8.5rem] sm:text-right">
          <p className="key">PER MONTH</p>
          <p className="display num mt-1 text-[length:var(--text-figure)]" style={{ color: tone }}>
            {money(r.monthlySaving)}
          </p>
        </div>
      </div>

      {r.evidence.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-2 border-t border-[var(--color-line-soft)] px-5 py-2.5 text-left text-[0.7rem] uppercase tracking-[0.14em] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-accent)]"
          >
            <span className="text-[var(--color-accent)]">{open ? '▾' : '▸'}</span>
            evidence · {r.evidence.length} {r.evidence.length === 1 ? 'entry' : 'entries'}
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ gridTemplateRows: '0fr', opacity: 0 }}
                animate={{ gridTemplateRows: '1fr', opacity: 1 }}
                exit={{ gridTemplateRows: '0fr', opacity: 0 }}
                transition={{ duration: 0.28, ease: EASE }}
                className="grid overflow-hidden"
              >
                <div className="min-h-0">
                  <table className="w-full text-[0.78rem]">
                    <tbody>
                      {r.evidence.map((e, k) => (
                        <tr key={k} className="border-t border-[var(--color-line-soft)]">
                          <td className="w-0 py-2 pl-5 pr-3 align-top text-[var(--color-muted)]">
                            {String(k + 1).padStart(2, '0')}
                          </td>
                          <td className="py-2 pr-3 align-top text-[var(--color-text-dim)]">{e.label}</td>
                          <td className="num whitespace-nowrap py-2 pr-3 text-right align-top text-[var(--color-muted)]">
                            {e.turns} turns
                          </td>
                          <td className="num whitespace-nowrap py-2 pr-5 text-right align-top text-[var(--color-text)]">
                            {money(e.cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.article>
  )
}

export default function AdvisorView({ data }: { data: Analysis }) {
  if (!data) return <ViewSkeleton />
  const advice = [...(data.advice ?? [])].sort((a, b) => b.monthlySaving - a.monthlySaving)
  if (advice.length === 0) {
    return <EmptyState title="NO FINDINGS" body="Nothing worth flagging in this window — which is itself a result." />
  }
  const total = advice.reduce((s, r) => s + r.monthlySaving, 0)
  const solid = advice.filter((r) => r.confidence === 'high').length

  return (
    <Page>
      <Masthead eyebrow="tokenomics --advise" />
      <motion.div {...rise(0.06)} className="mb-5">
        <p className="key">ADDRESSABLE PER MONTH</p>
        <div className="display num mt-1 text-[length:var(--text-hero)] text-[var(--color-accent)]">
          {money(total)}
        </div>
      </motion.div>
      <Lede delay={0.16}>
        <N>{advice.length}</N> findings, <N tone="cash">{solid}</N> at high confidence. Every figure
        opens to the exact turns it came from — the numbers are reproducible from your own machine.
      </Lede>
      <div className="mt-10 space-y-3">
        {advice.map((r, i) => (
          <Card key={r.id} r={r} i={i} />
        ))}
      </div>
    </Page>
  )
}
