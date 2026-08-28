import { Fragment } from 'react'
import type { Analysis } from '../types/analysis'
import { ResponsiveCalendar } from '@nivo/calendar'
import { nivoDarkTheme } from '../charts/theme'
import { EmptyState, Panel, ViewHeader, ViewSkeleton, money } from './_shared'

const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function HabitsView({ data }: { data: Analysis }) {
  if (!data) return <ViewSkeleton />
  const { habits } = data
  if (!habits || habits.calendar.length === 0) {
    return <EmptyState title="No habit data yet" body="Once sessions span a few days, your daily and hourly burn patterns show up here." />
  }

  const from = habits.calendar[0]?.day
  const to = habits.calendar[habits.calendar.length - 1]?.day
  const maxValue = Math.max(1, ...habits.calendar.map((d) => d.value))

  const maxHour = Math.max(1, ...habits.hourByWeekday.map((h) => h.value))

  return (
    <div className="p-8">
      <ViewHeader
        eyebrow="Habits"
        title="When you burn."
        subtitle="Daily spend across the window, and the hour-by-weekday pattern underneath it."
      />

      <Panel className="mb-6" delay={0.1}>
        <div className="mb-3 text-sm font-medium text-[#f2ece0]">Daily spend</div>
        <div className="h-40">
          {from && to && (
            <ResponsiveCalendar
              data={habits.calendar}
              from={from}
              to={to}
              theme={nivoDarkTheme}
              emptyColor="#262019"
              colors={['#0f2818', '#16401f', '#1f6b2c', '#2fa83e', '#869c5a']}
              margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
              yearSpacing={40}
              monthBorderColor="#1d1810"
              dayBorderWidth={2}
              dayBorderColor="#1d1810"
              tooltip={({ day, value }) => (
                <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 text-xs">
                  <div className="text-[var(--color-muted)]">{day}</div>
                  <div className="font-mono font-semibold text-[#f2ece0]">{money(Number(value))}</div>
                </div>
              )}
            />
          )}
        </div>
        <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-[var(--color-muted)]">
          <span>less</span>
          {['#262019', '#0f2818', '#16401f', '#1f6b2c', '#2fa83e', '#869c5a'].map((c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
          ))}
          <span>more</span>
        </div>
      </Panel>

      <Panel delay={0.2}>
        <div className="mb-3 text-sm font-medium text-[#f2ece0]">Hour of day × weekday</div>
        <div className="overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-[3rem_repeat(24,1fr)] gap-[3px]">
            <div />
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="text-center text-[9px] text-[var(--color-muted)]">
                {h % 3 === 0 ? h : ''}
              </div>
            ))}
            {WEEKDAY_ORDER.map((wd) => (
              <Fragment key={wd}>
                <div className="flex items-center text-xs text-[var(--color-muted)]">{wd}</div>
                {Array.from({ length: 24 }).map((_, h) => {
                  const cell = habits.hourByWeekday.find((c) => c.weekday === wd && c.hour === h)
                  const v = cell?.value ?? 0
                  const intensity = v / maxHour
                  return (
                    <div
                      key={`${wd}-${h}`}
                      title={`${wd} ${h}:00 — $${v}`}
                      className="aspect-square rounded-[3px]"
                      style={{
                        background: intensity === 0 ? '#262019' : `rgba(74, 222, 128, ${0.12 + intensity * 0.85})`,
                      }}
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
        <div className="mt-3 text-xs text-[var(--color-muted)]">Max value shown: {maxValue > 0 ? money(maxValue) : '—'}</div>
      </Panel>
    </div>
  )
}
