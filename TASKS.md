# TASKS.md — Kanban

## TODO

### WT-1: feat/auth-core
- [ ] `npx create-next-app` з TypeScript + Tailwind + App Router
- [ ] Встановити: firebase, shadcn/ui, lucide-react
- [ ] `/lib/firebase/firebase.ts` — Firebase init з env vars
- [ ] `/lib/firebase/auth.ts` — signIn, signUp, signOut, onAuthStateChanged
- [ ] Firebase Auth: email/password + Google OAuth
- [ ] `/lib/hooks/useAuth.ts` — auth context + hook
- [ ] `/app/(auth)/login/page.tsx` — форма логіну
- [ ] `/app/(auth)/register/page.tsx` — форма реєстрації + create org
- [ ] `/lib/firebase/firestore.ts` — createOrganization, getOrganization
- [ ] `/lib/hooks/useOrg.ts` — org context
- [ ] Middleware — захист маршрутів `/app/(app)/[orgSlug]`
- [ ] `/app/(app)/[orgSlug]/settings/page.tsx` — налаштування орг.

### WT-2: feat/transactions (залежить від WT-1)
- [ ] Firestore schema: accounts, categories, transactions
- [ ] `/lib/firebase/accounts.ts` — CRUD рахунків
- [ ] `/lib/firebase/transactions.ts` — CRUD транзакцій
- [ ] `/lib/hooks/useAccounts.ts`
- [ ] `/lib/hooks/useTransactions.ts` (з onSnapshot)
- [ ] `/components/forms/AccountForm.tsx`
- [ ] `/components/forms/TransactionForm.tsx` (income/expense/transfer modal)
- [ ] `/app/(app)/[orgSlug]/transactions/page.tsx` — список з групуванням по даті
- [ ] Search + Filter (by account, category, date range, amount)
- [ ] Empty state з CTA "Додати перший рахунок"

### WT-3: feat/analytics (залежить від WT-2)
- [ ] `/lib/utils/analytics.ts` — aggregateByMonth(), buildPL()
- [ ] `/components/charts/CashFlowChart.tsx` — Recharts bar + line
- [ ] `/components/charts/PLTable.tsx`
- [ ] `/app/(app)/[orgSlug]/analytics/cashflow/page.tsx`
- [ ] `/app/(app)/[orgSlug]/analytics/pl/page.tsx`
- [ ] `/app/(app)/[orgSlug]/analytics/balance/page.tsx`
- [ ] `/app/(app)/[orgSlug]/analytics/calendar/page.tsx`
- [ ] Export CSV/PDF

### WT-4: feat/landing
- [ ] Design tokens → `tailwind.config.ts` (кольори з CLAUDE.md)
- [ ] `/app/(marketing)/page.tsx` — Landing page
- [ ] `/app/(marketing)/pricing/page.tsx` — Pricing page
- [ ] shadcn/ui setup + custom components
- [ ] Stripe integration — `stripe.ts`, webhooks
- [ ] Trial middleware logic
- [ ] SEO: metadata, OG images, sitemap.xml

## IN PROGRESS
### WT-2: feat/transactions (розпочато)

## DONE
- [x] Git repo init: `c:/Users/Admin/Desktop/finmap-clone`
- [x] 4 worktrees створено: feat/auth-core, feat/transactions, feat/analytics, feat/landing
- [x] CLAUDE.md, TASKS.md, RESEARCH.md, PROGRESS.md створено
- [x] **WT-1 feat/auth-core** — Next.js + Firebase init, Auth (email+Google), login/register forms, org creation, middleware, useAuth/useOrg hooks, types
- [x] **WT-4 feat/landing** — Landing page, Pricing, design tokens, Stripe setup, SEO (sitemap, robots)
