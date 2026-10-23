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

## 2026-10-23 — S01: серверна сесія й auth-флоу

Спека: `docs/superpowers/specs/2026-10-23-s01-session-auth-design.md` (з розділом «Уточнення під час планування й реалізації»). План: `docs/superpowers/plans/2026-10-23-s01-session-auth.md` (з розділом «Відхилення від плану під час виконання»).

**Статус:** код завершено в гілці `s01-session-auth` (ще не змерджено в `master`). Перевірка на production відкладена до мерджа й деплою (вхід і вихід, `Secure`/`HttpOnly` на Vercel, підключення Millennium від підтвердженого користувача).

### Зроблено
- **Сесія:** `POST /api/auth/session` міняє свіжий ID-токен (`auth_time` не старший за 5 хв, інакше 401 `reauth_required`; тіло до 8 КБ, інакше 413; `Content-Type: application/json`, інакше 415; `Origin` має збігатися з хостом, інакше 403) на HttpOnly cookie `__session` (Firebase session cookie, 7 днів, `SameSite=Lax`, `Secure` у production). Сесії **абсолютні**: тихого оновлення немає, через 7 днів користувач входить знову. `POST /api/auth/logout` відкликає **всі** refresh-токени користувача (вихід на всіх пристроях) і стирає cookie. Клієнтських `document.cookie` більше немає.
- **Сервер:** `requireUser(req)` перевіряє cookie з відкликанням (401; збій бекенду Auth, зокрема не отримані ключі підпису Google, дає 503), для POST/PUT/PATCH/DELETE ще й `Origin` (403; спершу сесія, потім `Origin`). `requireVerifiedUser(req)` читає живий запис користувача (`getUser`), а не claim у cookie, і дає 403 `email_not_verified`. Bearer-автентифікацію видалено; роути Enable Banking працюють із cookie, `ebFetch` — same-origin, на 401 очищає сесію й веде на `/login?redirect=…`. Callback банку вимагає, щоб `uid` сесії дорівнював `uid` у підписаному `state` (закриває login-CSRF); без сесії — редірект на `/login?redirect=<settings>`.
- **Proxy:** пропускає лише сторінки застосунку (`/<segment>/…`, окрім `/login`, `/register`, `/forgot-password`), перевіряє підпис і термін без відкликання. Невалідна cookie очищається, редірект на `/login?redirect=<безпечний шлях>`; збій перевірки на нашому боці — 503, cookie не чіпається. `/login` і `/register` ніколи не редіректяться (правило «валідна cookie на /login → /» відкинуто: пастка застарілої cookie, коли в Firebase SDK немає користувача). Спільні правила шляхів і `safeRedirectPath` — `lib/auth/paths.ts`; `/login` приймає `?redirect=` лише якщо в користувача є організація.
- **Клієнт:** один `AuthProvider` у кореневому layout (вкладений у `(app)/layout.tsx` прибрано). Якщо в SDK немає користувача, він стирає серверну сесію, а на сторінці застосунку ще й робить `window.location.replace` на `/login` (з `?redirect=`, окрім щойно виконаного виходу). Реєстрація додатково викликає `switchOrg(orgId)` (виправлено гонку в `OrgProvider`: `loadSeq` у `useOrg`, `switchOrg` бере `auth.currentUser`).
- **Email (м'яко):** лист підтвердження після реєстрації надсилається best-effort; банер у `(app)` без твердження, що лист надіслано, кнопка «Надіслати лист ще раз». Заблоковано лише підключення банку.
- **Тести:** `tests/unit/server/route-auth-coverage.test.ts` (кожен обробник у `app/api` викликає `await requireUser`/`requireVerifiedUser` або стоїть в allow-list із причиною), юніт-тести хелперів, роутів і proxy, E2E `tests/e2e/session-auth.spec.ts` (+ `tests/e2e/helpers/emulator-auth.ts`) на емуляторах Auth + Firestore.
- **Підсумок перевірок:** unit 364, rules 72 (запущено локально на емуляторі, без змін), e2e 20 (на емуляторах Auth + Firestore), lint 0 errors / 25 warnings.

### Known follow-ups
- **Rate limit / кеш:** `/api/enablebanking/institutions` і `session` без обмежень і кешу.
- **`accounts`-роут:** не прив'язує `sessionId` до org (S09). Крім того, він звертається до `GET /sessions/{id}/accounts`, якого немає в API Enable Banking (є `GET /sessions/{id}`, поле `accounts`); UI цей роут не викликає. Виправити в S09.
- **Підтвердження email м'яке:** заблоковано лише підключення банку; список заблокованих дій розширювати в пізніших підпроєктах.
- **Фарм організацій / trial:** обмеження реєстрацій — S01/S02.
- **Lint:** правила `react-hooks/set-state-in-effect` і `react-hooks/immutability` (eslint-plugin-react-hooks 7) понижені до warning (старі хуки даних і форми їх порушують), плюс 25 warning загалом. Переписати в S01/S02 і повернути `error`.
- **Тестові організації:** 87 тестових організацій у production Firestore від видаленого бекдору — прибрати (клієнти організації видаляти не можуть; `firebase firestore:delete`).
- **Vercel Hobby — некомерційний:** перейти на Pro до S17 (білінг).
- Stripe не підключено (`lib/stripe.ts` не використовується) — S17.
- **Proxy не перевіряє відкликання:** відкликана cookie відкриває сторінки застосунку до закінчення терміну (API-виклики завжди перевіряють відкликання).
- **Сесії абсолютні, 7 днів:** тихого оновлення немає; браузер без користувача в SDK запускає глобальний вихід (`/api/auth/logout` відкликає refresh-токени на всіх пристроях).
- **`/[orgSlug]`-сторінки показують порожню оболонку** для slug, що не є справжнім id організації (наприклад, `/login/transactions`, `/org.1/settings`), бо `isAppPath` перевіряє лише форму шляху. Додати `notFound()` у `app/(app)/[orgSlug]/layout.tsx` для slug, що не проходить allow-list id організації або зарезервовані імена.
- **Слухачі Firestore (`onSnapshot`)** пишуть permission-denied у лог під час виходу: відписуватися при виході.
- **`/login?redirect=/<orgB>/…`** не перемикає `OrgProvider` на orgB — кандидат для S02, коли організація визначатиметься з URL.
- **Callback Enable Banking** після повернення з банку віддає сирий JSON для помилок 403/503: має редіректити на settings з повідомленням про помилку.
- **`/api/enablebanking/accounts`** не прив'язує `sessionId` до org і користувача (S09).
- **`state` OAuth Enable Banking не одноразовий:** його можна повторити протягом 15 хв, але лише тим самим користувачем.
- **`useOrg.loadOrg`** досі без `catch` (існуючий пункт).

### Наступні кроки
1. Після проходження критеріїв готовності S00: видалити Pages-проєкт `finflow1` (лише з окремого підтвердження користувача), відкликати Cloudflare API-токен, прибрати `CLOUDFLARE_*` з `.env` (спека S00, розділ 5).
2. S01: рев'ю гілки `s01-session-auth`, PR, мердж у `master` після зеленого CI, перевірка на production (вхід і вихід, cookie `Secure`/`HttpOnly`, підключення Millennium від підтвердженого користувача).
3. S02 — членство й ізоляція тенантів.
