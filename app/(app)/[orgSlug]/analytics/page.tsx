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
    color: '#00c896',
    bg: '#f0fdf9',
  },
  {
    key: 'pl',
    title: 'P&L',
    description: 'Прибутки та збитки по категоріях за обраний період',
    icon: TrendingUp,
    color: '#22c55e',
    bg: '#f0fdf4',
  },
  {
    key: 'calendar',
    title: 'Календар',
    description: 'Рух коштів по днях — зручний перегляд по місяцях',
    icon: Calendar,
    color: '#6366f1',
    bg: '#f5f3ff',
  },
  {
    key: 'balance',
    title: 'Баланс',
    description: "Активи, зобов\u2019язання та власний капітал організації",
    icon: BookOpen,
    color: '#f59e0b',
    bg: '#fffbeb',
  },
]

export default async function AnalyticsPage({ params }: Props) {
  const { orgSlug } = await params

  return (
    <main className="min-h-screen bg-[#f9fafb] p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Аналітика</h1>
          <p className="text-[#6b7280] mt-1">Оберіть розділ для перегляду звітів</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CARDS.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.key}
                href={`/${orgSlug}/analytics/${card.key}`}
                className="group rounded-2xl border border-[#e5e7eb] bg-white p-6 hover:shadow-md transition-all hover:border-[#d1d5db]"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: card.bg }}
                >
                  <Icon className="w-6 h-6" style={{ color: card.color }} />
                </div>
                <h2 className="text-lg font-semibold text-[#111111] group-hover:text-[#00c896] transition-colors">
                  {card.title}
                </h2>
                <p className="text-sm text-[#6b7280] mt-1 leading-relaxed">
                  {card.description}
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
