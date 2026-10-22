# S00 — Платформа: Vercel + Next 16, firebase-admin, тестовий контур, закриття живих дірок

> Статус: **дизайн затверджено** (2026-10-22). Частина [дорожньої карти](2026-10-22-finflow-roadmap.md). Розмір: M (≈1–2 тижні).

## Мета

finflow деплоїться на Vercel із довіреною серверною частиною (`firebase-admin`) і тестовим контуром у CI. Дірки, відкриті на живому сайті сьогодні, закриті. Нових функцій продукту S00 **не** додає.

## Вихідний стан (перевірено в коді)

- Деплой на Cloudflare Pages через OpenNext із ручними патчами (`scripts/patch-cf.js`, `open-next.config.ts`, `wrangler.toml`, `initOpenNextCloudflareForDev` і webpack-аліаси Firestore в `next.config.ts`, `getCloudflareContext` у `lib/enablebanking/jwt.ts`).
- **Білд падає з 2026-10-22:** OpenNext відмовляється збирати Next.js 15.5 (закінчилася 2-річна підтримка).
- Немає `firestore.rules`, `firebase.json` і індексів. Публічний Firebase-конфіг дає доступ до бази.
- `middleware.ts` перевіряє лише наявність cookie `__session` (клієнт ставить `"1"`).
- Відкриті роути: `/api/test/auth` (створює й читає організації через REST без токена) і `/test-login`.
- Роути `/api/enablebanking/*` не перевіряють користувача. `state` — непідписаний base64 orgId.
- У `public/` лежать 10 скріншотів Finmap (`finmap-*.png`). На лендінгу є блок відгуків і обіцянки функцій, яких немає (автоправила, командний доступ).
- Сторонні файли в корені: `content-factory-*.json/.md`, `master-prompt.md`, `dev.log`, `test-results/`, `.claire/`.
- Тести: `app.spec.ts` застарів (очікує Monobank/Yapily), EB-тести ходять у sandbox, `global-setup.ts` не підключений, юніт-тестів немає.
- Документація розійшлась із кодом: CLAUDE.md каже Next 14 + Vercel + Inter.

## Обсяг

### 1. Платформа: Vercel + Next.js 16

- Видалити Cloudflare-специфіку:
  - `@opennextjs/cloudflare`, `wrangler`;
  - `open-next.config.ts`, `wrangler.toml`, `scripts/patch-cf.js`, скрипт `build:cf`;
  - `initOpenNextCloudflareForDev()` і webpack-аліаси `@firebase/firestore` в `next.config.ts`;
  - `getCloudflareContext` → `process.env`.
- `eslint.ignoreDuringBuilds` прибрати, щоб lint знову блокував.
- Оновити `next` до 16.x (з `react`/`react-dom` 19.2, `eslint-config-next` 16). Застосувати офіційний codemod. `middleware.ts` → `proxy.ts` (нова назва в Next 16), логіку поки не змінювати (S01 її замінить).
- Vercel-проєкт `finflow` у team `biuro-3838s-projects`:
  - прив'язка до `remit-agency/finflow` (Git-інтеграція), production-гілка `master`, preview на кожен PR;
  - регіон функцій `fra1`, Node 24.
- Змінні оточення у Vercel:
  - `NEXT_PUBLIC_FIREBASE_*` і `NEXT_PUBLIC_APP_URL` — plain;
  - `ENABLEBANKING_APP_ID`, `ENABLEBANKING_PRIVATE_KEY`, `FIREBASE_SERVICE_ACCOUNT` (base64 JSON), `EB_STATE_SECRET` — **sensitive**.
- Значення секретів беруться з локальних `F:\AI\finflow\.secrets\` і `.env` (обидва в `.gitignore`), у репо вони не потрапляють ніколи.

### 2. Серверний доступ до Firestore

- `lib/server/firebase-admin.ts`:
  - `import 'server-only'`;
  - singleton `getAdmin()` → `{ db, auth }` з `FIREBASE_SERVICE_ACCOUNT`;
  - `preferRest: true`, щоб швидше стартувати на serverless.
- `lib/server/auth.ts`: `requireUserFromBearer(req)` перевіряє Firebase ID-токен через `auth.verifyIdToken(token, true)`, `requireOrgMember(uid, orgId)` читає `organizations/{orgId}.members[uid]`. Тимчасовий механізм до S01/S02.
- `GET /api/health`: робить admin-читання службового документа `_meta/health` і повертає лише `{ ok, region, firestore: 'ok' }`. Жодних даних користувачів.

### 3. Закриття живих дірок

- **`firestore.rules`** (deny-by-default, відповідає поточній структурі даних):
  - `organizations/{orgId}`:
    - `get` дозволено, якщо `request.auth.uid in resource.data.members`;
    - `update` дозволено члену, лише якщо зміна не зачіпає `members`, `ownerId`, `plan`, `trialEndsAt` (`diff().affectedKeys()`), щоб унеможливити підвищення прав і самопродовження тріалу;
    - `create` дозволено, лише якщо `request.resource.data.ownerId == request.auth.uid` і `members` містить тільки автора з роллю `owner`;
    - `list` дозволено тільки з фільтром за членством (як у поточному `useOrg`);
    - `delete` заборонено.
  - `organizations/{orgId}/{collection}/{docId}`: читання й запис лише для членів (`get(/databases/$(database)/documents/organizations/$(orgId)).data.members`).
  - `_meta/**`: лише сервер (клієнту все заборонено).
  - Решта шляхів: заборонено.
- **`storage.rules`**: усе заборонено (Storage не використовується).
- **`firestore.indexes.json`**: композитні індекси для фільтрів журналу (`accountId` / `categoryId` + `date`), щоб комбіновані фільтри перестали падати.
- **`firebase.json`**: правила й індекси. Деплой через `firebase deploy --only firestore,storage --project finflow-e94b5`.
- **Бекдор:** видалити `app/api/test/auth`, `app/(auth)/test-login` і тести/фікстури, що на них спираються.
- **Enable Banking:**
  - `session`, `accounts`, `institutions`: вимагають `Authorization: Bearer <ID token>` + членство в org (401/403);
  - `state` = `base64url(orgId.uid.nonce.exp)` + HMAC-SHA256 з `EB_STATE_SECRET`, термін дії 15 хв;
  - `callback` відхиляє недійсний чи прострочений `state` (400), перш ніж обмінювати `code`.
  - Клієнтський `EnableBankingConnect` передає ID-токен.
- **Прибирання репо:**
  - видалити `public/finmap-*.png`, блок відгуків і обіцянки неіснуючих функцій на лендінгу;
  - видалити `content-factory-*`, `master-prompt.md`, `dev.log`, `test-results/`, `.claire/`, `tests/screenshots/`;
  - додати в `.gitignore` `test-results/`, `playwright-report/`, `.secrets/` (вже є), `.env*` (вже є).
- **Документація:** CLAUDE.md (стек: Next 16, Vercel, Firestore `eur3`, `firebase-admin` лише в `lib/server`) і PROGRESS.md приводяться у відповідність до коду.

### 4. Тестовий контур і CI

- **Vitest** (юніт): HMAC `state` (валідний / підроблений / прострочений), `requireOrgMember`.
- **Тести правил** на емуляторі через `@firebase/rules-unit-testing`:
  - анонім не читає й не пише нічого;
  - користувач A не читає й не пише нічого в org B;
  - створити org з чужим `ownerId` не можна;
  - `_meta` недоступний клієнту;
  - власник читає й пише свої підколекції.
- **Playwright smoke** (проти `next dev` + емуляторів Auth і Firestore): реєстрація → створення компанії → рахунок → операція → сторінка Cash Flow показує дані. `app.spec.ts`, `eb-*.spec.ts` і `enablebanking-debug.spec.ts` видаляються. `landing.spec.ts` оновлюється.
- **GitHub Actions** `ci.yml` на PR і push у `master`: `npm ci` → `lint` → `typecheck` (`tsc --noEmit`) → `vitest` → `firebase emulators:exec` (тести правил + Playwright smoke) → `next build`. Java ставиться в CI через `actions/setup-java`. Локально емулятор потребує JDK 21 (зараз не встановлено), тому тести правил локально опційні.
- **Branch protection на `master`:** мерж лише через PR зі зеленим CI. Налаштовується після передачі репо в `remit-agency`.

### 5. Вимкнення Cloudflare

Коли прод на Vercel пройде критерії готовності:
- видалити Pages-проєкт `finflow1` (лише з окремого підтвердження користувача);
- відкликати Cloudflare API-токен;
- прибрати `CLOUDFLARE_*` з `.env`.

## Поза обсягом

- Серверна session cookie, переписування auth-флоу (S01).
- Нова схема, членство як окремий документ, `/[orgId]` з URL (S02).
- i18n, гроші, дати (S03).
- Імпорт транзакцій Enable Banking (S09).
- Будь-які нові продуктові функції.

## Критерії готовності

1. Пуш у `master` деплоїть Next 16 на Vercel production. У коді й залежностях немає OpenNext, wrangler чи `getCloudflareContext`.
2. `GET /api/health` з `fra1` повертає `{ ok: true, firestore: 'ok' }`.
3. CI зелений: lint, typecheck, vitest, тести правил (усі сценарії з розділу 4), Playwright smoke, build. `master` захищений.
4. `/api/test/auth` і `/test-login` → 404. `/api/enablebanking/session` без токена → 401, від не-члена → 403. Callback з підробленим `state` → 400.
5. Правила задеплоєні в `finflow-e94b5`. Запит до Firestore без auth з публічним конфігом отримує PERMISSION_DENIED.
6. Ручна перевірка: на домені Vercel підключення Bank Millennium доходить до сторінки авторизації банку з новим ключем Enable Banking.

## Дії користувача

1. Прийняти передачу репозиторію в `remit-agency` (лист від GitHub).
2. Firebase Console → Project settings → Service accounts → **Generate new private key** → покласти JSON у `F:\AI\finflow\.secrets\`.
3. Додати Redirect URL `https://<домен-vercel>/api/enablebanking/callback` у застосунок Enable Banking (Control Panel). Домен буде відомий після першого деплою.

## Ризики

- **Breaking changes Next 16** (асинхронні request API, `proxy.ts`, Turbopack за замовчуванням). Codemod + повний smoke.
- **Правила можуть зламати поточні клієнтські запити** (наприклад, `list` організацій у `useOrg`). Smoke-тест покриває саме цей шлях; запит підганяємо під правило, а не навпаки.
- **Холодний старт `firebase-admin`** на serverless. `preferRest`, лінива ініціалізація.
