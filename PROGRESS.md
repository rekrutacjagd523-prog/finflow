# PROGRESS.md — Changelog

## 2026-04-06

### Setup Complete
- Created git repo at `c:/Users/Admin/Desktop/finmap-clone`
- Created 4 git worktrees:
  - `feat/auth-core` → `.claude/worktrees/auth-core`
  - `feat/transactions` → `.claude/worktrees/transactions`
  - `feat/analytics` → `.claude/worktrees/analytics`
  - `feat/landing` → `.claude/worktrees/landing`
- Created artifact files: CLAUDE.md, TASKS.md, RESEARCH.md, PROGRESS.md
- Stack confirmed: **Next.js 14 + Firebase + shadcn/ui + Recharts**
- Competitive audit of Finmap completed (Playwright)

### WT-1 feat/auth-core — DONE
Firebase Auth (email+Google), login/register, org creation, middleware, useAuth/useOrg, types

### WT-4 feat/landing — DONE
Landing page, Pricing, design tokens, Stripe setup, SEO (sitemap, robots)

### WT-2 feat/transactions — DONE
Accounts CRUD, TransactionForm (3 таби), TransactionList, TransactionFilters, AccountCard, realtime onSnapshot

### WT-3 feat/analytics — DONE
CashFlowChart (Recharts), PLTable, CalendarView, BalanceSheet, all 4 analytics pages, CSV export

### Merge — DONE (commit 2262a82)
67 файлів, 17 490 рядків. Всі 4 worktrees зібрані в один Next.js проект.

## Наступні кроки
1. Створити Firebase проект → додати credentials в .env.local
2. Створити Stripe account → додати STRIPE_SECRET_KEY
3. npm run dev → перевірити app
4. Деплой на Vercel
