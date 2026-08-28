import { clsx } from 'clsx'

const fmtWhole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const fmtCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

type MoneyProps = {
  value: number
  /** show cents, e.g. for small line items. Default: values under $1000 show cents. */
  cents?: boolean
  className?: string
  sign?: boolean
}

export function formatMoney(value: number, cents?: boolean) {
  const useCents = cents ?? Math.abs(value) < 1000
  return useCents ? fmtCents.format(value) : fmtWhole.format(value)
}

export default function Money({ value, cents, className, sign }: MoneyProps) {
  const text = formatMoney(value, cents)
  const withSign = sign && value > 0 ? `+${text}` : text
  return <span className={clsx('tabular-nums', className)}>{withSign}</span>
}
