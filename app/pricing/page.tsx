import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ціни — FinFlow",
  description:
    "Один план для всього. $29/місяць або $24/місяць при річній оплаті. 14 днів безкоштовно — без кредитної картки.",
};

export default function PricingPage() {
  const features = [
    "Необмежена кількість транзакцій",
    "До 10 банківських рахунків",
    "Cash Flow і P&L звіти",
    "До 5 учасників команди",
    "Автоматична категоризація",
    "Імпорт CSV з банку",
    "Доступ з мобільного",
    "Підтримка протягом 24 годин",
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white text-[#111111]">
      {/* Nav */}
      <header className="border-b border-[#e5e7eb] sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg tracking-tight">
            FinFlow
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-[#6b7280]">
            <Link href="/#features" className="hover:text-[#111111] transition-colors">
              Можливості
            </Link>
            <Link href="/pricing" className="text-[#111111] font-medium">
              Ціни
            </Link>
          </nav>
          <Link
            href="#"
            className="text-sm text-[#6b7280] hover:text-[#111111] transition-colors"
          >
            Увійти
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Header */}
        <section className="pt-20 pb-16 px-6 text-center">
          <div className="max-w-xl mx-auto">
            <h1 className="text-4xl font-semibold mb-4 text-[#111111]">
              Один план. Все включено.
            </h1>
            <p className="text-lg text-[#6b7280]">
              Жодних рівнів, жодних прихованих обмежень. Один прозорий тариф
              для команд до 50 осіб.
            </p>
          </div>
        </section>

        {/* Pricing card */}
        <section className="pb-24 px-6">
          <div className="max-w-md mx-auto">
            <div className="rounded-2xl border-2 border-[#00c896] bg-white p-8 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm font-medium text-[#6b7280] uppercase tracking-wide mb-1">
                    Pro
                  </p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-semibold text-[#111111]">
                      $29
                    </span>
                    <span className="text-[#6b7280] mb-1">/місяць</span>
                  </div>
                  <p className="text-sm text-[#00c896] font-medium mt-1">
                    або $24/міс при річній оплаті — економія $60/рік
                  </p>
                </div>
                <Badge className="bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0] hover:bg-[#f0fdf4] self-start">
                  Популярний
                </Badge>
              </div>

              <ul className="space-y-3 mb-8">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-[#00c896] shrink-0" />
                    <span className="text-sm text-[#374151]">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                className="w-full bg-[#00c896] hover:bg-[#00b384] text-white rounded-lg font-medium text-base"
              >
                Почати 14-денний trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <p className="text-center text-sm text-[#9ca3af] mt-3">
                Кредитна картка не потрібна для trial
              </p>
            </div>

            {/* Annual toggle note */}
            <div className="mt-6 p-4 bg-[#f9fafb] rounded-xl border border-[#e5e7eb]">
              <p className="text-sm text-[#6b7280] text-center">
                Річна оплата:&nbsp;
                <span className="font-semibold text-[#111111]">$288/рік</span>
                &nbsp;замість $348 — платіть менше за лояльність.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ mini */}
        <section className="py-16 px-6 bg-[#f9fafb] border-t border-[#e5e7eb]">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold text-[#111111] mb-8 text-center">
              Часті питання
            </h2>
            <div className="space-y-6">
              {[
                {
                  q: "Що відбувається після 14 днів?",
                  a: "Ви отримаєте нагадування за 3 дні. Якщо не підписались — доступ переходить в режим читання. Дані не видаляються.",
                },
                {
                  q: "Чи можна скасувати підписку?",
                  a: "Так, в будь-який момент з налаштувань. Доступ зберігається до кінця оплаченого місяця.",
                },
                {
                  q: "Скільки компаній можна вести?",
                  a: "Один акаунт — одна організація. Для кількох компаній — окремі акаунти.",
                },
              ].map((item, i) => (
                <div key={i} className="border-b border-[#e5e7eb] pb-6 last:border-0">
                  <p className="font-medium text-[#111111] mb-2">{item.q}</p>
                  <p className="text-[#6b7280] text-sm leading-relaxed">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e5e7eb] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="font-semibold text-[#111111]">
            FinFlow
          </Link>
          <p className="text-sm text-[#9ca3af]">© 2026 FinFlow</p>
        </div>
      </footer>
    </div>
  );
}
