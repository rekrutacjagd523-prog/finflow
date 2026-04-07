# RESEARCH.md — Competitive Intel

## Finmap Audit (via Playwright, 2026-04-06)

### Screens explored
1. `/log` — Transaction log (Payments)
2. `/analytic` — Analytics hub (10 report types)
3. `/analytic/cashflow` — Cash Flow bar + line chart
4. `/analytic/balance` — Balance sheet (Assets vs Liabilities)
5. `/calendar` — Daily cash view with running balance
6. `/invoicing` — Invoice creation (empty state)
7. `/autorules` — Auto-categorization rules list
8. `/employee` — Team management (roles + permissions)

### Finmap Feature Map

| Module | Features | Notes |
|--------|---------|-------|
| **Transactions** | + income, - expense, ↔ transfer | Fields: account, amount, currency, category, counterparty, date, recurring, project, tag, comment, file |
| **Search/Filter** | Text search + sum range filter + AI import | AI import = upload bank CSV |
| **Future Payments** | Scheduled transactions shown separately | Collapsible section |
| **Cash Flow** | Bar chart (income vs expense) + trend line | Monthly, with filter + download |
| **P&L** | Table by categories × months | Hidden behind disabled button (weak UX!) |
| **Balance** | Assets vs Liabilities with editable fields | Fixed + current assets, equity |
| **Calendar** | List of days with daily +/- and running balance | Two views: list + chart |
| **Invoices** | Create invoice, PDF, counterparties | Empty state on this account |
| **Auto Rules** | Named rules with on/off toggle | Drag to reorder, edit pencil icon |
| **Users** | Add employee, define position, set access rights | 3-tier: full / register+analytics+reports |
| **Multi-org** | Dropdown at top = switch between companies | LITWA shown as current |

### Competitive Comparison

| Aspect | Finmap | OUR APPROACH |
|--------|--------|--------------|
| Onboarding | No demo data, blank state | Template data + guided wizard |
| Mobile | Poor adaptation | Mobile-first PWA |
| P&L access | Disabled button (upgrade) | Available from day 1 in trial |
| Transaction form | Modal, keyboard OK | Modal + keyboard shortcuts |
| Analytics | 10 report types | Start with 4 (cashflow, P&L, balance, calendar) |
| Auto Rules | Text-based conditions | Same + AI suggestion |
| Pricing | Opaque (not found) | Clear $X/month, 14-day trial |
| Design | Dark bg, white card, teal accent | Same pattern, cleaner typography |

## Marketing Discovery Answers

- **Target:** Small/medium business (2–50 people), owners + finance staff
- **Current tools:** Excel, 1C, Finmap
- **Monetization:** Paid only with 14-day free trial
- **MVP scope:** Transactions (income/expense/transfer) + Accounts/cards
- **Phase 2:** Cash Flow, Calendar, Auto Rules, Invoices, Users/roles
