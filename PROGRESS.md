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
- **Сесія:** `POST /api/auth/session` міняє свіжий ID-токен (`auth_time` не старший за 5 хв, інакше 401 `reauth_required`; заявлений `Content-Length` до 8 КБ, інакше 413 (chunked-тіло обмежує лише платформа, 4,5 МБ на Vercel); `Content-Type: application/json`, інакше 415; `Origin` має збігатися з хостом, інакше 403) на HttpOnly cookie `__session` (Firebase session cookie, 7 днів, `SameSite=Lax`, `Secure` у production). Сесії **абсолютні**: тихого оновлення немає, через 7 днів користувач входить знову. `POST /api/auth/logout` відкликає **всі** refresh-токени користувача (вихід на всіх пристроях), але лише через **живу** сесію (`verifySessionCookie` із перевіркою відкликання); застаріла відкликана cookie лише стирається, інакше два пристрої могли б виходити один за одного. Cookie стирається завжди. Клієнтських `document.cookie` більше немає.
- **Сервер:** `requireUser(req)` перевіряє cookie з відкликанням (401; збій бекенду Auth, зокрема не отримані ключі підпису Google, дає 503), для POST/PUT/PATCH/DELETE ще й `Origin` (403; спершу сесія, потім `Origin`). `requireVerifiedUser(req)` читає живий запис користувача (`getUser`), а не claim у cookie, і дає 403 `email_not_verified`. Bearer-автентифікацію видалено; роути Enable Banking працюють із cookie, `ebFetch` — same-origin, на 401 очищає сесію й веде на `/login?redirect=…`. Callback банку вимагає, щоб `uid` сесії дорівнював `uid` у підписаному `state` (чужий `state` не проходить; це не закриває підміну значення, що повертається в URL, див. «Повернення з банку»); без сесії — редірект на `/login?redirect=<settings>`.
- **Proxy:** пропускає лише сторінки застосунку (`/<segment>/…`, окрім `/login`, `/register`, `/forgot-password`), перевіряє підпис і термін без відкликання. Невалідна cookie очищається, редірект на `/login?redirect=<безпечний шлях>`; збій перевірки на нашому боці — 503, cookie не чіпається. `/login` і `/register` ніколи не редіректяться (правило «валідна cookie на /login → /» відкинуто: пастка застарілої cookie, коли в Firebase SDK немає користувача). Спільні правила шляхів і `safeRedirectPath` — `lib/auth/paths.ts`; `/login` приймає `?redirect=` лише якщо в користувача є організація.
- **Клієнт:** один `AuthProvider` у кореневому layout (вкладений у `(app)/layout.tsx` прибрано). Якщо в SDK немає користувача, він стирає серверну сесію, а на сторінці застосунку ще й робить `window.location.replace` на `/login` (з `?redirect=`, окрім щойно виконаного виходу). Реєстрація додатково викликає `switchOrg(orgId)` (виправлено гонку в `OrgProvider`: `loadSeq` у `useOrg`, `switchOrg` бере `auth.currentUser`).
- **Email (м'яко):** лист підтвердження після реєстрації надсилається best-effort; банер у `(app)` без твердження, що лист надіслано, кнопка «Надіслати лист ще раз». Заблоковано лише підключення банку.
- **Тести:** `tests/unit/server/route-auth-coverage.test.ts` (кожен обробник у `app/api` викликає `await requireUser`/`requireVerifiedUser` або стоїть в allow-list із причиною), юніт-тести хелперів, роутів і proxy, E2E `tests/e2e/session-auth.spec.ts` (+ `tests/e2e/helpers/emulator-auth.ts`) на емуляторах Auth + Firestore.
- **Повернення з банку:** callback прив'язує підписаний `state` до `uid` сесії (чужий `state` не проходить). Callback віддає id банківської сесії в URL, тому сторінка налаштувань приймає `?eb_auth=` лише для підключення, яке почала ця вкладка (`eb_pending` у `sessionStorage`, одноразово, `lib/enablebanking/pending.ts`); `eb_auth` завжди прибирається з URL. Повноцінне виправлення (запис на сервері, прив'язаний до uid+org, без `sessionId` в URL) — S09.
- **Підсумок перевірок:** unit 386, rules 72 (запущено локально на емуляторі, без змін), e2e 22 (на емуляторах Auth + Firestore), lint 0 errors / 25 warnings.

## 2026-10-23 — S01A: UI-оболонка й дизайн-система

Спека: `docs/superpowers/specs/2026-10-23-s01a-ui-shell-design.md` (з розділом «Уточнення під час планування й реалізації»). План: `docs/superpowers/plans/2026-10-23-s01a-ui-shell.md` (з розділом «Відхилення від плану під час виконання»).

**Статус:** змерджено в `master` 2026-10-23 (PR #4, merge 707c6e2), production-деплой READY, скриншоти затверджені власником. Меню профілю виправлено захисно в PR #5 (merge 584c2cf): `isolate` на `.app-shell` і `enableColorScheme={false}`; власник перевірив на production, усе працює.

### Зроблено
- **Оболонка:** шапка (логотип, перемикач компанії, «Дохід / Витрата / Переказ» на кожній сторінці, меню профілю «Налаштування» / «Вийти»), таби «Платежі» і «Аналітика» (липкі, поза `<main>`), згортний сайдбар рахунків (стан у `localStorage`, працює й без нього; на браузер, без живої синхронізації між вкладками) з підсумком «Разом у {валюта компанії}» лише по рахунках у цій валюті, меню рядка (редагувати, видалити) замість `AccountCard`, блок «Підключити банк»; на телефоні сайдбар — шторка (закривається по виборі, `Esc`, зміні маршруту й переході за 1024 px). Старий темний сайдбар, `AccountCard` і `app/(app)/layout.tsx` видалено.
- **Стан:** `ShellProvider` (`lib/hooks/useShell.tsx`) тримає вибраний рахунок (ефективний вибір null, якщо рахунку вже немає), форми операції й рахунку (рендеряться один раз), згортання й шторку, `chooseOrg`; оболонка завжди показує організацію з URL (вона важливіша за запам'ятану в `localStorage`; при розбіжності викликає `switchOrg`); категорії підписуються один раз.
- **Налаштування:** `settings/{company,categories,banks,subscription}` з лівим меню; `settings/` перенаправляє на «Компанію» зі збереженням query (з `eb_auth`/`eb_error` — на «Банки»). Повернення з банку веде на `settings/banks`. Після збереження компанії шапка й сайдбар оновлюються без перезавантаження.
- **Журнал:** справжня таблиця (Дата, Сума, Рахунок, Категорія-чіп, Коментар), групи за днями (`th scope="rowgroup"`) із сумою дня; на телефоні рядок = рахунок і категорія ліворуч, сума праворуч, сума дня в заголовку групи; дати рядків у UTC (як групування), день із нульовим підсумком нейтральний, день зі змішаними валютами без суми; селект рахунку в тулбарі й сайдбар — один стан.
- **Дизайн-система:** токени «свіжий зелений» в `app/globals.css`; світла тема всередині застосунку навіть із `dark` на `<html>`, зокрема діалоги й меню (`.app-shell` і `:root:has(.app-shell)` задають світлі змінні, `dark:` вимкнено через `@custom-variant`); варіанти `soft` (кнопка) і `chip` (бейдж), `components/ui/table.tsx` (ручні правки shadcn позначено `FinFlow (S01A)`); `cn()` знає токени радіусів і тіней. Аналітика переведена на токени.
- **Типові категорії:** доходи тепер сідаються ідемпотентно з детермінованими id (`default-income-*`), тож два одночасні сіди (StrictMode, дві вкладки) не дублюють документи.
- **Назви для доступності змінено:** «Sign out» → меню «Профіль» → «Вийти»; заголовок «Транзакції» → «Платежі»; «+ Додати рахунок» → «Додати рахунок»; посилання «Analytics» → таб «Аналітика»; назва компанії з `aside` у `data-testid="org-switcher-name"` у шапці.
- **Тести та інструменти:** юніт `summarizeAccounts`/`effectiveSelection`, сховище згортання (зламаний `localStorage`), `activeModule`/`isJournalPath`, розділи налаштувань, `cn`, журнал (дні, UTC); E2E `tests/e2e/app-shell.spec.ts` (11 сценаріїв: таби з клавіатурою, згортання після перезавантаження, фільтр за рахунком, синхронний селект, Enter на рядку, кнопки шапки на трьох сторінках, меню налаштувань, перемикач двох компаній із перевіркою мерехтіння, меню рядка, шторка на 390 px, світла оболонка під темним `<html>`), оновлені smoke і session-auth; `npm run ui:shots` (16 скриншотів 1440×900 і 390×844 у `ui-shots/`, у `.gitignore`; примусово ставить `dark` на `<html>` і перевіряє, що оболонка лишається світлою).
- **Фільтр періоду звітів як у Finmap (на прохання власника продукту):** на Cash Flow і P&L пілюлі «3М / 6М / 12М» замінено `PeriodSelect` (пілюля з обраним періодом, меню «ЗА ДАТОЮ ОПЕРАЦІЇ»: поточний / попередній рік, поточний / останній тиждень, поточний / останній місяць, «Обрати дати» з календарем діапазону `DateRangePicker`) у рядку пілюль під заголовком, поруч експорт CSV іконкою (ім'я файлу з періодом). Модель періодів `lib/utils/period.ts` і сітка місяця `lib/utils/calendar-grid.ts` (UTC, тиждень з понеділка), `buildCashFlow`/`buildPL` приймають діапазон (Cash Flow за місяцями понад 31 день, інакше за днями). Юніт-тести періодів, сітки й білдерів; 5 E2E-сценаріїв «report period filter» (типовий період, зміна пресета й чисел, клавіатура, календар, P&L, телефон 390 px); 4 нові скриншоти (меню й календар, десктоп і телефон).
- **Підсумок перевірок (HEAD гілки):** unit 551 (34 файли), rules 72 (запущено локально на емуляторі, без змін), e2e 42 (api-guards 3, app-shell 19, landing 7, session-auth 10, smoke 3; на емуляторах Auth + Firestore, двічі поспіль), lint 0 errors / 19 warnings, `ui:shots` 30 скриншотів. Останній прохід перед PR («дотягнути вигляд») додав: контраст WCAG AA для токенів, налаштування як окремий екран із власним лівим меню (без сайдбару рахунків і табів), більші таби-пігулки, двохрядкові рядки журналу, сайдбар з заголовком «Мої рахунки», підменю аналітики, символ валюти компанії в графіках, кнопку закриття шторки, ліниве завантаження форм.

### Known follow-ups
- **Rate limit / кеш:** `/api/enablebanking/institutions` і `session` без обмежень і кешу.
- **`accounts`-роут:** не прив'язує `sessionId` до org (S09). Крім того, він звертається до `GET /sessions/{id}/accounts`, якого немає в API Enable Banking (є `GET /sessions/{id}`, поле `accounts`); UI цей роут не викликає. Виправити в S09.
- **Підтвердження email м'яке:** заблоковано лише підключення банку; список заблокованих дій розширювати в пізніших підпроєктах.
- **Фарм організацій / trial:** обмеження реєстрацій — S02 (серверне створення організації), ліміти тріалу — S17.
- **Lint:** правила `react-hooks/set-state-in-effect` і `react-hooks/immutability` (eslint-plugin-react-hooks 7) понижені до warning (старі хуки даних і форми їх порушують), плюс 19 warning загалом (після S01A; було 25). Переписати разом із хуками даних у S02/S05 і повернути `error`.
- **Тестові організації:** 87 тестових організацій у production Firestore від видаленого бекдору — прибрати (клієнти організації видаляти не можуть; `firebase firestore:delete`).
- **Vercel Hobby — некомерційний:** перейти на Pro до S17 (білінг).
- Stripe не підключено (`lib/stripe.ts` не використовується) — S17.
- **Proxy не перевіряє відкликання:** відкликана cookie відкриває сторінки застосунку до закінчення терміну (API-виклики завжди перевіряють відкликання).
- **Сесії абсолютні, 7 днів:** тихого оновлення немає; браузер без користувача в SDK запускає глобальний вихід (`/api/auth/logout` відкликає refresh-токени на всіх пристроях).
- **`/[orgSlug]`-сторінки показують порожню оболонку** для slug, що не є справжнім id організації (наприклад, `/login/transactions`, `/org.1/settings`), бо `isAppPath` перевіряє лише форму шляху. Додати `notFound()` у `app/(app)/[orgSlug]/layout.tsx` для slug, що не проходить allow-list id організації або зарезервовані імена.
- **Слухачі Firestore (`onSnapshot`)** пишуть permission-denied у лог під час виходу: відписуватися при виході.
- **Callback Enable Banking** після повернення з банку віддає сирий JSON для помилок 403/503: має редіректити на settings з повідомленням про помилку.
- **`/api/enablebanking/accounts`** не прив'язує `sessionId` до org і користувача (S09).
- **`state` OAuth Enable Banking не одноразовий:** його можна повторити протягом 15 хв, але лише тим самим користувачем.
- **`useOrg.loadOrg`** досі без `catch` (існуючий пункт).
- **Холодний старт proxy:** бандл proxy вантажить увесь `firebase-admin`, зокрема Firestore (`lib/server/auth` → `firebase-admin.ts`), для кожного шляху. Після деплою виміряти холодний TTFB; за потреби `getAdminAuth()` лише з Auth або ліниве завантаження в гілці шляху застосунку.
- **Повернення з Enable Banking іде на `NEXT_PUBLIC_APP_URL`:** користувач, який увійшов на іншому хості чи аліасі (www проти apex, інший аліас Vercel), приходить без cookie, і підключення втрачається. Редіректити аліаси на канонічний домен; коли з'являться піддомени, у production використати ім'я cookie `__Host-session`.
- **Офлайн-вихід** лишає валідну cookie до наступного онлайн-візиту на сторінку застосунку (тоді її буде стерто).
- **Збій proxy** пише в лог два рядки (`toAuthHttpError` і сам proxy).
- **`requireVerifiedUser`** робить два виклики `getUser` (дешево, лише при підключенні банку).
- **Емулятор Auth (і `firebase-admin` в режимі емулятора) ЗАВЖДИ перевіряє відкликання**, тож у E2E proxy суворіший, ніж у production, а E2E-тест «відкликана cookie на logout» не відрізняє старий код logout (запобіжник — юніт-тест).
- **CI не запускає production-збірку proxy, а атрибути `Secure` покриті лише юніт-тестами:** перевірити при першому деплої (ручні перевірки на production): логи proxy без `ERR_REQUIRE_ESM`/помилок `server-only`; `POST /api/auth/session` дає 204, а не 503 (права service account на `createSessionCookie`); атрибути cookie HttpOnly/Secure/SameSite=Lax/7 днів; same-origin POST не дає 403 на production-хості й preview-доменах; скопійована cookie дає 401 після виходу; послідовність виходу/входу на двох пристроях; підключення Millennium з точного хоста `NEXT_PUBLIC_APP_URL`; затримка API з fra1.

- **Типові категорії витрат не сідаються:** `DEFAULT_EXPENSE_CATEGORIES` описано в `lib/firebase/default-categories.ts`, але `seedDefaultCategories` створює лише категорії доходів (існуюча прогалина, S01A її не змінював).
- **Графіки:** кольори вже з токенів (`TOKEN_COLORS`), але розміри фіксовані (висота 400 px, пироги 140 px); Recharts на першому рендері пише у консоль попередження width(-1)/height(-1). `BalanceSheet` і `CalendarView` показують суми у валюті компанії, але підсумки досі додають рахунки й операції в різних валютах без конвертації (S04).
- **Скасування в банку:** користувач, що скасував підключення в банку, потрапляє на `settings/banks?eb_error=1` без жодного повідомлення (`EnableBankingConnect` читає лише `eb_auth`).
- **Дрібниці оболонки:** якщо організація з URL не належить користувачу, скелет у шапці ніколи не зникає й повідомлення немає; «Налаштування» в меню профілю — `router.push` (без середнього кліку); `OrgSwitcher` показує «Завантаження…» при кожному відкритті (кешу немає); у згорнутому сайдбарі немає кнопки «Усі рахунки»; банер підтвердження пошти не є landmark-регіоном (для підтверджених користувачів його немає).
- **Телефонна шапка:** на 390 px для назви компанії лишається мало місця.
- **Еталонні скриншоти Finmap** (`.playwright-mcp/finmap/screens`) лише локальні (дані реального акаунта): не комітити; рядок S01A дорожньої карти посилається на спеку й `npm run ui:shots`.
- **Кольори поза оболонкою:** форми (`TransactionForm`, `AccountForm`) і `EnableBankingConnect` ще мають hex-кольори (у банківському блоці виправлено лише контраст активної пілюлі країни й кнопки); перевести на токени разом із S07/S08 (форми) і S09 (банки).
- **Видалення операції** в журналі немає (не було й до S01A); додати разом із S07/S08.
- **Тексти shadcn англійською** (`Close` у діалогах, `Upgrade to Pro`, `Trial до …`) — переклад у S03.
- **Фільтр періоду для інших екранів:** журнал (пресет `allTime` уже є в моделі, але не в меню звітів) і інші звіти (баланс, календар, план/факт тощо) мають перейти на `PeriodSelect`, коли отримають семантику періоду (S08/S12). Межі періодів зараз у UTC (як групування журналу); часовий пояс компанії Europe/Warsaw — S03. Календар діапазону показує один місяць без швидкого вибору року й без ручного введення дат (у Finmap не перевіряли, як виглядає їхній); період не зберігається в URL і скидається на поточний рік при поверненні на сторінку.

### Наступні кроки
1. **Cloudflare (2026-10-23, за підтвердженням користувача):** Pages-проєкт `finflow1` видалено (інші проєкти акаунта не чіпали), `CLOUDFLARE_*` прибрано з `.env`. Cloudflare API-токен власник відкликав вручну (2026-10-23), бо API відмовив токену видаляти сам себе (403).
2. **S01 змерджено** (PR #2, merge commit a5003c6, 2026-10-23), production-деплой READY. Перевірено curl на production: `/api/health` 200 з fra1; сторінка застосунку з підробленою cookie дає 307 на `/login?redirect=…` і стирає cookie (`Secure`); без cookie дає 307; `/login` відкривається; `/api/enablebanking/*` без валідної сесії дають 401; `POST /api/auth/session` із чужим Origin дає 403, зі своїм і сміттєвим токеном 401; `logout` дає 204 зі стертою cookie; callback із підробленим state дає 400. **Лишилось вручну (потрібен реальний вхід):** вхід на production має дати 204 від `/api/auth/session` (не 503: інакше service account не має прав на `createSessionCookie`), cookie `__session` має бути `HttpOnly; Secure; SameSite=Lax` на 7 днів, після виходу скопійована cookie дає 401, підключення Millennium від підтвердженого користувача.
3. **S01A змерджено** (PR #4, merge 707c6e2) разом із фільтром періоду як у Finmap; PR #5 (меню профілю) змерджено (584c2cf). Production: unit 551, rules 72, e2e 42 зелені.
4. **S02 (тенантність) — поточний підпроєкт.** Дизайн затверджено власником, спеку написано: `docs/superpowers/specs/2026-10-23-s02-tenancy-design.md` (гілка `s02-tenancy`). Наступний крок — план (`writing-plans`), потім виконання субагентами. Порядок розгортання (індекс → `scripts/migrate-memberships.mjs --apply` → мердж → правила → перевірка → `--drop-members-map`) описано в спеці; мердж і міграцію на production робити лише за явним OK власника.
5. **Вимога власника (2026-10-23): дві дати на операції** (дата платежу й дата транзакції/визнання, щоб P&L рахувався вірно). Зафіксовано в дорожній карті: S05 (модель і rollups), S07 (форма), S12 (звіти). Рано не будуємо.
6. **Лишилось вручну (власник):** підтвердити, що реальний вхід на production дає 204 від `POST /api/auth/session` і cookie має атрибути HttpOnly/Secure.
