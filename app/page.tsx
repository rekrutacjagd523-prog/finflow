import Link from "next/link";
import { ArrowRight, Check, X, TrendingUp, CreditCard, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-[#111111]">
      {/* Nav */}
      <header className="border-b border-[#e5e7eb] sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-semibold text-lg tracking-tight">FinFlow</span>
          <nav className="hidden md:flex items-center gap-6 text-sm text-[#6b7280]">
            <Link href="#features" className="hover:text-[#111111] transition-colors">
              Можливості
            </Link>
            <Link href="/pricing" className="hover:text-[#111111] transition-colors">
              Ціни
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="text-sm text-[#6b7280] hover:text-[#111111] transition-colors hidden sm:block"
            >
              Увійти
            </Link>
            <Link href="/pricing">
              <Button
                size="sm"
                className="bg-[#00c896] hover:bg-[#00b384] text-white rounded-lg text-sm font-medium"
              >
                Спробувати безкоштовно
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="pt-20 pb-24 px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: text */}
            <div className="max-w-xl">
              <Badge className="mb-5 bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0] hover:bg-[#f0fdf4]">
                14 днів безкоштовно
              </Badge>
              <h1 className="text-4xl lg:text-5xl font-semibold leading-tight mb-5 text-[#111111]">
                Фінанси вашого бізнесу&nbsp;—
                <br />в одному місці
              </h1>
              <p className="text-lg text-[#6b7280] leading-relaxed mb-8">
                Рахунки, транзакції, Cash Flow і P&L для компаній 2–50 осіб.
                Без Excel, без ручного зведення, без втрат даних.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/pricing">
                  <Button
                    size="lg"
                    className="bg-[#00c896] hover:bg-[#00b384] text-white rounded-lg font-medium px-6"
                  >
                    Спробувати 14 днів безкоштовно
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-lg font-medium px-6 border-[#e5e7eb] text-[#111111]"
                >
                  Подивитись демо
                </Button>
              </div>
              <p className="mt-4 text-sm text-[#9ca3af]">
                Кредитна картка не потрібна
              </p>
            </div>

            {/* Right: app mockup */}
            <div className="bg-[#0f0f0f] rounded-2xl p-1 shadow-2xl">
              <div className="bg-[#111111] rounded-xl overflow-hidden">
                {/* Fake app header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  <span className="ml-3 text-xs text-white/40 font-mono">
                    finflow.app/transactions
                  </span>
                </div>
                {/* Fake transactions list */}
                <div className="p-4 space-y-2">
                  {[
                    {
                      label: "Оплата від клієнта «Альфа»",
                      amount: "+₴45 000",
                      color: "text-[#22c55e]",
                      cat: "Дохід",
                      date: "сьогодні",
                    },
                    {
                      label: "Оренда офісу",
                      amount: "-₴12 000",
                      color: "text-[#ef4444]",
                      cat: "Операційні",
                      date: "вчора",
                    },
                    {
                      label: "Переказ між рахунками",
                      amount: "₴20 000",
                      color: "text-[#6366f1]",
                      cat: "Переказ",
                      date: "вчора",
                    },
                    {
                      label: "Зарплата команди",
                      amount: "-₴85 000",
                      color: "text-[#ef4444]",
                      cat: "Зарплата",
                      date: "01 квіт",
                    },
                    {
                      label: "Передоплата від «Бета Груп»",
                      amount: "+₴30 000",
                      color: "text-[#22c55e]",
                      cat: "Дохід",
                      date: "31 бер",
                    },
                  ].map((tx, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/5"
                    >
                      <div>
                        <p className="text-sm text-white/90 font-medium">
                          {tx.label}
                        </p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {tx.cat} · {tx.date}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold tabular-nums ${tx.color}`}
                      >
                        {tx.amount}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Balance row */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                  <span className="text-xs text-white/40">Баланс</span>
                  <span className="text-sm font-semibold text-white tabular-nums">
                    ₴248 350
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 px-6 bg-[#f9fafb]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-14">
              <h2 className="text-3xl font-semibold text-[#111111] mb-3">
                Все що потрібно для фінансового обліку
              </h2>
              <p className="text-[#6b7280] text-lg max-w-xl">
                Жодних зайвих налаштувань. Починайте вести облік з першого дня.
              </p>
            </div>

            {/* Asymmetric features grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Big card — Transactions */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-8 border border-[#e5e7eb]">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-lg bg-[#f0fdf4] flex items-center justify-center">
                    <List className="w-5 h-5 text-[#00c896]" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#111111]">
                    Транзакції
                  </h3>
                </div>
                <p className="text-[#6b7280] mb-6 leading-relaxed">
                  Журнал доходів, витрат і переказів між рахунками. Пошук за
                  назвою, фільтр за категорією, діапазоном суми або датою.
                  Імпорт із CSV банку — одним файлом.
                </p>
                {/* Mini transaction list */}
                <div className="space-y-2 bg-[#f9fafb] rounded-xl p-4">
                  {[
                    {
                      label: "Оплата від клієнта",
                      amount: "+₴45 000",
                      color: "text-[#22c55e]",
                      tag: "Дохід",
                    },
                    {
                      label: "Оренда офісу",
                      amount: "-₴12 000",
                      color: "text-[#ef4444]",
                      tag: "Операційні",
                    },
                    {
                      label: "Зарплата",
                      amount: "-₴85 000",
                      color: "text-[#ef4444]",
                      tag: "Зарплата",
                    },
                  ].map((tx, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-white border border-[#f3f4f6]"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${
                            tx.tag === "Дохід"
                              ? "bg-[#f0fdf4] text-[#16a34a]"
                              : "bg-[#fef2f2] text-[#dc2626]"
                          }`}
                        >
                          {tx.tag}
                        </span>
                        <span className="text-sm text-[#111111]">
                          {tx.label}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-semibold tabular-nums ${tx.color}`}
                      >
                        {tx.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column: 2 small cards */}
              <div className="flex flex-col gap-6">
                {/* Cash Flow */}
                <div className="bg-white rounded-2xl p-6 border border-[#e5e7eb] flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-[#eef2ff] flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-[#6366f1]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#111111]">
                      Cash Flow
                    </h3>
                  </div>
                  <p className="text-[#6b7280] text-sm leading-relaxed mb-4">
                    Графік руху грошей по місяцях — одразу видно де дохід
                    більший за витрати, і навпаки.
                  </p>
                  {/* Mini bar chart */}
                  <div className="flex items-end gap-1.5 h-16">
                    {[60, 80, 50, 90, 70, 85].map((h, i) => (
                      <div key={i} className="flex-1">
                        <div
                          className="w-full bg-[#22c55e] rounded-sm opacity-70"
                          style={{ height: `${h}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-[#9ca3af]">
                    <span>Лют</span>
                    <span>Бер</span>
                    <span>Кві</span>
                  </div>
                </div>

                {/* Accounts */}
                <div className="bg-white rounded-2xl p-6 border border-[#e5e7eb] flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-[#fff7ed] flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-[#f97316]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#111111]">
                      Рахунки
                    </h3>
                  </div>
                  <p className="text-[#6b7280] text-sm leading-relaxed mb-4">
                    Кілька банківських рахунків і каса — в одному місці. Баланс
                    завжди актуальний.
                  </p>
                  <div className="space-y-2">
                    {[
                      { name: "Monobank UAH", bal: "₴248 350" },
                      { name: "PrivatBank USD", bal: "$12 400" },
                      { name: "Каса", bal: "₴8 200" },
                    ].map((acc, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-[#6b7280]">{acc.name}</span>
                        <span className="font-medium text-[#111111] tabular-nums">
                          {acc.bal}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Excel comparison */}
        <section className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="mb-14">
              <h2 className="text-3xl font-semibold text-[#111111] mb-3">
                Чому не Excel
              </h2>
              <p className="text-[#6b7280] text-lg">
                Excel — інструмент для таблиць, не для фінансового обліку
                команди.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Excel column */}
              <div className="rounded-2xl border border-[#fecaca] bg-[#fff5f5] p-8">
                <p className="text-sm font-medium text-[#dc2626] mb-5 uppercase tracking-wide">
                  Excel / Google Sheets
                </p>
                <ul className="space-y-4">
                  {[
                    "Ручне зведення кожного місяця",
                    "Помилки при копіюванні формул",
                    "Немає спільного доступу в реальному часі",
                    "Формули ламаються при редагуванні",
                    "Немає автоматичних звітів",
                    "Категорії — вручну, щоразу",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <X className="w-4 h-4 text-[#ef4444] mt-0.5 shrink-0" />
                      <span className="text-[#374151] text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* FinFlow column */}
              <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-8">
                <p className="text-sm font-medium text-[#16a34a] mb-5 uppercase tracking-wide">
                  FinFlow
                </p>
                <ul className="space-y-4">
                  {[
                    "Автоматичний підрахунок в реальному часі",
                    "Дані зберігаються без формул",
                    "Доступ для команди з будь-якого пристрою",
                    "Редагуйте що завгодно — нічого не ламається",
                    "Cash Flow і P&L готові автоматично",
                    "Автоматична категоризація за правилами",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-[#22c55e] mt-0.5 shrink-0" />
                      <span className="text-[#374151] text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-6 bg-[#0f0f0f]">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-semibold text-white mb-4">
              Почніть сьогодні.
              <br />
              14 днів без оплати.
            </h2>
            <p className="text-[#9ca3af] text-lg mb-8">
              Після реєстрації — одразу повний доступ. Без кредитної картки.
            </p>
            <Link href="/pricing">
              <Button
                size="lg"
                className="bg-[#00c896] hover:bg-[#00b384] text-white rounded-lg font-medium px-8 text-base"
              >
                Спробувати безкоштовно
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e5e7eb] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="font-semibold text-lg text-[#111111]">FinFlow</span>
          <nav className="flex items-center gap-6 text-sm text-[#6b7280]">
            <Link href="#features" className="hover:text-[#111111] transition-colors">
              Можливості
            </Link>
            <Link href="/pricing" className="hover:text-[#111111] transition-colors">
              Ціни
            </Link>
            <Link href="#" className="hover:text-[#111111] transition-colors">
              Конфіденційність
            </Link>
            <Link href="#" className="hover:text-[#111111] transition-colors">
              Умови
            </Link>
          </nav>
          <p className="text-sm text-[#9ca3af]">© 2026 FinFlow</p>
        </div>
      </footer>
    </div>
  );
}
