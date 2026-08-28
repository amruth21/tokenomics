import type { ReactNode } from 'react'
import { clsx } from 'clsx'

/**
 * A sizing/theming container for a chart to drop into (nivo, or a hand-rolled SVG sparkline).
 * Owns layout only — never draws data itself.
 */
export default function SparklineFrame({
  children,
  height = 64,
  className,
}: {
  children?: ReactNode
  height?: number | string
  className?: string
}) {
  return (
    <div
      className={clsx('w-full overflow-hidden', className)}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      {children}
    </div>
  )
}
