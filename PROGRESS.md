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

## Наступні кроки (квітень 2026, застаріло — див. запис 2026-10-22)
1. Створити Firebase проект → додати credentials в .env.local
2. Створити Stripe account → додати STRIPE_SECRET_KEY
3. npm run dev → перевірити app
4. Деплой на Vercel

## 2026-10-22 — S00: платформа (Vercel + Next 16)

Спека: `docs/superpowers/specs/2026-10-22-s00-platform-design.md`. План: `docs/superpowers/plans/2026-10-22-s00-platform.md`.

### Зроблено
- **Репо:** видалено сторонні файли (`content-factory-*`, `master-prompt.md`, `dev.log`, `test-results/`, `.claire/`, `tests/screenshots/`) і скріншоти Finmap у `public/`. З лендінгу й `/pricing` прибрано вигадані відгуки та статистику, а також обіцянки неіснуючих функцій (автоправила, командний доступ, автокатегоризація, PDF, імпорт CSV, мобільний доступ). Додано `.env.example` (лише назви змінних).
- **Платформа:** Cloudflare Pages / OpenNext видалено повністю (`@opennextjs/cloudflare`, `wrangler`, `open-next.config.ts`, `wrangler.toml`, `scripts/patch-cf.js`, `build:cf`, webpack-аліаси, `getCloudflareContext`). Next.js 15 → 16.4.2 (Turbopack для dev і build), React 19.2.9, `eslint-config-next` 16.4.2, `middleware.ts` → `proxy.ts`, `engines.node` 24.x. Скрипти `lint` (`eslint .`) і `typecheck` (`tsc --noEmit`); `next build` більше не лінтить, lint блокує через CI.
- **Сервер:** `firebase-admin` лише в `lib/server/` (`server-only`), `GET /api/health`. Enable Banking-роути вимагають Firebase ID-токен (Bearer) і членство в org; `state` підписаний HMAC-SHA256 (15 хв), callback перевіряє підпис і членство.
- **Безпека:** `firestore.rules` (deny-by-default, доступ за членством в org), `storage.rules`, індекси; Firestore `finflow-e94b5` у `eur3`; бекдор `/api/test/auth` і `/test-login` видалено.
- **Тести й CI:** Vitest (unit, `tests/unit`), тести правил на емуляторі (`tests/rules`), Playwright smoke (`tests/e2e`), GitHub Actions job `ci` (`.github/workflows/ci.yml`), захист `master`.
- **Хостинг:** Vercel `finflow` (team `biuro-3838s-projects`, регіон `fra1`, Node 24, Git-інтеграція, preview на кожен PR), production — гілка `master`. План Hobby.
- **`jwks-rsa` → `jose` 5 (чому не чіпати):** `firebase-admin` → `jwks-rsa` робить `require()` для `jose`, а `jose` 6 — лише ESM. Локальний Node 24 і CI вантажать його через `require(esm)`, а рантайм Vercel має це вимкнене: усі роути з `firebase-admin/auth` падали з `ERR_REQUIRE_ESM` тільки в production. Лікування — `overrides: { "jwks-rsa": { "jose": "^5.10.0" } }` у `package.json` і гард `scripts/check-server-imports.mjs` (`npm run check:server-imports`, крок у CI): вантажить серверні CJS-залежності з `--no-experimental-require-module`. Нову CJS-залежність сервера додавати в `SERVER_CJS_MODULES`.

### Known follow-ups
- **Вхід через чужий callback (login-CSRF):** `state` Enable Banking не прив'язаний до сесії браузера. Додати cookie-nonce в S09 (або S01).
- **Rate limit / кеш:** `/api/enablebanking/institutions` і `session` без обмежень і кешу.
- **`accounts`-роут:** не прив'язує `sessionId` до org (S09). Крім того, він звертається до `GET /sessions/{id}/accounts`, якого немає в API Enable Banking (є `GET /sessions/{id}`, поле `accounts`); UI цей роут не викликає. Виправити в S09.
- **Підтвердження email** при реєстрації — S01.
- **Фарм організацій / trial:** обмеження реєстрацій — S01/S02.
- **Lint:** правила `react-hooks/set-state-in-effect` і `react-hooks/immutability` (eslint-plugin-react-hooks 7) понижені до warning (старі хуки даних і форми їх порушують), плюс 25 warning загалом. Переписати в S01/S02 і повернути `error`.
- **Тестові організації:** 87 тестових організацій у production Firestore від видаленого бекдору — прибрати (клієнти організації видаляти не можуть; `firebase firestore:delete`).
- **Vercel Hobby — некомерційний:** перейти на Pro до S17 (білінг).
- `proxy.ts` досі перевіряє лише наявність cookie `__session` — замінить S01.
- Stripe не підключено (`lib/stripe.ts` не використовується) — S17.

### Наступні кроки
1. Після проходження критеріїв готовності S00: видалити Pages-проєкт `finflow1` (лише з окремого підтвердження користувача), відкликати Cloudflare API-токен, прибрати `CLOUDFLARE_*` з `.env` (спека S00, розділ 5).
2. S01 — серверна сесія й auth-флоу.
