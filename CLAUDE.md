# CLAUDE.md — FinFlow Project Rules

## Project Overview
**FinFlow** — SaaS фінансовий менеджер для малого/середнього бізнесу (2–50 осіб).
Облік доходів/витрат, Cash Flow, P&L, Balance, Invoices.

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Backend:** Firebase (Firestore + Auth + Storage)
- **UI:** shadcn/ui (base) + Recharts (charts)
- **Styling:** Tailwind CSS
- **Lang:** TypeScript (strict)
- **Hosting:** Vercel
- **Payments:** Stripe (subscriptions + 14-day trial)

## Firebase Project
- Project ID: TBD (створити в Firebase Console)
- Firestore structure: `organizations/{orgId}/...` (multi-tenant)

## Folder Structure
```
/app
  /(auth)/           ← login, register, forgot-password
  /(app)/[orgSlug]/  ← protected app routes
    /transactions
    /analytics/cashflow, /pl, /balance, /calendar
    /invoices
    /auto-rules
    /settings
  /(marketing)/      ← landing, pricing
/components
  /ui/               ← shadcn components (DO NOT EDIT)
  /charts/           ← Recharts wrappers
  /forms/            ← TransactionForm, InvoiceForm, AccountForm
  /layout/           ← AppSidebar, Header, OrgSwitcher
/lib
  /firebase/         ← firebase.ts (init), firestore.ts, auth.ts
  /hooks/            ← useTransactions, useAccounts, useOrg, useAuth
  /utils/            ← formatCurrency, cn, dateHelpers
/types/              ← Transaction, Account, Organization, etc.
```

## Coding Conventions
- TypeScript strict mode always
- Server Components by default, `'use client'` only when needed (forms, hooks, charts)
- Firebase calls only in `/lib/firebase/` и `/lib/hooks/`
- Never call Firebase directly from components — always через hooks
- `cn()` from `lib/utils` for className merging
- All dates: `Date` objects in code, Firestore `Timestamp` in DB
- Currency formatting: `Intl.NumberFormat` via `formatCurrency(amount, currency)`

## Design System

### Mood: Minimal + Trust (фінанси = точність)
### Style: Linear-inspired — dark sidebar, white content, one accent

### Color Tokens
```css
--bg-app: #0f0f0f          /* app background */
--bg-sidebar: #111111       /* sidebar */
--bg-card: #ffffff          /* content cards */
--bg-hover: #f9fafb         /* row hover */
--accent: #00c896           /* primary action (teal-green) */
--income: #22c55e           /* green-500 */
--expense: #ef4444          /* red-500 */
--transfer: #6366f1         /* indigo-500 */
--text-primary: #111111
--text-muted: #6b7280
--border: #e5e7eb
```

### Typography
- Font: `Inter` (Google Fonts)
- Headings: 600 weight
- Body: 400, line-height 1.6
- Numbers/data: `font-variant-numeric: tabular-nums`

### Spacing (4px base)
- Card padding: 16–24px
- Section gap: 24px
- Form gap: 16px

### Border Radius
- Cards: 12px
- Buttons: 8px
- Inputs: 6px

### Components
- Buttons: ONE primary CTA per section (accent color), rest ghost/outline
- Forms: inline validation, disabled submit until valid
- Tables: zebra striping via `--bg-hover`, sticky header
- Charts: Recharts with custom tooltips matching design system

## Banned Copy Phrases
- "seamless", "powerful", "robust", "leverage", "streamline"
- "game-changer", "revolutionary", "cutting-edge"
- "in today's fast-paced world"
- Generic CTAs like "Get Started" → use "Start free trial" or "Try 14 days free"

## What NOT to Touch
- `/components/ui/` — shadcn generated files, edit via CLI only
- `firebase.ts` config — environment variables only, no hardcoded keys
- `.env.local` — never commit

## Freemium / Trial Logic
- 14-day free trial on registration
- After trial: read-only mode + /pricing redirect
- Plan stored in `organizations/{orgId}.plan` + `trialEndsAt`
- Check via middleware + `useOrg` hook
