import type { ReactNode } from 'react'
import { clsx } from 'clsx'

type SectionHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export default function SectionHeader({ title, subtitle, actions, className }: SectionHeaderProps) {
  return (
    <div className={clsx('mb-4 flex items-end justify-between gap-4', className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-[var(--color-muted)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}
