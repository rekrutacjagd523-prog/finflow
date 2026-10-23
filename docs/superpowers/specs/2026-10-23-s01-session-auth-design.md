# S01 — Серверна сесія й auth-флоу

> Статус: **дизайн затверджено користувачем** (2026-10-23) і **реалізовано** (код завершено в гілці `s01-session-auth`, перевірка на production після мерджа). Фактична поведінка, що відрізняється від первісного тексту, — у розділі «Уточнення під час планування й реалізації» в кінці. Частина [дорожньої карти](2026-10-22-finflow-roadmap.md). Залежить від [S00](2026-10-22-s00-platform-design.md). Розмір: M.

## Мета

Cookie `__session=1`, яку клієнт ставить сам, замінена справжньою серверною сесією Firebase. Підроблена cookie відхиляється, кожен мутуючий серверний роут викликає `requireUser()`, непідтверджений email має чітко визначені обмеження.

## Вихідний стан (перевірено в коді)

- `document.cookie = '__session=1; …'` ставиться з клієнта в п'яти місцях: `lib/hooks/useAuth.tsx`, `app/(auth)/login/page.tsx` (×2), `app/(auth)/register/page.tsx` (×2).
- `proxy.ts` лише перевіряє, що cookie `__session` існує. Правила шляхів: публічні `/login`, `/register`, `/forgot-password`; захищені шляхи виду `/<segment>/…`.
- `lib/server/auth.ts`: `requireUserFromBearer` (заголовок `Authorization: Bearer <ID token>`, `verifyIdToken(token, true)`) і `requireOrgMember`. Позначено «тимчасово до S01».
- Роути `/api/enablebanking/{session,accounts,institutions}` використовують Bearer. `callback` не має користувача: його ідентифікує лише HMAC-підписаний `state` (`lib/server/eb-state.ts`, поля `o`, `u`, `n`, `e`).
- `components/settings/EnableBankingConnect.tsx` бере ID-токен у Firebase SDK і шле його як Bearer.
- Реєстрація створює організацію з клієнта (`lib/firebase/auth.ts` → `createOrganization`). Підтвердження email не відправляється.

## Рішення

| Питання | Рішення |
|---|---|
| Механізм сесії | Firebase session cookie (`createSessionCookie` / `verifySessionCookie`) |
| Термін | 7 днів, відкликання через `revokeRefreshTokens` |
| Непідтверджений email | М'яка перевірка: у додаток пускаємо, чутливі дії блокуємо |
| Bearer-токени | Видаляються, лишається один спосіб автентифікації |
| OAuth state банку | Прив'язується до сесії (закриває пункт беклогу) |

## Обсяг

### 1. Життєвий цикл сесії

**Endpoints** (Node runtime, `app/api/auth/*`):

- `POST /api/auth/session`: тіло `{ idToken }`. Сервер виконує `verifyIdToken(idToken, true)`, відхиляє токен, чий `auth_time` старший за 5 хвилин (401 `reauth_required`, клієнт перелогінюється), перевіряє `Origin` так само, як `requireUser` (розділ 2), потім `createSessionCookie(idToken, { expiresIn: 7 днів })` і ставить cookie `__session`: `HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`, `Secure` у production (на `http://localhost` без `Secure`, інакше браузер її не збереже).
- `POST /api/auth/logout`: лише якщо сесія жива (`verifySessionCookie(cookie, true)`, з перевіркою відкликання), викликає `revokeRefreshTokens(uid)`; відкликана чи прострочена cookie лише стирається. Завжди стирає cookie (`Max-Age=0`) і повертає 204, навіть якщо cookie вже непридатна.

**Клієнт** (`useAuth`, `lib/firebase/auth.ts`):

- Після кожного успішного входу (email, Google) і після реєстрації клієнт викликає `POST /api/auth/session` **перед** переходом на сторінку застосунку. Усі п'ять `document.cookie` видаляються.
- `signOut`: спершу `POST /api/auth/logout`, потім `firebaseSignOut`.
- Синхронізація двох станів (ризик №5 роадмапи): якщо `onAuthStateChanged` дає `null`, а cookie ще ніби є, клієнт викликає logout.

### 2. `requireUser()` і захист роутів

`lib/server/auth.ts`:

- `requireUser(req)`: читає cookie `__session`, викликає `verifySessionCookie(cookie, true)`, повертає `{ uid, emailVerified }`. Помилки: відсутня, невалідна, прострочена чи відкликана cookie → 401 `unauthorized`; збій бекенду Auth → 503 `auth unavailable` (поведінка як у поточному `requireUserFromBearer`: у лог іде лише код помилки).
- `requireVerifiedUser(req)`: `requireUser` плюс `emailVerified === true`, інакше 403 `email_not_verified`.
- Для методів POST/PUT/PATCH/DELETE `requireUser` також перевіряє заголовок `Origin`: він має збігатися з хостом запиту, інакше 403 `forbidden`. Відсутній `Origin` на небезпечному методі теж 403. Це додатковий шар до `SameSite=Lax`.
- `requireUserFromBearer` і `BEARER` видаляються. `requireOrgMember` лишається без змін до S02.

Роути `/api/enablebanking/{session,accounts,institutions}` переходять на `requireUser`. `session` (початок підключення банку) використовує `requireVerifiedUser`. Лінт-тест у `tests/unit` перелічує всі `app/api/**/route.ts` з мутуючими методами й вимагає виклику `requireUser`/`requireVerifiedUser`, крім явного allow-list (`auth/session`, `auth/logout`, `health`).

### 3. Callback банку

Callback лишається GET (редірект банку є top-level навігацією, тож cookie із `SameSite=Lax` туди приходить). До наявних перевірок state і членства додається: `requireUser(req)` і `uid` сесії має дорівнювати `verified.uid` зі state, інакше 403. Якщо сесії немає (наприклад, закінчилась під час входу в банк), користувач перенаправляється на `/login?redirect=<settings>` без обміну коду.

### 4. `proxy.ts`

- Читає cookie `__session` і перевіряє підпис і термін через `verifySessionCookie(cookie, false)` у Node runtime. Це без запиту відкликання: публічні сертифікати кешує SDK, тож мережевих викликів на кожну навігацію немає. Перевірку з відкликанням роблять API-роути.
- Proxy пильнує лише сторінки застосунку (`/<segment>/…`, окрім `/login`, `/register`, `/forgot-password`). Невалідна cookie: видаляється у відповіді, редірект на `/login?redirect=<шлях>`. `/login` і `/register` proxy не перевіряє й не редіректить.
- Правила шляхів і `config.matcher` не змінюються.
- Параметр `redirect` проходить санітизацію: приймається лише відносний шлях, що починається з одного `/`, без `//` та без схеми. Інакше `/`.
- Обмеження (документується в CLAUDE.md): сторінки читають Firestore напряму клієнтським SDK, тож доступ до даних, як і раніше, захищають правила Firestore й ID-токен, а не cookie. Cookie закриває навігацію та серверні роути. Ізоляція тенантів — S02.

### 5. Підтвердження email (м'яке)

- Після `signUpWithEmail` клієнт викликає `sendEmailVerification`. Google-користувачі мають `email_verified = true` від початку.
- У `(app)` layout показується банер «Підтвердіть email» з кнопкою «Надіслати знову» (з обмеженням частоти на клієнті). Банер зникає, коли `user.emailVerified` стає true (клієнт робить `user.reload()` при поверненні на вкладку).
- Заблоковано: підключення банку (`requireVerifiedUser`). Решта функцій працює. Розширення списку заблокованих дій — рішення пізніших підпроєктів.
- Тексти банера українською, як решта UI застосунку; переклад — S03.

## Поза обсягом

Членство й ізоляція тенантів (S02), rate limit на auth-роутах, MFA, i18n текстів (S03), серверне створення організації (S02/S05), ліміти фармінгу тріалів, зміна й скидання пароля (UI не змінюється, але зміна пароля відкликає сесії автоматично через Firebase).

## Тестування

**Юніт** (`tests/unit/server`): мапінг помилок `verifySessionCookie` (401 проти 503), `requireVerifiedUser`, Origin-перевірка (збіг, розбіжність, відсутній), санітизація `redirect`, формування cookie (атрибути для production і localhost), лінт-тест покриття роутів.

**E2E на емуляторах** (`tests/e2e`, Auth-емулятор підтримує session cookies і oobCodes):

1. Підроблена `__session=1` на захищеному шляху → редірект на `/login`.
2. Реєстрація → cookie виставлена, `HttpOnly` (недоступна з `document.cookie`), перехід у застосунок.
3. Logout → повторне використання старої cookie на API дає 401 (відкликання).
4. Новий користувач бачить банер; `POST /api/enablebanking/session` дає 403 `email_not_verified`; після переходу за посиланням з емуляторного oobCode банер зникає, запит проходить автентифікацію.
5. POST на API з чужим `Origin` → 403.
6. Жива cookie без користувача в Firebase SDK (SDK-less): відвідувач відкриває `/login`, не потрапляє в пастку, сторінка застосунку очищає сесію й веде на `/login`.
7. Шлях повернення й open redirect: `/login?redirect=` із чужим сайтом ігнорується, шлях застосунку після повторного входу повертає на нього.

**Правила Firestore:** не змінюються, 72 наявні тести мають лишитися зеленими.

**CI:** наявний набір (`ci`) покриває нові тести без змін воркфлоу.

## Критерії готовності

- Підроблена cookie (`__session=1`, випадковий рядок, прострочена, відкликана) не проходить ні `proxy`, ні `requireUser`.
- У коді немає жодного `document.cookie` для `__session` і жодного Bearer-шляху.
- Кожен мутуючий роут викликає `requireUser`/`requireVerifiedUser` (перевіряє тест).
- Callback відхиляє state, чий `uid` не збігається з сесією.
- Усі наявні тести (unit 174, rules 72, e2e 13) і нові зелені; lint без нових помилок.
- На проді: вхід і вихід працюють, підключення Millennium проходить від підтвердженого користувача.
- CLAUDE.md і PROGRESS.md оновлені (рядок про `__session` прибрано, пункт беклогу про state закрито).

## Ризики

1. **Розсинхрон SDK і cookie** — синхронізація в `useAuth` + E2E №3.
2. **Свіжість токена для `createSessionCookie`** — 5-хвилинне вікно; клієнт завжди викликає endpoint одразу після входу.
3. **Колізія ім'я/шлях:** `/api/enablebanking/session` (початок підключення банку) і `/api/auth/session` (cookie) — різні речі, назви лишаємо, у коді коментар.
4. **Vercel і cookie `__session`:** імена з префіксом `__` дозволені, `Secure` + `HttpOnly` перевіряємо смоук-тестом на проді.

## Уточнення під час планування й реалізації (2026-10-23)

Первісні сім уточнень (під час планування):

1. Сесії **абсолютні, 7 днів**; тихого оновлення немає (воно суперечило правилу `auth_time` ≤ 5 хв і зробило б сесії фактично необмеженими).
2. `requireVerifiedUser` читає живий запис користувача (`getUser`), а не claim `email_verified` у cookie (claim застигає на момент входу).
3. `proxy` не перевіряє відкликання, тож відкликана cookie може відкривати сторінки до закінчення терміну, а API її відхиляє (E2E перевіряє відкликання на API).
4. `/login` споживає `?redirect=` через `safeRedirectPath`.
5. Спільні правила шляхів — у `lib/auth/paths.ts` (їх використовують `proxy.ts` і клієнтський `AuthProvider`).
6. Порядок у `requireUser`: спочатку сесія (401), потім `Origin` для небезпечних методів (403).
7. Текст банера українською; переклад у S03.

Фактична поведінка після реалізації й рев'ю:

- **Proxy пильнує лише сторінки застосунку** (`/<segment>/…`, окрім `/login`, `/register`, `/forgot-password`). Перевіряє підпис і термін, не відкликання. `/login` і `/register` ніколи не редіректяться й не перевіряються: відвідувач із валідною cookie все одно може їх відкрити, а новий вхід перезаписує cookie. Правило «валідна cookie на /login → /» **відкинуто** (пастка застарілої cookie, коли в Firebase SDK немає користувача). Невалідна cookie на сторінці застосунку: очищається, редірект на `/login?redirect=<безпечний шлях>`. Збій перевірки на нашому боці (зокрема не отримані ключі підпису Google, які Admin SDK повідомляє як `auth/argument-error`, а ми зіставляємо з 503) — 503, cookie не чіпається, у лог іде лише код.
- **Абсолютні 7 днів, без тихого оновлення.** `POST /api/auth/session`: `auth_time` не старший за 5 хв (відсутній чи нечисловий `auth_time` закриває доступ: 401 `reauth_required`); тіло до 8 КБ (інакше 413); `Content-Type` має бути `application/json` (інакше 415); `Origin` має збігатися з хостом (інакше 403).
- **`requireVerifiedUser`** читає живий запис (`getUser`), а не claim. **`requireUser`** спершу перевіряє сесію (401), потім `Origin` для небезпечних методів (403).
- **`AuthProvider`** — один екземпляр у кореневому layout (вкладений у `(app)/layout.tsx` прибрано). Якщо в SDK немає користувача, він стирає серверну сесію, а на сторінці застосунку ще й робить жорсткий `window.location.replace` на `/login` (з `?redirect=`, окрім випадку, коли користувач щойно вийшов). Бічна панель при виході лише чекає на `signOut()`.
- **`safeRedirectPath`** відхиляє: не відносні шляхи, `//`, зворотні скісні риски, керівні символи, шляхи API (після нормалізації й декодування URL), шляхи, що зводяться до `//`, і сторінки автентифікації. `/login` поважає `?redirect=` лише коли в користувача є організація.
- **`ebFetch`** використовує same-origin cookie; на 401 очищає сесію й веде на `/login?redirect=…`.
- **`/api/auth/logout`** відкликає **усі** refresh-токени користувача, тобто виходить з усіх пристроїв. Те саме запускає стан «у браузері немає користувача SDK». Відкликає лише через **живу** сесію (`verifySessionCookie` із перевіркою відкликання): застаріла відкликана cookie (вкладка після 401 або пристрій, де зник користувач SDK) лише стирається, інакше два пристрої могли б виходити один за одного й закінчувати новіші сесії.
- **Повернення з банку:** сторінка налаштувань приймає `?eb_auth=` лише для підключення, яке почала ця вкладка (`eb_pending` у `sessionStorage`, одноразово, `lib/enablebanking/pending.ts`), бо callback віддає id банківської сесії в URL; `eb_auth` завжди прибирається з URL. Повноцінне виправлення (запис на сервері, прив'язаний до uid+org) — S09.
- **Емулятор проти production:** емулятор Auth (і `firebase-admin` в режимі емулятора) ЗАВЖДИ перевіряє відкликання, тож у E2E proxy суворіший, ніж у production, а E2E-тест «відкликана cookie на logout» не відрізняє старий код logout (запобіжник — юніт-тест).
- **Ліміт розміру `POST /api/auth/session`** (8 КБ) діє на заявлений `Content-Length`; chunked-тіло обмежує лише платформа (4,5 МБ на Vercel).
- **Реєстрація** додатково викликає `switchOrg(orgId)` (виправлено гонку в `OrgProvider`: `loadSeq` у `useOrg`, `switchOrg` бере `auth.currentUser`). Лист підтвердження надсилається best-effort; текст банера не стверджує, що лист надіслано; кнопка «Надіслати лист ще раз».
- **Стратегія тестів:** `tests/unit/server/route-auth-coverage.test.ts` вимагає від кожного обробника в `app/api` виклику `await requireUser(...)`/`requireVerifiedUser(...)` або запису в allow-list із причиною (замість первісного правила «усі мутуючі роути»); юніт-тести хелперів, роутів і proxy; E2E `tests/e2e/session-auth.spec.ts` (+ `tests/e2e/helpers/emulator-auth.ts`) на емуляторах Auth + Firestore.
