import Link from 'next/link'
import { BarChart2, TrendingUp, Calendar, BookOpen } from 'lucide-react'

interface Props {
  params: Promise<{ orgSlug: string }>
}

const CARDS = [
  {
    key: 'cashflow',
    title: 'Cash Flow',
    description: 'Доходи, витрати та баланс по місяцях у вигляді графіку',
    icon: BarChart2,
  },
  {
    key: 'pl',
    title: 'P&L',
    description: 'Прибутки та збитки по категоріях за обраний період',
    icon: TrendingUp,
  },
  {
    key: 'calendar',
    title: 'Календар',
    description: 'Рух коштів по днях — зручний перегляд по місяцях',
    icon: Calendar,
  },
  {
    key: 'balance',
    title: 'Баланс',
    description: "Активи, зобов’язання та власний капітал організації",
    icon: BookOpen,
  },
]

export default async function AnalyticsPage({ params }: Props) {
  const { orgSlug } = await params

  return (
    // The shared container and the reports' sub-navigation come from analytics/layout.tsx.
    <div>
      <div className="max-w-4xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Аналітика</h1>
          <p className="mt-1 text-ink-muted">Оберіть розділ для перегляду звітів</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CARDS.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.key}
                href={`/${orgSlug}/analytics/${card.key}`}
                className="group rounded-panel border border-line bg-surface p-6 transition-all hover:border-brand hover:shadow-panel"
              >
                <div className="mb-4 flex size-12 items-center justify-center rounded-field bg-brand-soft">
                  <Icon className="size-6 text-brand-soft-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-ink transition-colors group-hover:text-brand-soft-foreground">
                  {card.title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{card.description}</p>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
