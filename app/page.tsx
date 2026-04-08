import Link from 'next/link'
import { ArrowRight, Check, BarChart2, Calendar, ArrowLeftRight, Shield, Zap, Users } from 'lucide-react'
import { LandingNavLogin, LandingHeroLogin } from '@/components/landing/LandingAuthButtons'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-[#111111]">

      {/* ── NAV ── */}
      <header className="border-b border-[#e5e7eb] sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[6px] bg-[#00c896] flex items-center justify-center">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <span className="font-semibold text-lg">FinFlow</span>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm text-[#6b7280]">
            <Link href="#features" className="hover:text-[#111111] transition-colors">Можливості</Link>
            <Link href="#industries" className="hover:text-[#111111] transition-colors">Для кого</Link>
            <Link href="/pricing" className="hover:text-[#111111] transition-colors">Ціни</Link>
          </nav>
          <div className="flex items-center gap-3">
            <LandingNavLogin />
            <Link href="/register" className="inline-flex items-center gap-1.5 bg-[#00c896] hover:bg-[#00b384] text-white rounded-lg text-sm font-medium h-8 px-4 transition-colors">
              Спробувати безкоштовно
            </Link>
          </div>
        </div>
      </header>

      <main>

        {/* ── HERO ── */}
        <section className="bg-gradient-to-b from-[#f8fffe] to-white pt-20 pb-16 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-[#f0fdf9] border border-[#a7f3d0] text-[#065f46] text-xs font-medium px-3 py-1 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00c896]" />
              14 днів безкоштовно — без кредитної картки
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight mb-5">
              Позбавтесь рутини<br />
              <span className="text-[#00c896]">у фінансовому обліку</span>
            </h1>
            <p className="text-lg text-[#6b7280] leading-relaxed mb-8 max-w-2xl mx-auto">
              FinFlow автоматизує рух грошей, звіти P&L і Cash Flow для компаній 2–50 осіб.
              Замість Excel — один зрозумілий інструмент.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-[#00c896] hover:bg-[#00b384] text-white rounded-xl font-semibold h-12 px-8 text-base transition-colors shadow-sm shadow-[#00c89640]">
                Почати безкоштовно
                <ArrowRight className="w-4 h-4" />
              </Link>
              <LandingHeroLogin />
            </div>
            <p className="text-xs text-[#9ca3af] mt-4">Приєднались 2 400+ компаній з України та Польщі</p>
          </div>

          {/* App preview */}
          <div className="max-w-4xl mx-auto mt-14 rounded-2xl border border-[#e5e7eb] shadow-xl overflow-hidden bg-[#f9fafb]">
            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-white border-b border-[#e5e7eb]">
              <span className="w-3 h-3 rounded-full bg-[#fca5a5]" />
              <span className="w-3 h-3 rounded-full bg-[#fde68a]" />
              <span className="w-3 h-3 rounded-full bg-[#a7f3d0]" />
              <span className="text-xs text-[#9ca3af] ml-2">finflow.app/transactions</span>
            </div>
            <div className="p-6 grid grid-cols-3 gap-3">
              {[
                { label: 'Баланс', value: '₴248 350', color: '#00c896', sub: 'на рахунках' },
                { label: 'Дохід (місяць)', value: '+₴85 000', color: '#22c55e', sub: 'квітень 2026' },
                { label: 'Витрати (місяць)', value: '−₴52 400', color: '#ef4444', sub: 'квітень 2026' },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-xl border border-[#e5e7eb] p-4">
                  <p className="text-xs text-[#6b7280] mb-1">{card.label}</p>
                  <p className="text-xl font-bold tabular-nums" style={{ color: card.color }}>{card.value}</p>
                  <p className="text-xs text-[#9ca3af] mt-0.5">{card.sub}</p>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 space-y-2">
              {[
                { name: 'Оплата від клієнта «Альфа»', cat: 'Продажі', acc: 'Monobank', amount: '+₴45 000', color: '#22c55e' },
                { name: 'Оренда офісу', cat: 'Операційні', acc: 'PrivatBank', amount: '−₴12 000', color: '#ef4444' },
                { name: 'Зарплата команди', cat: 'Зарплата', acc: 'Monobank', amount: '−₴85 000', color: '#ef4444' },
              ].map((tx, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#e5e7eb] px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#111111]">{tx.name}</p>
                    <p className="text-xs text-[#9ca3af]">{tx.cat} · {tx.acc}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums" style={{ color: tx.color }}>{tx.amount}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <section className="border-y border-[#e5e7eb] py-10 px-6">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '2 400+', label: 'компаній довіряють' },
              { value: '94%', label: 'рекомендують друзям' },
              { value: '14 днів', label: 'безкоштовно' },
              { value: '4 хв', label: 'середній час на налаштування' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-bold text-[#111111]">{s.value}</p>
                <p className="text-sm text-[#6b7280] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FOR WHOM (industries) ── */}
        <section id="industries" className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold text-[#00c896] uppercase tracking-widest mb-3">Для кого</p>
              <h2 className="text-3xl font-bold">Оберіть свою нішу</h2>
              <p className="text-[#6b7280] mt-3 max-w-xl mx-auto">FinFlow підходить для різних типів бізнесу — від агенцій до рітейлу</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { icon: '🏢', title: 'IT та агенції', desc: 'Облік проектів, зарплат підрядників, клієнтських платежів' },
                { icon: '🛒', title: 'Торгівля', desc: 'Закупки, продажі, залишки, маржинальність по товарах' },
                { icon: '🏗️', title: 'Будівництво', desc: 'Кошториси, витрати по об\'єктах, авансові платежі' },
                { icon: '💆', title: 'Послуги', desc: 'Підписки, регулярні доходи, облік клієнтів' },
                { icon: '🏭', title: 'Виробництво', desc: 'Сировина, собівартість, виробничі витрати' },
                { icon: '📊', title: 'Для фінансистів', desc: 'P&L, Cash Flow, баланс — все в одному місці' },
              ].map((item) => (
                <div key={item.title} className="group p-5 rounded-2xl border border-[#e5e7eb] hover:border-[#00c896] hover:shadow-sm transition-all cursor-pointer bg-white">
                  <span className="text-2xl mb-3 block">{item.icon}</span>
                  <h3 className="font-semibold text-[#111111] mb-1.5">{item.title}</h3>
                  <p className="text-sm text-[#6b7280] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="py-20 px-6 bg-[#f9fafb]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold text-[#00c896] uppercase tracking-widest mb-3">Можливості</p>
              <h2 className="text-3xl font-bold">Все що потрібно — в одному місці</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  icon: ArrowLeftRight,
                  color: '#00c896',
                  bg: '#f0fdf9',
                  title: 'Транзакції в реальному часі',
                  desc: 'Додавайте доходи, витрати та перекази. Автокатегоризація, фільтри, пошук, повторювані платежі.',
                  items: ['Дохід / Витрата / Переказ', 'Фільтр по рахунку та категорії', 'Кольорове кодування'],
                },
                {
                  icon: BarChart2,
                  color: '#6366f1',
                  bg: '#f5f3ff',
                  title: 'Cash Flow та P&L',
                  desc: 'Графік руху грошей по місяцях і звіт прибутків/збитків з розбивкою по категоріях.',
                  items: ['Bar chart + лінія балансу', 'Pie charts по категоріях', 'Експорт CSV'],
                },
                {
                  icon: Calendar,
                  color: '#f59e0b',
                  bg: '#fffbeb',
                  title: 'Платіжний календар',
                  desc: 'Перегляд операцій по днях. Одразу видно де касовий розрив і які платежі заплановані.',
                  items: ['Навігація по місяцях', 'Щоденні підсумки', 'Заплановані платежі'],
                },
                {
                  icon: Zap,
                  color: '#ef4444',
                  bg: '#fef2f2',
                  title: 'Авторуль категоризації',
                  desc: 'Налаштуйте правила і система автоматично призначає категорії новим транзакціям.',
                  items: ['Умови по опису / сумі', 'Автоприсвоєння категорії', 'Вмк./Вимк. правила'],
                },
                {
                  icon: Shield,
                  color: '#22c55e',
                  bg: '#f0fdf4',
                  title: 'Командний доступ',
                  desc: 'Запрошуйте колег з різними ролями. Власник, адмін, редактор, переглядач.',
                  items: ['4 рівні доступу', 'Журнал дій', 'Multi-org підтримка'],
                },
                {
                  icon: Users,
                  color: '#f97316',
                  bg: '#fff7ed',
                  title: 'Запити на оплату',
                  desc: 'Менеджери створюють запити — фінансист перевіряє по бюджету і підтверджує.',
                  items: ['Перевірка бюджету', 'Апрув фінансиста', 'Статуси запитів'],
                },
              ].map((f) => {
                const Icon = f.icon
                return (
                  <div key={f.title} className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: f.bg }}>
                      <Icon className="w-5 h-5" style={{ color: f.color }} />
                    </div>
                    <h3 className="font-semibold text-lg text-[#111111] mb-2">{f.title}</h3>
                    <p className="text-sm text-[#6b7280] leading-relaxed mb-4">{f.desc}</p>
                    <ul className="space-y-1.5">
                      {f.items.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm text-[#374151]">
                          <Check className="w-3.5 h-3.5 text-[#00c896] shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── VS EXCEL ── */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold text-[#00c896] uppercase tracking-widest mb-3">Порівняння</p>
              <h2 className="text-3xl font-bold">Чому не Excel?</h2>
              <p className="text-[#6b7280] mt-3">Excel — інструмент для таблиць, не для фінансового обліку команди</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[#fecaca] bg-[#fff5f5] p-6">
                <p className="font-semibold text-[#ef4444] mb-4">Excel / Google Sheets</p>
                <ul className="space-y-3">
                  {[
                    'Ручне зведення кожного місяця',
                    'Формули ламаються при редагуванні',
                    'Немає спільного доступу в реальному часі',
                    'Помилки при копіюванні',
                    'Немає автоматичних звітів',
                    'Категорії — вручну, щоразу',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2 text-sm text-[#374151]">
                      <span className="text-[#ef4444] mt-0.5 shrink-0">✕</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-[#a7f3d0] bg-[#f0fdf9] p-6">
                <p className="font-semibold text-[#00c896] mb-4">FinFlow</p>
                <ul className="space-y-3">
                  {[
                    'Автоматичний підрахунок в реальному часі',
                    'Дані зберігаються без формул',
                    'Доступ для команди з будь-якого пристрою',
                    'Редагуйте що завгодно — нічого не ламається',
                    'Cash Flow і P&L готові автоматично',
                    'Автокатегоризація за правилами',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2 text-sm text-[#374151]">
                      <Check className="w-3.5 h-3.5 text-[#00c896] mt-0.5 shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section className="py-20 px-6 bg-[#f9fafb]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold text-[#00c896] uppercase tracking-widest mb-3">Відгуки</p>
              <h2 className="text-3xl font-bold">Що кажуть наші клієнти</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  text: '"Нарешті можу бачити реальний стан фінансів компанії без зведення таблиць. За 10 хвилин налаштував рахунки і почав вести облік."',
                  name: 'Олексій Ковальчук',
                  role: 'CEO, IT-агенція Kyiv',
                  avatar: 'О',
                },
                {
                  text: '"Cash Flow по місяцях — саме те що шукали. Тепер фінансист готує звіт для інвесторів за 5 хвилин замість 2 годин."',
                  name: 'Марина Дорошенко',
                  role: 'CFO, e-commerce',
                  avatar: 'М',
                },
                {
                  text: '"Використовуємо замість 1С для оперативного обліку. Простіше, швидше, не потребує бухгалтера для налаштування."',
                  name: 'Piotr Kowalski',
                  role: 'Власник, будівельна компанія PL',
                  avatar: 'P',
                },
              ].map((t) => (
                <div key={t.name} className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
                  <p className="text-sm text-[#374151] leading-relaxed mb-5 italic">{t.text}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#00c896] flex items-center justify-center text-white font-semibold text-sm shrink-0">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#111111]">{t.name}</p>
                      <p className="text-xs text-[#9ca3af]">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING TEASER ── */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-semibold text-[#00c896] uppercase tracking-widest mb-3">Тарифи</p>
              <h2 className="text-3xl font-bold">Проста ціна без сюрпризів</h2>
              <p className="text-[#6b7280] mt-3">Один тариф — повний доступ до всіх функцій</p>
            </div>
            <div className="max-w-sm mx-auto rounded-2xl border-2 border-[#00c896] bg-white p-8 text-center shadow-lg shadow-[#00c89615]">
              <p className="text-sm font-semibold text-[#00c896] uppercase tracking-wider mb-2">Pro</p>
              <div className="flex items-baseline justify-center gap-1 mb-1">
                <span className="text-4xl font-bold">$29</span>
                <span className="text-[#6b7280]">/ міс</span>
              </div>
              <p className="text-sm text-[#9ca3af] mb-6">або $290 / рік (економія 2 місяці)</p>
              <ul className="space-y-3 text-sm text-left mb-8">
                {['Необмежені транзакції', 'Необмежені рахунки', 'Cash Flow + P&L + Баланс', 'Командний доступ (до 5 осіб)', 'Авторуль категоризації', 'Експорт CSV / PDF'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#00c896] shrink-0" />
                    <span className="text-[#374151]">{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register" className="inline-flex items-center justify-center w-full bg-[#00c896] hover:bg-[#00b384] text-white rounded-xl font-semibold h-11 transition-colors">
                Почати 14 днів безкоштовно
              </Link>
              <p className="text-xs text-[#9ca3af] mt-3">Кредитна картка не потрібна</p>
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ── */}
        <section className="py-24 px-6 bg-gradient-to-br from-[#00c896] to-[#00a87e] text-white">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Почніть вести облік сьогодні
            </h2>
            <p className="text-white/80 text-lg mb-8">
              14 днів повного доступу. Налаштування за 4 хвилини. Без кредитної картки.
            </p>
            <Link href="/register" className="inline-flex items-center gap-2 bg-white text-[#00c896] hover:bg-white/90 rounded-xl font-bold h-12 px-10 text-base transition-colors shadow-lg">
              Створити акаунт безкоштовно
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#e5e7eb] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[5px] bg-[#00c896] flex items-center justify-center">
              <span className="text-white font-bold text-xs">F</span>
            </div>
            <span className="font-semibold">FinFlow</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-[#6b7280]">
            <Link href="#features" className="hover:text-[#111111] transition-colors">Можливості</Link>
            <Link href="/pricing" className="hover:text-[#111111] transition-colors">Ціни</Link>
            <Link href="#" className="hover:text-[#111111] transition-colors">Конфіденційність</Link>
            <Link href="#" className="hover:text-[#111111] transition-colors">Умови</Link>
          </nav>
          <p className="text-sm text-[#9ca3af]">© 2026 FinFlow</p>
        </div>
      </footer>

    </div>
  )
}
