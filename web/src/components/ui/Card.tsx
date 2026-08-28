import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'

type CardProps = Omit<ComponentPropsWithoutRef<typeof motion.div>, 'children'> & {
  /** disable the mount animation, e.g. for cards inside an already-animated stagger group */
  static?: boolean
  children?: ReactNode
}

export default function Card({ className, static: isStatic, children, ...props }: CardProps) {
  const shared = clsx(
    'rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)]',
    'shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]',
    className,
  )

  if (isStatic) {
    return (
      <div className={shared} {...(props as ComponentPropsWithoutRef<'div'>)}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      className={shared}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
