# Finmap — reverse-engineering (feature map + модель даних + API)

> Дата дослідження: 2026-10-22. Обʼєкт: веб-застосунок `https://my.finmap.online` (frontend build `2.3.3114`, Vite + React + Redux-Saga + MUI, axios, Unleash feature-flags, Stripe, Intercom, Amplitude).
> Метод: read-only обхід живого акаунта (UI польською), перехоплення `fetch`/`XHR` для схем відповідей, статичний аналіз JS-бандла (151 чанк, ≈9.4 МБ) для інвентаря ендпоінтів, роутів та enum-ів.
> Приватність: усі реальні суми, назви рахунків/контрагентів/категорій користувача, email, імена, IBAN, токени та ключі **виключені** з цього документа. Там, де потрібен приклад, — плейсхолдери `<amount>`, `<client name>` тощо.
> Локальні артефакти дослідження (скриншоти, злиті схеми API, JS-бандл) зберігаються поза репозиторієм і не публікуються, оскільки містять реальні дані.

---

## 1. Огляд і навігаційна карта

### 1.1 Загальна архітектура UI

- **Шапка (header)**: перемикач компанії («`<company>` / Change Company» → бічна шторка «Firmy»), три головні CTA: **«+ Wpływ»** (дохід), **«− Wydatek»** (витрата), **«⇄ Przelew»** (переказ), бейдж **«AI Advisor <N>»**, індикатор «Effectiveness» `N/5`, «Referral program» (подарунок), «FAQ», «History» (історія дій / undo), шестерня «Ustawienia» (меню профілю/компанії).
- **Лівий сайдбар** (згортається стрілкою «‹»): «Razem na kontach» (сума по всіх видимих рахунках у валюті компанії), «Suma N konta» (сума виділених рахунків), список «Moje konta» з кнопками `+` (додати рахунок/інтеграцію), олівець (редагування/сортування рахунків), refresh (оновити баланси банків); статус синхронізації (зелена крапка / «⚠ + червона крапка» з тултипом «Połączone banki wymagają ponownej autoryzacji» / «Not updating since <date>»), «Dodaj integrację» з логотипами; блок **«Przyszłe płatności»** з горизонтом (`1 miesiąc | 6 miesięcy | Wszystko`), «Przyszłe wpływy/wydatki» і «Razem na kontach (z uwzględnieniem przyszłych płatności)».
- **Головна панель**: горизонтальні таби модулів: «Płatności», «Analityka», «Faktury», «Kalendarz», «AI Advisor», «Użytkownicy», «Reguły automatyczne», «Marketplace» (на вузьких екранах частина ховається під «More»). Над контентом — контекстні банери (банк перестав синхронізуватися → «Details»; AI-банер «AI agent will categorize N operations (X%) … → Run AI agent»; AI-аномалії в аналітиці).
- **Налаштування**: окремий layout з лівим меню (див. 2.14).
- Модальні вікна мають guard **«Your data will not be saved / Are you sure you want to close? / Nie pytać więcej»** при закритті форми з незбереженими змінами.

### 1.2 Карта маршрутів (route → екран → призначення)

| Маршрут | Екран (PL label) | Призначення | Скриншот |
|---|---|---|---|
| `/log` | Płatności | Журнал операцій (факт + майбутні), фільтри, імпорт/експорт, bulk-дії | 01–39 |
| `/analytic` | Analityka | Плитки звітів (12 шт.) | 40 |
| `/analytic/cashflow` | Pieniądze / Cash flow | ДДС за датою платежу; графік/таблиця | 41, 43–45 |
| `/analytic/profitAndLoss` | Zysk / P&L | Управлінський P&L за датою угоди (accrual) | 46 |
| `/analytic/debit` | Należność | Дебіторка (хто винен нам) | 47 |
| `/analytic/credit` | Zobowiązania | Кредиторка (кому винні ми) | 48 |
| `/analytic/statement` | Wyciąg z konta | Виписка по одному рахунку за період | 49 |
| `/analytic/projects` | Projekty | Дохід/витрати/прибуток/рентабельність по проєктах | 50 |
| `/analytic/history` | Historia działań | Аудит-лог усіх змін + undo | 51, 59 |
| `/analytic/balance` | Balance | Управлінський баланс (активи/пасиви) | 52 |
| `/analytic/planActual` | Plan / Faktyczne | Бюджет vs факт (Cash або P&L) | 53–54 |
| `/analytic/financialPerformance` | Financial performance | Gross profit, Contribution margin, EBITDA, Margin%, кастомні метрики | 55, 60–62 |
| `/analytic/remunerationSheet` | Remuneration sheet | Відомість зарплат (тільки власник/повний доступ) | 58 |
| `/analytic/custom` | (кастомні звіти) | Шаблонні кастомні звіти — у цьому акаунті нескінченний лоадер (gated) | 57 |
| `/analytic/consulting` | Finmap financier | Консалтинг — редірект на `/log` (feature-flag вимкнено) | 56 |
| `/invoicing` | Faktury | Список фактур + створення | 63–65 |
| `/invoicing/vat` | Stawka VAT | ПДВ: нараховано/сплачено/залишок по періодах | 66 |
| `/calendar` | Kalendarz | Календар платежів (місяць) + графік балансу | 67–70 |
| `/agents` | AI Advisor | Чат з AI-агентом, інструменти, ліміти | 71–72 |
| `/employee` | Użytkownicy | Користувачі компанії, ролі, запрошення | 73–77 |
| `/autorules` (і `/settings/auto-rules`) | Reguły automatyczne | Автоправила категоризації | 78–80, 93 |
| `/marketplace` | Marketplace (BETA) | Каталог інтеграцій/партнерських застосунків | 82 |
| `/settings/profile` | Profil | Email/телефон (read-only), мова, зміна пароля | 84 |
| `/settings/security` | Security | 2FA, активні сесії, видалення профілю | 85 |
| `/settings/companies` | Moje firmy | Список/створення компаній | 86, 126 |
| `/settings/implement` | Konfiguracja i wdrożenie | Пакети консалтингу (Plan S/M/L) | 87 |
| `/settings/subscription` | Plany | Тарифи, аддони, порівняння | 88, 90–92 |
| `/settings/companySubscription` | Subskrypcja | Поточний білінг-період, використання лімітів, рахунки, платіжні дані | 89 |
| `/settings/clients` | Kontrahenci | Контрагенти за типами | 94, 99–101 |
| `/settings/accounts` | Konta | Рахунки (порядок, редагування) | 95 |
| `/settings/categories` | Kategorie | Системні + власні категорії (2 рівні) | 96, 102–106 |
| `/settings/projects` | Projekty | Проєкти + Split templates | 97, 127–129 |
| `/settings/tags` | Tagi | Теги | 98, 125 |
| `/settings/employees` | Użytkownicy | Те саме, що `/employee` | 107 |
| `/settings/roles` | Stanowiska użytkowników | Ролі | 108 |
| `/settings/currencies` | Stałe kursy walut | Власні курси, історичні курси | 109, 119 |
| `/settings/backup` | Company Backup | Автобекапи компанії | 110 |
| `/settings/invoicing-my-details` | Moje szczegóły | Реквізити продавця для фактур | 111, 123 |
| `/settings/invoicing-clients-details` | Dane klientów | Реквізити покупців | 112, 124 |
| `/settings/goods` | Dobra | Довідник товарів/послуг | 113, 122 |
| `/settings/api` | API | API-ключі + документація | 114, 120 |
| `/settings/webhooks` | Webhook | Вебхуки | 115, 121 |
| `/settings/customization-log` | Konfiguracja dziennika | Колонки журналу (те ж, що «Journal settings») | 117 |
| `/settings/ai` | Asystent Finmapa | Перемикач AI-асистента | 118 |
| `/settings/marketplace` | — | (у enum, не відкривався окремо) | — |
| `/auth/login`, `/auth/register`, `/auth/forgot`, `/auth/restore_password`, `/auth/create-company`, `/auth/create-phone`, `/auth/emailsent` | Auth | Вхід/реєстрація/відновлення, створення першої компанії | — (не відкривались, щоб не розлогінитись) |
| `/onboarding`, `/access_denied`, `/success-payment`, `/faq`, `/redirectPoster`, `/privacy-notice`, `/public-offer` | службові | онбординг, відмова в доступі, успішна оплата Stripe, редірект інтеграції Poster, юр. сторінки | — |

---

## 2. Модулі

### 2.1 Płatności — журнал операцій (`/log`)

**Призначення.** Головний робочий екран: єдиний журнал усіх операцій (доходи, витрати, перекази; факт і план), швидке редагування, імпорт/експорт, масові дії.

**Layout (регіони):**
1. Банери (банк/AI).
2. Тулбар: період («Przez cały czas» ▾) · пошук «Szukaj po kontach, klientach, komentarzach» (react-select з чипами) · кнопка пошуку · **«Suma: Od / Do»** (діапазон сум) · «Filtr» + ▾ (швидкі фільтри) · «Zresetować» (з'являється при активних фільтрах) · «More» (популярні: перемикач «Try the new design», refresh, «Journal settings», export) · **«Importować»** (Excel/PDF/CSV іконки).
3. Таблиця (віртуалізована, infinite scroll, sticky header). Колонки: `Data` (сортування ↓↑; дата + час «Dziś HH:MM» / «Wczoraj HH:MM»), `Kwota` (зелений +, червоний −), `Konto/bilans` (назва рахунку + **баланс рахунку після операції** — `accountBalanceAfterOperation`), `Kontrahent`, `Kategoria`, `Projekt`, `Komentarz`, `Dodatkowe informacje` (теги-іконка з лічильником), опц. `Data transakcji` (accrual-дата). Порожні поля показані зеленим чипом **«wpisz»** (клік → інлайн-поповер «Edycja kontrahenta / kategorii / projektu» з одним селектом + «Zachować»).
4. Група **«Przyszłe płatności • N (list: next 7 days)»** — згортається; всередині кнопка «Pokazać przez miesiąc» (розширити горизонт).
5. Іконка «ⓘ» біля дати — операції, що потребують підтвердження/мають прогноз (`hasPrediction`, `predictionTypes`).

**Період (пресети):** «Na bieżący rok», «Za poprzedni rok», «Za bieżący tydzień», «Za ostatni tydzień», «Za bieżący miesiąc», «Za ostatni miesiąc», «Przez cały czas», «Wybierz daty» (діапазон). Enum у коді: `currentYear, prevYear, currentWeek, prevWeek, currentMonth, prevMonth, allTime` (+ квартальні за флагом `useQuarterlyFilter`).

**Фільтр (модалка «Filtry»):** «Rodzaje płatności i kategorie» (дерево: Wszystkie → Wszystkie wpływ kategorie ▸ / Wszystkie wydatek kategorie ▸ / Przelew), «Kontrahenci», «Projekty (N)», «Tagi (N)», «Konta (N)»; кнопки «Gotowe!» (застосувати) і «Zapisz filtr» (зберегти як швидкий фільтр). **Швидкі фільтри** (▾ біля «Filtr»): «Szybkie filtry — Tutaj możesz zapisać często używane kombinacje filtrów… / Utwórz nowy filtr» (ендпоінт `/filter`).

**Параметри запиту журналу** (POST `/operations/log` з тілом `{ query: "<urlencoded querystring>" }`):
`offset, limit, startDate, endDate (epoch ms), id (preset периоду), field (date|dateOfPayment|sum|accountName|counterpartyName|categoryName|projects|addInfo|comment), desc, types (income,consumption,transfer), approved (true=факт / false=план), useDateOfPayment, categoryV2Ids, accountIds, projectIds, tagIds, counterpartyIds…, invoice, search, sumFrom, sumTo, operationIds`. Відповідь `{ items: Operation[], total }`; окремо `GET /operations/log/count`.

**Колонки («Ustawienia wizualne» / Journal settings):** чекбокси Data, Kwota, Data transakcji, Konto/bilans, Kontrahent, Kategoria, Projekt, Komentarz, Dodatkowe informacje + «Pokaż w całości» (перенос до 2 рядків) + «Aplikuj do wszystkich firm». Зберігається у `user.customization` (JSON-рядок у профілі).

**Експорт:** «Eksport w → Excel» (миттєвий) і **«Build Excel»** — конструктор: drag-n-drop порядок колонок, превʼю на прикладі; групи полів: OPERATION (Data płatności, Data zaksięgowania, Okres księgowania od/do, Kwota w walucie konta, Kwota w walucie firmy, Status plan/actual), ACCOUNTS (Z konta, Na konto), CATEGORIES (Kategoria, Podkategoria), COUNTERPARTIES (Kontrahent, Podkontrahent), PROJECTS (Projekt, Podprojekt), TAGS & COMMENT; GROUPING (No grouping / By projects / By categories / Project → category), SHEETS (Single sheet / By month), OPERATIONS (All / Actual / Planned); «My templates» (зберегти шаблон). Формати в enum: `.csv, .xls, .xlsx, .pdf` (+ PDF журналу `POST /operations/log/pdf`).

**Bulk-дії** (чекбокси рядків → зелена панель «Zmienić dane | Usunąć | Wpływ • N płatność • <amount>»). Меню «Zmienić dane»: Zmienić konto, Zmień datę wypłaty, Zmień datę transakcji, Change the deal period, Zmienić kategorię, Zmienić kontrahenta, Zmienić projekt, Zmienić tag, Zmienić komentarz (+ «Merge to transfer» для пари операцій — у бандлі). Кожна дія — модалка «Edycja <поля> / WYBRANA N TRANSAKCJA / <select> / Zachować».

**Історія дій (іконка History у шапці → шторка «Historia działań»):** таби «Płatności | Imports | Początkowy bilans»; запис = іконка типу (створено/змінено/видалено), сума, рахунок, timestamp, автор (для початкового балансу — `<user>`), кнопка **«Odwołaj»** (undo); внизу «Więcej szczegółów» → `/analytic/history`.

**API (журнал):** `POST /operations/log`, `GET /operations/log/count`, `GET /futurePayments/byPeriod?futurePaymentsTotalMonths&location`, `GET /categories/income|consumption?context=operation`, `GET /{clients|suppliers|creditors|investors|borrowers|staffMembers|owners|taxOrganisations}?context=…`, `GET /projects`, `GET /tagsWithPagination`, `GET /accounts?context=log`, `GET /integrations/disconnected`, `GET /category-suggestions/current`, `GET /subscriptions/used?select=transactions`, `GET /export-templates`, `GET /ai/anomaly/banner?reportType`, `GET /operations/history…`.

**UX-деталі, варті копіювання:** баланс рахунку після кожної операції прямо в рядку; «wpisz»-чипи для швидкого доповнення; тултип «Updated N годин тому» біля рахунку; кнопка «Dodaj i utwórz podobny» у формах; захист від втрати введених даних; undo кожної дії.

### 2.2 Форми операцій (Wpływ / Wydatek / Przelew + редагування)

#### 2.2.1 «Nowy wpływ» (дохід)
| Поле (label) | Тип | Обовʼязк. | Default / примітка |
|---|---|---|---|
| Na konto | select рахунку (назва + баланс + валюта) | так | — |
| Kwota, <валюта> | number + **вбудований калькулятор** | так | — |
| Waluta | select валюти | так | валюта рахунку / базова валюта компанії |
| Kategoria | autocomplete (власні + **SYSTEM**-категорії) | ні | — |
| Mój kontrahent → змінюється за категорією | autocomplete + «+ Utworzyć <тип> "<текст>"» | ні | label залежить від системної категорії (див. 2.2.4) |
| Data wpływu pieniędzy (`date`) | datetime | так | зараз |
| «Data transakcji jest inna» → **Data transakcji / sprzedaży** (`dateOfPayment`) | datetime | так (коли ввімкнено) | = date; підказка «Transakcja będzie liczona w podanym tutaj okresie» |
| Zrób cykliczną | select: Nie powtarzać / Codziennie / Co tydzień – <день> / Co miesiąc – <число> / Co rok <дата> / **Inna opcja** | ні | Nie powtarzać |
| ↳ Inna opcja («Powtórzyć płatność») | interval N + одиниця (Dzień/Tydzień/Miesiąc/Rok); Koniec: Nigdy / Data / Po N powtarzań | — | 1 Dzień, Nigdy |
| Dodaj projekt, tag, komentarz, plik ▸ | Projekt (select), Tagi (multi), Komentarz (textarea), файл (drag&drop, ≤10 MB) | ні | — |
| Кнопки | «Dodaj wpływ», «Dodaj i utwórz podobny» | | |

#### 2.2.2 «Nowy wydatek» (витрата)
Ті самі поля, але «Z konta», «Określić datę wydatku». Для системних категорій **«Pensja»** зʼявляється рядок **«Pensja za <місяць>»** (зарплатний період, `salaryPeriodId/Start/End`), для **«Podatki»** — **«Za <місяць>»** (податковий період, `taxPeriodId`), у цих випадках «Data transakcji jest inna» замінюється на період.

#### 2.2.3 «Przelew» (переказ)
Data przelewu pieniędzy · Z konta · Na konto · Kwota. Якщо валюти рахунків різні — **дві суми** («<валюта A>, <символ>» ⇄ «<валюта B>, <символ>» з кнопкою swap) + поле **«Kurs <B> / <A>»** (автопідставляється з провайдера курсів на дату, 8 знаків після коми; запит `GET /common/currencyExchangeRates/{from}/{to}?date`). Далі Projekt, Tagi, Komentarz, файл; «Dodać przelew» / «Dodaj i utwórz podobny».

#### 2.2.4 Системні категорії → тип контрагента
| Сторона | Системна категорія (PL) | subType / fullType | Поле контрагента | Колекція |
|---|---|---|---|---|
| дохід | (будь-яка власна) | `sale` / `income_sale` (+`income_generic`) | «Mój kontrahent» | clients / counterparties |
| дохід | Inwestycje | `investment` / `income_investment` | «Inwestor» | investors |
| дохід | Uzyskiwanie pożyczki | `loan` / `income_loan` | «Kredytodawca» | creditors |
| дохід | Spłata pożyczki | `loanRepayment` / `income_loanRepayment` | «Kredytobiorca» | borrowers |
| витрата | (будь-яка власна) | `supplier` / `consumption_supplier` (+`consumption_generic`) | «Mój kontrahent» / «Dostawca / Wykonawca» | suppliers / counterparties |
| витрата | Dywidendy | `dividend` | «Właściciel» | owners |
| витрата | Udzielenie pożyczki | `loan` | «Kredytobiorca» | borrowers |
| витрата | Spłata pożyczki | `loanRepayment` | «Kredytodawca» | creditors |
| витрата | Pensja | `salary` | «Pracownik» + період | staffMembers |
| витрата | Podatki | `tax` | «Rodzaj podatku» + період | taxOrganisations |
| витрата | vat-system | (VAT) | «Mój kontrahent» | — |

Мапінг у коді: `salary→staffMemberId, sale→clientId, investment→investorId, loan→borrowerId, loanRepayment→creditorId, dividend→ownerId, other→counterpartyId, supplier→supplierId, tax→taxOrganisationId`.

#### 2.2.5 Редагування операції (клік по рядку)
Та сама форма з заголовком «Wydatek/Wpływ» + бейдж **«Integracja z bankiem»** (для операцій з банку рахунок і валюта disabled). Додатково:
- **«Podziel płatność»** → «Podziel <amount> między: **Projekty** | **Kategorie (beta)**» → рядки `[Kategoria/Projekt] [Kwota] lub [Procent, %]`, лічильник «Pozostawiony do rozdzielenia <amount> / <%>», «+ Dodaj kategorię», «Gotowe!/Odwołaj». У даних: `projectObjects`, `categoryObjects`, `isPartial`, `hasPartial`, `hasProjectSumError`, `hasCategorySumError`; у API проєкти передаються як `projects: [{ id, stake }]` (stake = %).
- Кнопки: **«Zmień na przeniesienie»** (перетворити на переказ), **«Zduplikowana płatność»** (дублювати), **«Usunąć transakcję»**, «Zapisać zmiany». Для регулярних — видалення «цієї / всіх наступних» (`removeAllNextScheduled`).

#### 2.2.6 Валютна модель операції (з коду)
Операція має: `sum` (у валюті рахунку), `currencyId`, `companyCurrencySum` (у базовій валюті компанії), `exchangeRate`, а якщо валюта платежу ≠ валюті рахунку — `transactionSum`, `transactionCurrency`, `transactionCurrencyRate`. Час-зона клієнта передається як `?offset=<utcOffsetMs>` у всіх create/update.

**API форм:** `POST /operations/{type}/{subType}?context=operation&offset&isDuplicate`, `PATCH /operations/{type}/{subType}/{id}`, `DELETE /operations/{type}/{subType}/{id}?undoHistoryId`, `POST|PATCH /operations/transfer…`, `PATCH /operations/transfer/transformOperationToTransfer/{id}`, `PUT /operations/{type}/{subType}/{id}/files`, `PATCH …/payOffFuture/…`, `PATCH …/combine/predication/future`, `GET /common/currencyExchangeRates/{from}/{to}?date`.

### 2.3 Рахунки (Konta) та інтеграції

- **«Jak chcesz dodać konto?»**: (а) «Ręczne utworzenie konta → Utwórz konto»; (б) «Automatyczne połączenie z bankiem lub serwisem» — пошук «Wyszukiwanie według nazwy banku…», фільтр «All countries», акордеони «USŁUGI IMPORT», «INNE KRAJE IMPORT», «<KRAJ> INTEGRACJE AUTOMATYCZNE» (≈35 країн: AT, BE, BG, BR, CO, CY, CZ, DE, DK, EE, ES, FI, FR, GB, GR, HR, HU, IE, IN, IS, IT, KZ, LI, LT, LU, LV, MT, MX, NG, NL, NO, PK, PL, PT, RO, SE, SI, SK, UA, UZ, ZA), «<KRAJ> IMPORT»; у кожній країні додатково «Dodaj portfel kryptowalutowy», «TRON»; футер «SSL Secure · 256-bit Encryption · ISO/IEC 27001».
- **Ручний рахунок («Dodawanie nowego konta»)**: Waluta (select усіх ISO-валют), Nazwa, Początkowy bilans (підказка «To jest saldo konta w momencie dodania go na Finmap»), «Dodaj zmiany». Типу рахунку (каса/банк/картка) у UI **немає** — у payload є `typeId`, `crypto`, `partnersId`.
- **Список «Konta» (олівець у сайдбарі)**: drag-handle (порядок), валюта, назва, бейдж «Podłącz ponownie bank», лого банку, іконка історії, олівець. **«Edycja konta»**: Nazwa, Początkowy bilans, «Podłączyć bank» (привʼязати банк до ручного рахунку), **«Ukryć»** (приховати), «Usunąć», «Zapisać zmiany».
- Банер «The bank has temporarily stopped sending new transactions. Accounts without updates: N → Details» → список рахунків із «Podłącz ponownie bank».
- **API:** `GET /accounts?context`, `POST /accounts {typeId,currencyId,name,startingBalance,crypto,partnersId}`, `PATCH /accounts/{id}`, `PATCH /accounts/update/many`, `DELETE /accounts/{id}`, `GET /accounts/{id}/statement`, `GET /operations/history/account` (історія зміни початкового балансу/назви), `GET /integrations`, `GET /integrations/disconnected`, провайдер-специфічні `…/integrations/<provider>Credentials…`.

### 2.4 Імпорт

Шторка «Skąd będzie pochodzić import?»: пошук, «Otwórz/Zwiń wszystkie importy», **«AI import»** (вибір рахунку «Na konto» + файл ≤10 MB; «AI analizuje plik i automatycznie tworzy operacje… від кількох секунд до хвилини»; «Rezultat nie jest idealny?»), «USŁUGI» (Excel — з «Ściągnąć szablon», Upwork, PayPal, Binance, WesternBid, DNTrade, Payoneer, Trustee), країни (UA, PL, KZ, UZ, BR, «Inne kraje» ~40 банків). Внизу «…proszę napisać, skąd by chciał Pan importować → Chcę import z…» (заявка на новий парсер).
Каталог парсерів — `GET /importParsers` (`id, icon, title, type: services|ukraineImports|polandImports|kazakhstanImports|uzbekistanImports|brazilImports|otherCountriesImports, countries[], translations{12 мов}, withAccount, availableImportType[], customParse`), ≈130 парсерів. Завантаження — `POST /imports`, AI — `POST /ai/import`, PDF — `POST /pdfParse/upload`; історія — `GET /imports/history?nextOffset`, `DELETE /imports/history/{id}` (відкат імпорту); колонки шаблону — `GET /imports/export-columns` (`date, dateOfPayment, periodFrom, periodTo, amount, companyCurrencySum, accountFrom, accountTo, type, subCategoryName, counterpartyName, subcounterparty, project, subproject, tags, comment`).

### 2.5 Аналітика (`/analytic`)

Оглядова сторінка — 12 плиток з «?»: Pieniądze/Cash flow, Zysk/P&L, Należność, Zobowiązania, Wyciąg z konta, Projekty, Historia działań, Balance, Plan/Faktyczne, Financial performance, Finmap financier (консалтинг), AI Advisor. Звіти, недоступні за тарифом, показуються з замком (`locked` asset, `useAnalyticAccess`).

**Спільний тулбар звітів:** перемикач **Chart view / Table view**; період (ті ж пресети + «Wybierz daty»); **розріз** «Według kategorii | Według kontrahentów | Według projektów»; **«Rozważ przyszłość | Z wyłączeniem przyszłości»** (враховувати плановані); **«Według miesięcy | Według kwartałów»**; у табличному режимі **«Ukryj procenty / Pokaż procenty»** (частка рядка); Filtr (та сама модалка, що в журналі); експорт «Excel»; Refresh; «?» help. Над звітом — AI-банер аномалій («Znaleziono X% przychodów bez kategorii, wydatki spadły o Y%… → View details»).

#### Cash flow (`/analytic/cashflow`)
- Графік: стовпці Przychody / Wydatki (+ заштриховані «Przyszłe przychody/wydatki»), лінії «Saldo» і «Saldo (przyszłe)» (пунктир); кругові діаграми по категоріях.
- Таблиця (рядки × місяці + Total): **Bilans z początkiem miesiąca**, **Bilans na koniec miesiąca**, **Wahania kursów walut i transfery** (розгортається: *Starting balances, Transfers, Accounts excluded from the report, Exchange rate difference, Reconciliation*; тултип: курсові різниці змінюють баланс у базовій валюті; перекази на рівні компанії = 0), **Przepływ pieniężny netto**, **Przychody** ▸ (категорії → підкатегорії, «Bez kategorii dochodowych»), **Wydatki** ▸ (… «Brak kategorii wydatków»).
- API: `POST /analytics/cash/main` → `periodChart {months[], approvedIncomes[], notApprovedIncomes[], approvedConsumptions[], notApprovedConsumptions[], differences[], approvedDifferences[], differencesByFullMonth[], approvedDifferencesByFullMonth[]}`; `POST /analytics/cash/table` → `tableData[{month, startMonthBalance, balance, difference, approvedIncome, approvedConsumption, notApprovedIncome, notApprovedConsumption, currencyRateDiff, startBalanceDiff, transfersDiff, excludedAccountsDiff, pureRateDiff, approved* варіанти, startBalanceIsDay, endBalanceIsDay}]`; `POST /analytics/cash/categories/{circles|charts}/{income|consumption}` (також `/counterparties/…`, `/projects/…`), query: `startDate, endDate, filterPeriod=month|quarter, types, approved, categoryV2Ids, tableMonths`.

#### P&L (`/analytic/profitAndLoss`)
- Ті ж контролли. Банер: «Sometimes there's money but no profit… enable "Deal date differs" and set the date when you actually deliver the service. This is management profit — not an accounting report».
- Таблиця: **Zysk** (рядок), **Wpływy** ▸, **Wydatki** ▸.
- Розраховується з `useDateOfPayment=true` (accrual-дата) і обмеженим `categoryV2Ids`: **виключено** всі системні доходні категорії (інвестиції, отримані позики, повернення позик) та витратні `dividend`, `loan`, `loanRepayment`; перекази виключено. Зарплата, податки, ПДВ — входять.
- API: `POST /analytics/profitAndLoss/{main|table|categories/…}`.

#### Należność / Zobowiązania (`/analytic/debit`, `/analytic/credit`)
- Таблиця «Kontrahent | Należność» (або «Zobowiązanie»), сума в заголовку, фільтр дати стану: «Bieżące | Wczoraj (koniec dnia) | Z końcem zeszłego miesiąca | Wybierz datę (koniec dnia)», Filtr, експорт.
- Help: «For a debt to show up here — record it as an income, set "My counterparty" and a future "Payment receipt date"» → дебіторка = операції з accrual-датою ≤ дати звіту, але грошовою датою в майбутньому (неоплачені).
- API: `POST /analytics/debit` → `{clientsDebit[], investorsDebit[], borrowersDebit[]}`; `POST /analytics/credit` → `{suppliersCredit[], ownersCredit[], staffMembersCredit[], taxs{companyCurrencySum, sumByCurrency{}}, taxOrganisationsCredit[], creditorsCredit[]}`; історія `GET /analytics/{debit|credit}/history?date`. Є «mutual settlements» (`clientsMutual`, `PATCH /employees/mutual-settlements`) — взаємозалік для контрагента, що одночасно клієнт і постачальник.

#### Wyciąg z konta (`/analytic/statement`)
Період + вибір рахунку + експорт; таблиця як у журналі. `GET /accounts/{id}/statement?startDate&endDate` → `{income, consumption, transferTo, transferFrom}` + журнал з `accountIds`.

#### Projekty (`/analytic/projects`)
Фільтри: «Active projects | Archived projects | All projects», «Only projects | Projects with categories», період, «Rozważ przyszłość», Filtr, експорт. Колонки: Nazwa, Wpływy, Wydatki, Zysk, Wpływ/Wydatek %, Rentowność %; рядок «Bez projektów». `POST /analytics/projects` (`useDateOfPayment=true`) → `[{id,label,visible,income,consumption,profit,rateOfReturn,margin}]`.

#### Historia działań (`/analytic/history`)
Лічильник «Znaleziono N operacji w historii działań», період, Filtr. Колонки: Działania (іконка create/update/delete), «Action / operation date», Kwota, Konto/bilans, Pracownik (автор: користувач **або «Reguła automatyczna»**), «Więcej szczegółów» (модалка **«Było» vs «Stało»** — дві копії форми + «Anulować działanie»), «Filtruj według operacji», «Odwołaj»; чекбокси для масового undo. API: `GET /operations/history?offset&limit&startDate&endDate`, `GET /operations/history/used-transactions`, `PATCH /operations/…/restore/{id}?undoHistoryId`.

#### Balance (`/analytic/balance`)
Дата стану («Bieżące …»), експорт. Банер: «What your business is really worth… management balance». Структура:
- **Assets**: I. Fixed assets (Property, Plant & Equipment — ручне поле; Intangible Assets — ручне; Investments — авто), II. Current assets (Reserves — ручне; Accounts Receivable ▸ — авто з дебіторки), III. Money ▸ (залишки рахунків).
- **Liabilities**: I. Equity (Authorized capital — ручне; Additional capital — ручне; Retained earnings (uncovered loss) — **балансуюча величина**), II. Loan capital ▸ (кредитори), далі поточні зобовʼязання (постачальники, зарплата, податки).
- Розрахунок на клієнті з debit/credit/cash; ручні значення живуть у стані UI (`setPropertySum`, `setAuthorizedSum` …).

#### Plan / Faktyczne (`/analytic/planActual`)
Період, режим «Plan / Faktyczne | Historia działań», бюджет «Gotówka | P&L» («CashFlow and P&L are two separate budgets: the first counts by payment dates, the second by deal dates»), «Według kategorii | Według projektów», експорт, refresh. Таблиця: Kategoria × (місяць: Plan, Faktyczne, Odchylenie, %) + Totalny; секції WPŁYW/WYDATEK, Total income/expenses, Net profit; «% = share of plan completed». **«Add plan»** → «Add to plan»: SIDE (Income|Expense), MONTH, CATEGORY (суми для категорії та кожної підкатегорії, «they sum up»). API: `GET|POST /analytics/planActual`, `PATCH|DELETE /analytics/planActual/{id}`, `GET /analytics/planActual/history`.

#### Financial performance (`/analytic/financialPerformance`)
Період, «Financial performance | History», експорт. Таблиця «Wskaźnik × місяць + Łącznie»: **Zysk brutto = Revenue − COGS**, **Contribution Margin = Revenue − Variable Costs**, **EBITDA = Revenue − Operating Expenses**, **Procent marży = (Zysk ÷ Revenue) × 100**. Клік по назві → «Edit indicator»: мультивибір доходних категорій для Revenue і витратних для COGS/… («Select all/Clear all»). **«+ Custom indicator»**: назва; DATA METHOD «Cash flow | Accrual·P&L»; BREAK DOWN BY «Categories | Counterparties | Projects»; A (Income|Expense + вибір), оператор (+ − × ÷; «+» недоступний для income і expense), B; «Show as percentage (×100)»; превʼю формули. API: `GET /analytics/financialPerformance?startTimestamp&endTimestamp` → `{GrossProfit{data[{month,value}],total}, ContributionMargin, EBITDA, Margin, months[]}`, `GET /analytics/financialPerformance/entities` → `[{reportType, categoryType, categoryId}]`, custom CRUD, `…/custom/preview`, `…/history`.

#### Remuneration sheet (`/analytic/remunerationSheet`)
Контролли: місяць, «Month | Year», «By people | By projects», «All projects», Export. Для поточного користувача — «No access to the remuneration sheet. The sheet is visible to the owner and roles with access to all company data». API: `/remuneration-sheets` (CRUD + history), `/analytics/remuneration-report/{month|year|month/projects}`.

### 2.6 Faktury (`/invoicing`, `/invoicing/vat`)

- Таби «Faktury | Stawka VAT», «+ Nowa faktura», період, Filtr, refresh, відео-help. Порожній стан — промо-блок (створюйте фактури, зберігайте контрагентів, контролюйте оплати, відправка в 1 клік, облік ПДВ).
- **«Nowa faktura»**: логотип компанії (upload), Numer faktury, Data wystawienia, Data sprzedaży, Waluta faktury; **Dane sprzedawcy** (select з «Moje szczegóły» + textarea NIP/Numer konta/Telefon/Adres), **Dane nabywcy** (select з «Dane klientów» + textarea); чекбокс **«VAT naliczony»**; позиції: Nazwa produktu/usługi (select з «Dobra»), Ilość, Cena, Kwota, 🗑, «+ Dodaj pozycję»; «Dodaj rabat» (€ або %), «Dodaj dostawa»; «Razem do zapłaty»; Dodatkowe informacje (Notatki). Дії: «Zachować», «Zapisz i wyślij», «Ściągnij PDF», «+ Twórz podobne»; «Sign with Dubidoc».
- Фактура = доходна операція з `invoice: true`, `confirmedInvoice` (підтвердження оплати), `goodsIds`.
- **VAT**: KPI «Accrued / Paid / Outstanding / Invoices», «VAT SETTINGS — Default rate (auto-applied to new invoices)», «PERIODS» (місяць/квартал: Accrued, Paid, статус Current/Paid). `GET /analytics/vat/table?dateFrom&dateTo&periodType` → `{total{billed,paid,difference,billedCount}, table[{periodName,dateFrom,dateTo,billed,billedCount,paid,difference}]}`, `GET|PATCH /vat-settings {defaultVat}`.
- API: `/operations/income/invoices` (CRUD, `/send`, `/downloadInvoice`, `/downloadPayment`, `/confirmedInvoice`, `/signWithDubidoc`, `/files`), `/operations/income/invoices/goods`, `/operations/income/invoices/props?isMy`.

### 2.7 Kalendarz (`/calendar`)

- Навігація місяцями «‹ Październik 2026 ›», перемикач **Calendar view / Chart view**, Filtr, help.
- Клітинка дня: `+<дохід>` (зелений чип), `−<витрата>` (червоний), **баланс на кінець дня** (сірий). Ховер → «Wpływ / Wydatek / Przelew / Copy» (створити операцію на цю дату, скопіювати). Клік по дню → екран дня з табами **«Bilans konta»** (по кожному рахунку: залишок на кінець дня, «Kurs względem waluty firmy», «Saldo w walucie firmy», копіювання) і **«Płatności w ciągu dnia»**. Минулі/майбутні дні відрізняються стилем; дні поза місяцем сірі.
- Chart view: стовпці балансу на кінець кожного дня.
- API: `POST /analytics/calendar` (query `year, month, offset, limit, desc, field, types`) → `[{date, income, consumption, balance, end, month, accounts[{_id, name, currencyId, startingBalance, balance, income, consumption, companyCurrencyBalance, currency{symbol}}]}]`; `GET /analytics/calendar/ai` (AI-коментар). Флаги: `REDESIGN_CALENDAR`, `SHOW_FILTERS_IN_CALENDAR`, `SHOW_CASH_GAP` (касовий розрив).

### 2.8 AI Advisor (`/agents`)

- Лівий стовпець: CONVERSATION («+ New chat», список чатів), TOOLS: **Check report, Check payments, Statement import, PDF report**; картка CONSULTING «Want to dig deeper? → Call a financier».
- Верх: бейдж «Encrypted · AI does not learn from your data», «+ Auto-confirm actions» (агент виконує дії без підтвердження), «Usage» (поповер «This month <used> / <limit>»).
- Центр: привітання + quick prompts «Monthly overview», «Where money goes», «What if…», «Explain a term»; поле вводу з «/» (slash-команди), мікрофон (голосовий ввід, AssemblyAI); дисклеймер «AI can make mistakes».
- Інші AI-фічі в продукті: банер «Run AI agent» (категоризація некатегоризованих операцій за місяць), AI-аномалії по звітах, AI-підказки категорій (`/category-suggestions/{id}/accept|decline|revert`), AI import, AI-онбординг-чат, Finmap MCP (керування з AI-асистента), «Folio» (AI-асистент партнера).
- API: `GET /ai/agent/conversations`, `GET /ai/agent/history`, `POST /ai/agent/execute-action`, `POST /ai/agent/feedback`, `POST /ai/agent/log-note`, `GET|POST|PATCH|DELETE /ai/quick-queries`, `GET /ai/reports`, `GET /ai/pdf/{id}`, `GET /ai/usage` (`{used, limit, isUnlimited}`), `GET /ai/tariff-limits`, `GET /ai/anomaly/banner?reportType` (`{hasAnomalies, shortSummary, month, isFromCache}`), `POST /ai/anomaly/detect|payments`, `GET /ai/anomaly/history`, `GET /ai/operations/uncategorized-summary`, `POST /ai/import`.

### 2.9 Użytkownicy та ролі (`/employee`, `/settings/roles`)

- Таблиця: Imię (інлайн-редагування), Stanowisko (посилання на роль), Prawa dostępu (резюме: «Pełny dostęp 😎», «Rejestr, analityka, raporty»). Власник — окремий рядок «Właściciel».
- **«Dodaj pracownika» → «Nowy pracownik»**: Imię i nazwisko, Email, Stanowisko (select: шаблони «Wyświetl wszystkie», «Przeglądanie i edycja wszystkiego», «Przeglądanie, edytowanie i usuwanie wszystkich», системна «Pełny dostęp — Dostęp do utworzenia, edycji i usunięcia wszystkich podmiotów, jak również konfiguracji dostępu użytkowników», кастомні ролі, «+ Utworzyć stanowisko»), «Dodaj pracownika» → інвайт на email.
- **«+ Dodaj stanowisko» → «Edycja stanowiska»** — матриця прав (див. розділ 5).
- API: `GET /invites` → `{invites[], employees[{_id, roleId, userId, email, role, createdAt}]}`, `POST /invites {roleId, name, email}`, `DELETE /invites/{id}`, `GET /employees`, `PATCH /employees/{id} {roleId, name}`, `DELETE /employees/{id}`, `GET|POST /roles {label}`, `PATCH|DELETE /roles/{id}`, `PATCH /roles/all/bulk`, `GET|POST /permissions?roleId`, `DELETE /permissions/{id}`, `GET /permissions/ids`, `GET /permissions/validate`, `GET|POST|DELETE /permissionPeriods?roleId`, `GET /permissionTypes`, `GET /resources`, `GET|POST|PATCH|DELETE /fastPermissions`.

### 2.10 Reguły automatyczne (`/autorules`)

- Список: drag-handle (порядок застосування), назва, «Utworzono <date>», toggle active, олівець. «Dodać».
- **«Nowa zasada»**: Imię (назва), toggle «Wyłącz regułę», «Reguła obowiązuje dla operacji: Wpływ | Wydatek»; **Stan** (умови): поле `Komentarz | Konto` × оператор `Zawiera | Nie zawiera | Równy` × значення («Tekst» або вибір рахунку), «+ Dodaj kolejny warunek»; **Działanie**: «Dodać» × сутність `Kategoria | Klient(контрагент) | Projekt | Tag` × значення, «+ Dodaj kolejną akcję» (кожна сутність лише раз); «Utwórz reguły / Odwołaj».
- Модель (з API): `{ _id, name, type: income|consumption, active, orderIndex, createdBy, creatorEmail, createdAt, conditions: { and|or: [ { in|nin|eq|neq: [<field>, <value>] } ] }, actions: [ { entity, value } ] }`. Enum умов: поля `comment, account` (для переказів — `comment, accountFromId, accountToId, type`); оператори `IN, NIN, EQ, NEQ`; логіка `AND, OR`; сутності дій: `project, tag, category-income, category-consumption, investor, creditor, debitor, supplier, employee, owners, tax-organisation, client`.
- Застосування: до нових операцій (банк/імпорт/API); операція зберігає `executedRules[{ruleId, ruleName}]`, в історії — автор «Reguła automatyczna», `actionSources: ['rule']`, `changedByRule`.
- API: `GET|POST /rules`, `PATCH|DELETE /rules/{id}`, `PATCH /rules/order`, `GET /rules/status`, `PATCH /rules/status/{id}`.

### 2.11 Marketplace (`/marketplace`, BETA)

Пошук, SHOWCASE (Home), CATEGORIES (Cash registers PRRO, CRM & sales, Telephony, Accounting and bookkeeping, Industry solutions, Automation, Reports and analytics, Partner services), BANKS (Banks and payments Ukraine, European banks, Offers from banks, Cryptocurrency), COLLECTIONS (1C and BAS replacement, For HoReCa, For retail); банери «For retail», «Add your integration»; секції Popular, 1C/BAS replacement, Bank offers. Картка: лого, назва, опис, бейдж «SOON». Повний перелік — розділ 7. Дані — статичні у фронтенді (окремих API-запитів не було).

### 2.12 Мультикомпанія

- Шторка «Firmy»: пошук, «MOJE FIRMY» (символ валюти + назва + олівець лише для компаній, де користувач власник), «DEMO — Firma demonstracyjna (demo)», «Dodać firmę». Перемикання компанії = `PATCH /user/profile {currentCompanyId}`.
- **«Nowa firma»**: Nazwa, **Waluta główna**, «Pole działania» (довідник `GET /common/companyActivities`: Budownictwo i nieruchomości, Produkcja, Handel/e-commerce, Logistyka, IT, Usługi eksperckie, Edukacja, Uroda i zdrowie, Medycyna, HoReCa, NGO, Usługi domowe, MilTech, Inne), «Dodaj dane demo: Demo categories / Demo projects / Demo tags».
- **«Edycja firmy»**: Change Logo, Nazwa, Company description, Waluta główna (**disabled — незмінна**), «Zapisać zmiany», «Usunąć firmę».
- Дані користувача й компанії: кожен запит виконується в контексті `currentCompanyId` профілю (без companyId в URL).

### 2.13 Інші глобальні елементи

- **Effectiveness (N/5)** — шторка «Effectiveness of using your Finmap — based on settings, we do not analyze finances»: чекліст SETTINGS (Transaction Actions, Auto Rules, P&L Report, Users, Integrations; кожен з «Go»), «PLAN: <tariff>» з прогрес-барами використання (Transactions per month, Bank integrations, Crypto integrations, Auto rules, Users), CTA консалтингу «Free screening». Джерело — `GET /subscriptions/health` (`[{key, done}]`) + `/subscriptions/used`.
- **Referral**: модалка «Dodajemy +3 miesiące do Twojego planu» — реф-посилання, шаринг (Telegram/WhatsApp/Viber), запрошення email; «Ambassador Club — Your next month can be free». API `/companies/referalToken`, `/common/sendReferalMail`, `/companies/closedReferal`.
- **Telegram-bot** (меню профілю): «Krok 1 — link do bota; Krok 2 — osobisty klucz TG; Wygeneruj nowy klucz TG».
- **Мова** (меню профілю): PL/EN/UK/ES/FR/PT/IT/CS/TR/KK/UZ/RU/pt-BR (частина за флагами).
- **Wsparcie** toggle у меню профілю (доступ підтримки до акаунта), «Wyjść» (logout).

### 2.14 Налаштування (`/settings/*`)

Ліве меню: *Profil, Security, Moje firmy, Konfiguracja i wdrożenie* | *<COMPANY>: Plany, Subskrypcja, Reguły automatyczne, Kontrahenci, Konta, Kategorie, Projekty, Tagi, Użytkownicy, Stanowiska użytkowników, Stałe kursy walut, Company Backup* | *FAKTURY: Moje szczegóły, Dane klientów, Dobra* | *DLA PROGRAMISTÓW: API, Webhook* | *USTAWIENIA WIZUALNE: Konfiguracja dziennika*.

| Сторінка | Вміст / поля | API |
|---|---|---|
| Profil | E-mail (RO), Telefon (RO), Język, «Zmienić hasło» (Stare/Nowe hasło), Zachować | `GET|PATCH /user/profile` |
| Security | «Your account is N% protected», «Password hasn't been changed in a long time → Change», 2FA: Email 2FA / Google Authenticator (toggle), Active Sessions (Device, Location, Last activity, Disable/Active; Refresh; Sign out all), Confirm Account Deletion | `/user/profile/email2FAStatus`, `/user/profile/totp-setup|confirm|disable`, `/user-sessions`, `/user-sessions/current`, `/auth/profile-deletion-code`, `DELETE /auth/profile` |
| Konfiguracja i wdrożenie | Finmap Consulting: Plan S «Financial control», Plan M «Financial efficiency» (Popular), Plan L «Finance for growth»; Order / Learn more | `/consulting/request` |
| Plany | Na miesiąc / Przez pół roku (−15%) / Przez rok (−20%) / Addony; валюта цін; картки тарифів; «Zobacz wszystkie opcje planów» (порівняльна таблиця) | `/tariffs`, `/tariffs/addons`, `/subscriptions/*` |
| Subskrypcja | «Ten okres rozliczeniowy» (діапазон, сума, дата наступного списання), «Dodatkowe użycie», «Pojemność w Twoim planie» (ліміт vs використано), таби Subskrypcja / Faktury / Szczegóły płatności | `/subscriptions/used`, `/paymentHistory`, `/paymentHistory/props`, `/subscriptions/invoiceLink`, `/subscriptions/switch/*` |
| Kontrahenci | Типи (ліва колонка): Inwestorzy, Kredytodawcy, Kredytobiorcy, Pracownicy, Właściciele, Rodzaje podatków (іконка «системні») + **Moi kontrahenci** (тултип: «należy do własnych kategorii dochodów i wydatków — klienci, dostawcy, pracownicy…»); пошук; «Dodać <тип>» → модалка лише з полем «Nazwa» (валідація дубля «Taki … już istnieje»); редагування/приховання/видалення | `/{entityType}` CRUD, `/suppliers/update/many` |
| Konta | Список рахунків (пошук, редагування, порядок, «Dodaj zmiany») | `/accounts…` |
| Kategorie | 4 секції: Kategorie dochodów systemowych, Kategorie wydatków systemowych, Kategorie moich dochodów, Kategorie moich wydatków; дерево 2 рівні (батьківська з «+» для підкатегорії), drag-сортування, «Zwiń wszystkie kategorie», пошук. Форми: «Utworzenie kategorii» / «Utwórz podkategorię» (лише Nazwa), «Edycja kategorii» (Nazwa, Ukryć, Usunąć, Zachować). Системні категорії не видаляються, тултипи (salary/tax/vat) | `/categories/{income|consumption}` CRUD + `update/many` |
| Projekty | Таби Projects / **Split templates**; «Dodaj projekt» (Nazwa); «Create template» → «New split template»: назва + рядки (Project, %) + «Add project» | `/projects…`, `/project-distribution-templates` |
| Tagi | «Dodać tag» (Nazwa), пошук, пагінація | `/tags`, `/tagsWithPagination` |
| Stałe kursy walut | Toggle **«Apply historical rates to operations»** (тултип: для різновалютних операцій береться курс на дату операції; ручний курс має пріоритет над провайдером), «Dodaj swój kurs» → «Twój kurs»: валюта A, валюта B, «Kurs B / A», Dodać | `/common/currencyExchangeRates/custom…`, `PATCH /companies/{id}/use-historical-rates-for-operations`, `…/currencyRateProvider` |
| Company Backup | Опис, статус «disabled», «Enable Backup», «Backup history» | `GET|PATCH /backups/status` (`{lastAt, nextAt, type: monthly, status}`), `/backups/list` |
| Moje szczegóły / Dane klientów | «Dodaj szczegóły» → «Nowe moje dane / Nowe dane klienta»: Nazwa (firmy), textarea (NIP, Numer konta, Numer telefonu, Adres) | `/operations/income/invoices/props?isMy` |
| Dobra | «Dodaj produkt/usługę»: Nazwa produktu/usługi, Cena | `/operations/income/invoices/goods` |
| API | «Twoje klucze API», «Dodaj klucz API» → Nazwa + «Generuj klucz»; «Dokumentacja API» | `/integration/apiKeys`, `/integration/companyApiKeys` |
| Webhook | «Twoje webhooki», «Dodaj Webhooka» → Webhook URL, Nazwa Webhooka; «Dokumentacja» | `/webhooks` |
| Konfiguracja dziennika | колонки журналу (див. 2.1) | `PATCH /user/profile {customization}` |
| Asystent Finmapa (`/settings/ai`) | один toggle | `/ml/status` |

### 2.15 Спостережувані бізнес-правила (зведено)

1. **Дві дати в кожній операції.** `date` — коли гроші реально рухались (Cash flow, баланси, календар). `dateOfPayment` — дата угоди/продажу/послуги (P&L, Projects, Financial performance, Plan/Actual у режимі P&L — усі з `useDateOfPayment=true`). За замовчуванням однакові; «Data transakcji jest inna» розводить їх. Додатково є **період угоди** (`consumptionPeriodStart/End`, «Change the deal period» / «Okres księgowania od/do») — розподіл витрати на період; для зарплати — «Pensja za <місяць>», для податків — «Za <місяць>».
2. **Факт vs план.** `approved=true` — факт; майбутні/неоплачені операції `approved=false` («notApproved» серії у звітах, заштриховані стовпці, пунктирне сальдо). Регулярні платежі генерують майбутні екземпляри (`scheduled=true`); прогнози з банку/AI (`predictions`) можна обʼєднати з фактом (`combine/predication/future`) або погасити (`payOffFuture`). Перемикач «Rozważ przyszłość / Z wyłączeniem przyszłości» є в усіх звітах; у сайдбарі — горизонт 1 міс./6 міс./усе й «Razem na kontach z uwzględnieniem przyszłych płatności». Є флаг «cash gap» (касовий розрив) у календарі.
3. **Баланс рахунку** = `startingBalance` + Σ фактичних операцій (доходи +, витрати −, перекази ±). Зміна початкового балансу логуються окремо («Początkowy bilans» в історії). Приховані рахунки виключаються з «Razem na kontach» і можуть бути виключені зі звітів (рядок «Accounts excluded from the report»).
4. **Три валюти.** Валюта рахунку (`sum`), валюта платежу (`transactionSum/Currency/Rate`, якщо відрізняється), базова валюта компанії (`companyCurrencySum`). Базова валюта компанії незмінна після створення. Курси — від обраного провайдера (Default/NBP/Mastercard/CNB/NBK/PayPal/Crypto) або ручні; «Apply historical rates to operations» — використовувати курс на дату операції. Курсові різниці та перекази окремо реконсилюються в Cash flow («Wahania kursów walut i transfery»: Starting balances, Transfers, Excluded accounts, Exchange rate difference, Reconciliation).
5. **Перекази** не є доходом/витратою: на рівні компанії дають 0, у P&L не потрапляють; між валютами — дві суми + курс. Будь-яку операцію можна перетворити на переказ («Zmień na przeniesienie») або злити дві операції в переказ.
6. **Тип контрагента визначається системною категорією** (таблиця 2.2.4). Це дає автоматичні звіти: інвестиції (investors), позики видані/отримані (borrowers/creditors), дивіденди (owners), зарплата (staffMembers), податки (taxOrganisations), постачальники/клієнти.
7. **P&L = управлінський прибуток**: виключає системні доходи (інвестиції, позики, повернення позик) і витрати «дивіденди / видача позики / повернення позики»; включає зарплату, податки, ПДВ. «Bez kategorii» показується окремим рядком.
8. **Дебіторка/кредиторка** виникають, коли дата угоди настала, а грошова дата в майбутньому (неоплачено), з групуванням за типом контрагента; взаємозалік для контрагентів-«двосторонніх» (`clientsMutual`).
9. **Власний капітал у Balance** — залишкова величина (активи − зобовʼязання − ручні статті капіталу); інвестиції інвесторів — окремі зобовʼязання/капітал за типом контрагента; ручні статті (ОЗ, НМА, резерви, статутний/додатковий капітал) вводяться користувачем.
10. **Спліт**: операцію можна розділити між проєктами (частка `stake`, % або сума) і між категоріями (beta) з контролем «Pozostawiony do rozdzielenia» = 0; є шаблони спліту по проєктах.
11. **Аудит і undo**: кожна зміна операції зберігає `oldState/newState`, автора (користувач / автоправило / API-ключ / інтеграція) і може бути відкочена поштучно або масово; імпорт можна відкотити цілком.
12. **Автоправила** виконуються у визначеному порядку (orderIndex), мають тип (дохід/витрата), умови з AND/OR і кілька дій; ліміт кількості — тарифний.
13. **Закриті періоди** на рівні ролі (окремо по грошовій і по accrual-даті) блокують редагування.
14. **Ліміт транзакцій** рахується помісячно (`transactionsPeriodFrom`); перевищення/неоплата блокують доступ (402).
15. **Мультикомпанійність**: користувач може бути власником кількох компаній і співробітником в інших; дані повністю ізольовані по `currentCompanyId`; налаштування колонок журналу можна «застосувати до всіх фірм»; є демо-компанія для навчання.

---

## 3. Модель даних

> Типи: `id` = ObjectId (24 hex, MongoDB), `ts` = epoch ms, `date` = ISO-рядок. Майже всі довідникові сутності мають спільний «довідниковий» набір полів: `_id, companyId, createdBy, label, normalizedLabel, orderIndex, visible, archived, systemValue, demoValue?, createdAt, updatedAt`.

### 3.1 Сутності

**User (профіль)** — `_id, email, phone, name, avatarUrl, currentLangIso, currentCompanyId, currentCompanyCurrencyId, currentCompanyCurrencySymbol, country, messenger, futurePaymentsTotalMonths (горизонт віджета), customization (JSON-рядок налаштувань журналу), termsOfService:bool, onboardingCompleted:bool, demo:bool, last_login_date, lastCountryUpdate:ts, createdAt`; 2FA: email2FA, TOTP. Токен сесії повертається разом із профілем.

**Company** — `_id, createdBy, name, description, logo, currencyId (базова, незмінна), activityId → CompanyActivity, demo:bool, orderIndex, roleId (роль поточного користувача), fastPermissionIds[], tariffId → Tariff, tariffPeriod (міс.), tariffEndDate, tariffPaidUpTo, tariffUnpaid, stripePastDue, canceledScheduled, addons[], closedReferal, accountNeedConfirm:bool, useHistoricalRatesForOperations:bool, currencyRateProviderId, employeesCount, balance`.

**Account** — `_id, companyId, name, normalizedLabel, orderIndex, currencyId, currency{code, symbol, name, label}, visible (Ukryć), crypto:bool, typeId, partnersId, startingBalance, balance (поточний), companyCurrencyBalance, integration?: Integration`.

**IntegrationType** — `_id, label (Privat24, Mono, PrivatForBusiness, Nordigen, ABankForBusiness, PumbForBusiness, Fondy, FondyV2, Hubstaff, WesternBid, Payoneer, Checkbox, Tinkoff, Poster, Fakturownia, Idoklad, Saltage, Ukrsib, Belvo, MonoAcquiring, MonoCorp, AbankV2, Zorion(Zerion), Uspacy, KeyCrm, Sitniks, Tron, CreditDnipro, Novapay, Ukrgaz, Hutko, Prom, WayForPay, BankOfGeorgiaBusiness), defaultLoopTimeCoefficient, unActiveLoopTimeCoefficient, publisherPattern, systemValue`.

**Integration** (привʼязка рахунку до провайдера) — `_id, companyId, typeId, integrationCredentialsId, accountId, externalAccountId, bankId, bankLabel, logoLink, startDate (з якої дати тягнути), incomeSubType, consumptionSubType (дефолтні підтипи для імпортованих операцій), loaderDone, loaderState, inProgress, lastSyncDate, expiredAt (згода банку), errorUpdatedAt, lastErrorStatus, emailSanded`.

**Operation** (ядро) — 
- ідентичність/тип: `_id, operationId, companyId, userId, type (income|consumption|transfer), subType (sale|generic|investment|loan|loanRepayment|supplier|tax|dividend|salary|…), fullType (<type>_<subType>)`;
- гроші: `sum, sumDouble, currencyId, currencySymbol, exchangeRate, companyCurrencySum, companyCurrencySumDouble, transactionSum, transactionCurrency, transactionCurrencyRate`;
- дати: `date (грошова дата), dateOfPayment (дата угоди/accrual), startOfDay, consumptionPeriodStartTimestamp/EndTimestamp (період угоди — «deal period»), salaryPeriodId/Start/End, taxPeriodId/Start/End, dateOfPaymentPeriodId, isCustomPeriodId`;
- рахунки: `accountFromId, accountFromName, accountToId?, accountToName, accountIds[], accountBalanceAfterOperation`;
- класифікація: `categoryV2Id (+ categoryId legacy), categoryName(+локалізації), categoriesIds[], categoryObjects[] (спліт), counterpartyId, counterpartyName, projectIds[], projects (рядок), projectObjects[{id, stake%/sum}], tagIds[], tags, comment, searchString`;
- статус: `approved:bool (факт vs план), scheduled:bool (згенеровано з регулярного), schedule*: scheduleInterval, scheduleIntervalType, scheduleDays, scheduleEndDate, scheduleMaxCount, schedulePeriodId, hasPrediction, predictionTypes[], archived, crudType`;
- походження: `integrationId, externalId, botId, executedRules[{ruleId, ruleName}], actionSources[], actorApiKeyId`;
- фактури/файли: `invoice:bool, confirmedInvoice:bool, goodsIds[], goods, attachments[]`;
- службові прапорці: `isPartial, hasPartial, isCategoryPartial, hasCategoryPartial, hasProjectSumError, hasCategorySumError, hasDeletedProject, hasDeletedCategory, canEdit, canDelete`.

**OperationHistory** — `_id, companyId, operationId, userId, type, fullType, crudType (create|update|delete), date, oldState: Operation, newState: Operation, actionSources[] (rule|api|integration|user…), actorApiKeyId, actorIntegrationId, changedByRule, executedRules[], invoice, operationArchived, user{email}, employe{name}`.

**AccountHistory** — `accountId, crudType, prev{startingBalance, name}, current{startingBalance, name}, userId, changedAt`.

**Category** (дві колекції: income / consumption) — довідникові поля + `subcategories: Category[]` (2 рівні), `systemValue` (системна), тип: `systemIncome | systemConsumption | myIncome | myConsumption`.

**Counterparty** — окремі колекції за типом: `clients, suppliers, creditors, borrowers, investors, owners, staffMembers, taxOrganisations` (+ узагальнені `counterparties`); поля довідника (`label` = назва). Деякі колекції мають системні записи (`systemValue`). Контрагент може мати «підконтрагента» (`subcounterparty` в експорті).

**Project** — довідник + `archived` (Active/Archived), вкладені підпроєкти (`subproject`, флаг `ProjectsPieSubprojects`).

**ProjectDistributionTemplate (Split template)** — `name, items[{projectId, percent}]`.

**Tag** — довідник.

**Rule** — див. 2.10.

**Role** — `_id, label, systemValue, visible, archived, orderIndex, fastPermissions[id]`.
**Permission** — `roleId, context (log|operation|settings|employees|analytic|calendar|invoicing|futurePayments|accountsVisibility|closePeriod|aiAdvisor), resources[{resourceId → Resource, typeIds[] → PermissionType, items[] (конкретні id сутностей)}], typeIds[]`.
**PermissionType** — `kind (read|edit), value (get|post|put|patch|delete)`.
**Resource** — `label` = REST-ресурс (`accounts`, `projects`, `operations/consumption/salary`, `analytics/cash`, …).
**PermissionPeriod** — закритий період для ролі (by payment date / by accrual date).
**Employee** — `_id, userId, roleId, role, email, name, createdAt`. **Invite** — `roleId, name, email`.

**Invoice** (= income-операція з `invoice:true`) + `number, issueDate, saleDate, currency, sellerPropsId, buyerPropsId, vat:bool/rate, items[{goodsId, name, qty, price, amount}], discount{type: amount|percent, value}, delivery, total, notes, logo, files, status`.
**InvoiceProps** — `name, details (NIP/рахунок/телефон/адреса), isMy`. **Goods** — `name, price`. **VatSettings** — `defaultVat`.

**PlanActualItem** — `entityType (category|project), reportType (cash|pnl), month, side (income|consumption), categoryId|projectId, amount`.
**FinancialPerformanceEntity** — `reportType (GrossProfit|ContributionMargin|EBITDA|Margin), categoryType, categoryId`; **CustomIndicator** — `name, method (cash|accrual), breakdown (categories|counterparties|projects), a{side, ids}, operator, b{side, ids}, percent:bool`.
**RemunerationSheet** — відомість (CRUD + history; структура не побачена через відсутність доступу).

**SavedFilter** (`/filter`) — `name, query`. **ExportTemplate** — набір колонок/групування/аркушів.
**Webhook** — `name, url`. **ApiKey** — `name, value, createdBy`. **CompanyApiKey** — `name`.
**Tariff** — `code, label (Trial, Lite, Pro, Advanced, Starter, Boss, LiteV2, ProV2…), price1m, price12m, orderIndex, visible`. **Addon** — `code, codeV2, name, type, payType (oneTime|onOff|recurentWithQuantity), count, price, price1m/6m/12m, currency`.
**SubscriptionUsage** — `transactions, transactionsPeriodFrom, rules, roles, employees, cryptoIntegrations, bankIntegrations, imports`. **Health** — `[{key, done}]`.
**UserSession** — `sessionId, createdAt, lastActiveAt, device, clientType, location, isCurrent`. **Backup** — `lastAt, nextAt, type, status`.
**CurrencyRate** — `from, to, rate, createdAt`; **CurrencyRateProvider** — `label (Default, PayPal, Custom, NBPPoland, Mastercard, CNBCzech, NBKKazakhstan, Cryptocurrency)`; **CustomRate**.
**FuturePaymentsSummary** — `[{sum, type, subType, categoryId, sequence}]`.
**CalendarDay**, **CashTableRow** — див. 2.5/2.7.
**AiUsage** — `used, limit, isUnlimited`; **AnomalyBanner**; **AiOnboardingSession** — `status, state, chatHistory[{role, text, timestamp}], countryCode, niche, enabled …`.
**ImportParser**, **ImportHistory**, **CompanyActivity**, **ScheduledPeriod** (`/common/schedulePeriods`).

### 3.2 Звʼязки (ER)

- User **N:M** Company через Employee(roleId) — власник = `Company.createdBy`; `User.currentCompanyId` → активна компанія.
- Company **1:N** Account, Category, Counterparty(*всі типи*), Project, Tag, Rule, Role, Webhook, CompanyApiKey, Integration, SavedFilter, PlanActualItem, InvoiceProps, Goods.
- Account **1:0..1** Integration **N:1** IntegrationType.
- Operation **N:1** Account (`accountFromId`), **N:0..1** Account (`accountToId`, для transfer), **N:0..1** Category (`categoryV2Id`) або **N:M** Category через `categoryObjects` (спліт), **N:0..1** Counterparty (`counterpartyId`; колекція визначається `subType`), **N:M** Project через `projectObjects{stake}`, **N:M** Tag, **N:0..1** Integration, **N:M** Rule (`executedRules`), **N:M** Goods (фактура).
- Operation **1:N** OperationHistory; Account **1:N** AccountHistory.
- Operation(шаблон регулярності) **1:N** Operation(`scheduled=true`, майбутні екземпляри).
- Role **1:N** Permission **N:1** Resource; Permission **N:M** PermissionType; Role **1:N** PermissionPeriod.
- Company **N:1** Tariff; Company **N:M** Addon.
- ProjectDistributionTemplate **N:M** Project.

### 3.3 Enum-и (з бандла і API)

- `OperationType`: `income, consumption, transfer`.
- `IncomeSubType`: `sale, investment, loanRepayment, loan, generic` → fullType `income_*`.
- `ConsumptionSubType`: `loanRepayment, loan, supplier, tax, dividend, salary, generic` → `consumption_*`.
- `CounterpartyType`: `clients, investors, creditors, borrowers, staffMembers, owners, suppliers, taxOrganisations` (+ `counterparties`).
- `CategoryKind`: `systemIncome, systemConsumption, myIncome, myConsumption`.
- `PeriodPreset`: `currentYear, prevYear, currentWeek, prevWeek, currentMonth, prevMonth, allTime` (+ custom, quarterly).
- `ReportPeriodFilter`: `month, quarter`; `CashFlowMode`: `CashFlow, PandL`; `PlanActualTab`: `PlanActual, History`; `FPMetric`: `EBITDA, Margin, ContributionMargin, GrossProfit`; `PercentMode`: `withPercent, withoutPercent`; `DebtDate`: `nowadays, yesterday, endLastMonth, chooseDate`.
- `DebitKeys`: `borrowersDebit, investorsDebit, clientsDebit, clientsMutual`; `CreditKeys`: `creditorsCredit, suppliersCredit, taxOrganisationsCredit, ownersCredit, counterpartiesCredit, staffMembersCredit, clientsMutual`.
- `PaymentStatus` (фактури/майбутні): `overdue, payed, notPayed, all`; `Payed`: `payed, future`.
- `RecurrenceEnd`: `never, end, date, after`; `RecurrenceUnit`: day/week/month/year.
- `RuleOperator`: `IN, NIN, EQ, NEQ`; `RuleLogic`: `AND, OR`; `RuleConditionField`: `comment, account` / `comment, accountFromId, accountToId, type`; `RuleActionEntity`: див. 2.10.
- `PermissionKind`: `read, edit` (+ `delete`, `full` у UI); `PermissionContext`: `log, operation, settings, employees, analytic, calendar, invoicing, futurePayments, accountsVisibility, closePeriod, aiAdvisor`; `PermissionScopes (UI-рядки)`: `accounts, projects, tags, clients, investors, borrowers, creditors, staffMembers, suppliers, owners, counterparties, taxOrganisations`.
- `CrudType`: `create, update, delete`.
- `ExportFormat`: `.csv, .xls, .xlsx, .pdf`; `ExportGrouping`: none/projects/categories/project→category; `ExportSheets`: single/by month; `ExportOps`: all/actual/planned.
- `ImportParserType`: `services, ukraineImports, polandImports, kazakhstanImports, uzbekistanImports, brazilImports, otherCountriesImports`.
- `TariffFeature` (ключі лімітів): `transactions, bankIntegrations, cryptoIntegrations, employees, autoRules, support, imports, telegram, mobileApps, analyticsCash, analyticsPL, analyticsBalance, analyticsProjects, analyticsCalendar, analyticsDebCred, analyticsPlanFact, analyticsFinancialPerformance, customRights, TwoFA, api, partnership`.
- `AddonType`: `integrationsWithBanks, integrationsWithPartners, financialExpertConsultation, trialExtention, dedicatedSupport, extraEmployee, extraOperations, extraAutoRules, extraCalendar, extraPL, extraDebCred, extraFinancialPerformance, extraPlanActual, extraTransactionsOneTime, extraAiRequests, extraRateLimits`; `AddonPayType`: `oneTime, onOff, recurentWithQuantity`.
- `SupportLevel`: `onlyAI, humanChats, supportVoiceCall, seniorSupport, dedicatedSenior`.
- `HealthKey` (Effectiveness): transactions/actions, rules, P&L, employees, integrations.
- `IntegrationSyncState`: `NORMAL, DELAYED, PROBLEM`; `ImportState`: `confirmed, not found, in process, completed`.
- `Language`: en, pl, uk(ua), ru, es, fr, pt, pt-BR, it, cs(cz), tr, kk, uz.

---

## 4. API inventory

**Загальне:** base `https://my.finmap.online/v2/`; JSON; авторизація — **заголовок `Authorization: Bearer <token>`** (токен зберігається в `localStorage["finmap-user"]` і повертається з `/login`, `/user/authByToken`, `PATCH /user/profile`), плюс `Accept-Language`; XHR з `withCredentials=true`. Контекст компанії — неявний (з `user.currentCompanyId` на сервері), а не в URL. 401 на `/used|/analytics|/log|/permissionPeriods` → очищення сесії і редірект на `/auth/login`; 402/403 → редірект на логін (тарифні/доступові блокування). Списки журналу/аналітики — **POST з тілом `{query: "<querystring>"}`** (обхід довжини URL). Часовий пояс — `?offset=<ms>` у create/update. Feature flags — Unleash (`/features/proxy`, appName `finmap`, контекст userId + companyId). Ідентифікатори — Mongo ObjectId.

Позначення джерела: **observed** — метод реально спостерігався в мережі під час сесії (лише GET/безпечні POST-запити читання, ініційовані застосунком або мною); **bundle-only** — знайдено лише в JS-бандлі (write-флоу, не виконувались). `:p` — параметр шляху. Усього **351** унікальних рядків (шлях+методи), з них **120** шляхів підтверджено спостереженням (137 з урахуванням варіантів query).

| Метод | Шлях (`/v2` префікс) | Призначення | Джерело |
|---|---|---|---|
| GET, POST | `/:p` | універсальний CRUD довідників /{entityType} | bundle-only: GET,POST |
| PATCH, DELETE | `/:p/:p` | універсальний CRUD довідників /{entityType} | bundle-only: DELETE,PATCH |
| POST | `/access-request` | запит доступу у власника | bundle-only: POST |
| GET | `/access-request/owner` | запит доступу у власника | observed: GET |
| GET, POST | `/accounts` | рахунки (CRUD, масове оновлення, виписка) | observed: GET; bundle-only: POST |
| PATCH, DELETE | `/accounts/:p` | рахунки (CRUD, масове оновлення, виписка) | bundle-only: DELETE,PATCH |
| GET | `/accounts/:p/statement` | рахунки (CRUD, масове оновлення, виписка) | observed: GET |
| PATCH | `/accounts/update/many` | рахунки (CRUD, масове оновлення, виписка) | bundle-only: PATCH |
| GET | `/advancedSettings/companies` | розширений список компаній (тариф/баланс) | observed: GET |
| GET | `/ai/agent/conversations` | AI Advisor / агент / аномалії / ліміти | observed: GET |
| POST | `/ai/agent/execute-action` | AI Advisor / агент / аномалії / ліміти | bundle-only: POST |
| POST | `/ai/agent/feedback` | AI Advisor / агент / аномалії / ліміти | bundle-only: POST |
| GET | `/ai/agent/history` | AI Advisor / агент / аномалії / ліміти | observed: GET |
| POST | `/ai/agent/log-note` | AI Advisor / агент / аномалії / ліміти | bundle-only: POST |
| GET | `/ai/anomaly/banner` | AI Advisor / агент / аномалії / ліміти | observed: GET |
| POST | `/ai/anomaly/detect` | AI Advisor / агент / аномалії / ліміти | bundle-only: POST |
| GET | `/ai/anomaly/history` | AI Advisor / агент / аномалії / ліміти | observed: GET |
| POST | `/ai/anomaly/payments` | AI Advisor / агент / аномалії / ліміти | bundle-only: POST |
| POST | `/ai/import` | AI Advisor / агент / аномалії / ліміти | bundle-only: POST |
| POST | `/ai/onboarding-chat` | AI Advisor / агент / аномалії / ліміти | bundle-only: POST |
| GET | `/ai/operations/uncategorized-summary` | AI Advisor / агент / аномалії / ліміти | observed: GET |
| GET | `/ai/pdf/:p` | AI Advisor / агент / аномалії / ліміти | bundle-only: GET |
| GET, POST | `/ai/quick-queries` | AI Advisor / агент / аномалії / ліміти | observed: GET; bundle-only: POST |
| PATCH, DELETE | `/ai/quick-queries/:p` | AI Advisor / агент / аномалії / ліміти | bundle-only: DELETE,PATCH |
| GET | `/ai/reports` | AI Advisor / агент / аномалії / ліміти | observed: GET |
| GET | `/ai/tariff-limits` | AI Advisor / агент / аномалії / ліміти | observed: GET |
| GET | `/ai/usage` | AI Advisor / агент / аномалії / ліміти | observed: GET |
| POST | `/analytics/:p/:p/:p/:p` | Cash flow / P&L: main, table, кругові/стовпчасті розрізи | bundle-only: POST |
| POST | `/analytics/:p/companies/charts/:p` | Cash flow / P&L: main, table, кругові/стовпчасті розрізи | bundle-only: POST |
| POST | `/analytics/:p/companies/circles/:p` | Cash flow / P&L: main, table, кругові/стовпчасті розрізи | bundle-only: POST |
| POST | `/analytics/:p/main` | Cash flow / P&L: main, table, кругові/стовпчасті розрізи | bundle-only: POST |
| POST | `/analytics/:p/table` | Cash flow / P&L: main, table, кругові/стовпчасті розрізи | bundle-only: POST |
| POST | `/analytics/calendar` | календар (денні суми/баланс; AI-коментар) | observed: POST |
| GET | `/analytics/calendar/ai` | календар (денні суми/баланс; AI-коментар) | bundle-only: GET |
| POST | `/analytics/cash/categories/charts/consumption` | Cash flow / P&L: main, table, кругові/стовпчасті розрізи | observed: POST |
| POST | `/analytics/cash/categories/charts/income` | Cash flow / P&L: main, table, кругові/стовпчасті розрізи | observed: POST |
| POST | `/analytics/cash/categories/circles/consumption` | Cash flow / P&L: main, table, кругові/стовпчасті розрізи | observed: POST |
| POST | `/analytics/cash/categories/circles/income` | Cash flow / P&L: main, table, кругові/стовпчасті розрізи | observed: POST |
| POST | `/analytics/cash/main` | Cash flow / P&L: main, table, кругові/стовпчасті розрізи | observed: POST |
| GET, POST | `/analytics/credit` | дебіторка/кредиторка (+історія) | observed: POST; bundle-only: GET |
| GET | `/analytics/credit/history` | дебіторка/кредиторка (+історія) | bundle-only: GET |
| GET | `/analytics/custom/available` | кастомні звіти (шаблони) | observed: GET |
| GET | `/analytics/custom/template/:p` | кастомні звіти (шаблони) | bundle-only: GET |
| GET, POST | `/analytics/debit` | дебіторка/кредиторка (+історія) | observed: POST; bundle-only: GET |
| GET | `/analytics/debit/history` | дебіторка/кредиторка (+історія) | bundle-only: GET |
| GET | `/analytics/financialPerformance` | Financial performance (метрики, кастомні індикатори, історія) | observed: GET |
| POST | `/analytics/financialPerformance/:p` | Financial performance (метрики, кастомні індикатори, історія) | bundle-only: POST |
| GET, POST | `/analytics/financialPerformance/custom` | Financial performance (метрики, кастомні індикатори, історія) | observed: GET; bundle-only: POST |
| PATCH, DELETE | `/analytics/financialPerformance/custom/:p` | Financial performance (метрики, кастомні індикатори, історія) | bundle-only: DELETE,PATCH |
| POST | `/analytics/financialPerformance/custom/preview` | Financial performance (метрики, кастомні індикатори, історія) | bundle-only: POST |
| GET | `/analytics/financialPerformance/custom/report` | Financial performance (метрики, кастомні індикатори, історія) | observed: GET |
| GET | `/analytics/financialPerformance/entities` | Financial performance (метрики, кастомні індикатори, історія) | observed: GET |
| GET | `/analytics/financialPerformance/history` | Financial performance (метрики, кастомні індикатори, історія) | observed: GET |
| GET, POST | `/analytics/planActual` | План/Факт (бюджети, історія) | observed: GET; bundle-only: POST |
| PATCH, DELETE | `/analytics/planActual/:p` | План/Факт (бюджети, історія) | bundle-only: DELETE,PATCH |
| GET | `/analytics/planActual/history` | План/Факт (бюджети, історія) | observed: GET |
| POST | `/analytics/profitAndLoss/categories/charts/consumption` | Cash flow / P&L: main, table, кругові/стовпчасті розрізи | observed: POST |
| POST | `/analytics/profitAndLoss/categories/charts/income` | Cash flow / P&L: main, table, кругові/стовпчасті розрізи | observed: POST |
| POST | `/analytics/profitAndLoss/categories/circles/consumption` | Cash flow / P&L: main, table, кругові/стовпчасті розрізи | observed: POST |
| POST | `/analytics/profitAndLoss/categories/circles/income` | Cash flow / P&L: main, table, кругові/стовпчасті розрізи | observed: POST |
| POST | `/analytics/profitAndLoss/main` | Cash flow / P&L: main, table, кругові/стовпчасті розрізи | observed: POST |
| POST | `/analytics/projects` | звіт по проєктах | observed: POST |
| GET | `/analytics/remuneration-report/month` | звіт по оплаті праці | observed: GET |
| GET | `/analytics/remuneration-report/month/projects` | звіт по оплаті праці | bundle-only: GET |
| GET | `/analytics/remuneration-report/year` | звіт по оплаті праці | bundle-only: GET |
| GET | `/analytics/vat/table` | ПДВ-таблиця | observed: GET |
| DELETE | `/auth/profile` | видалення профілю | bundle-only: DELETE |
| POST | `/auth/profile-deletion-code` | видалення профілю | bundle-only: POST |
| GET | `/backups/list` | резервні копії компанії | observed: GET |
| GET | `/backups/list/:p` | резервні копії компанії | bundle-only: GET |
| GET, PATCH | `/backups/status` | резервні копії компанії | observed: GET; bundle-only: PATCH |
| GET | `/borrowers` | контрагенти певного типу | observed: GET |
| GET, POST | `/categories/consumption` | категорії доходів/витрат (CRUD, масове оновлення) | observed: GET; bundle-only: POST |
| PATCH, DELETE | `/categories/consumption/:p` | категорії доходів/витрат (CRUD, масове оновлення) | bundle-only: DELETE,PATCH |
| PATCH | `/categories/consumption/update/many` | категорії доходів/витрат (CRUD, масове оновлення) | bundle-only: PATCH |
| GET, POST | `/categories/income` | категорії доходів/витрат (CRUD, масове оновлення) | observed: GET; bundle-only: POST |
| PATCH, DELETE | `/categories/income/:p` | категорії доходів/витрат (CRUD, масове оновлення) | bundle-only: DELETE,PATCH |
| PATCH | `/categories/income/update/many` | категорії доходів/витрат (CRUD, масове оновлення) | bundle-only: PATCH |
| POST | `/category-suggestions/:p/accept` | AI-підказки категорій (прийняти/відхилити/відкотити) | bundle-only: POST |
| POST | `/category-suggestions/:p/decline` | AI-підказки категорій (прийняти/відхилити/відкотити) | bundle-only: POST |
| POST | `/category-suggestions/:p/revert` | AI-підказки категорій (прийняти/відхилити/відкотити) | bundle-only: POST |
| GET | `/category-suggestions/current` | AI-підказки категорій (прийняти/відхилити/відкотити) | observed: GET |
| GET | `/clients` | контрагенти певного типу | observed: GET |
| POST | `/common/activity` | довідники/службові (валюти, крипто, періоди, час, версія, події) | bundle-only: POST |
| GET | `/common/companyActivities` | довідники/службові (валюти, крипто, періоди, час, версія, події) | observed: GET |
| GET | `/common/cryptocurrencies` | довідники/службові (валюти, крипто, періоди, час, версія, події) | observed: GET |
| GET | `/common/currencies` | довідники/службові (валюти, крипто, періоди, час, версія, події) | observed: GET |
| GET | `/common/currencyExchangeRates/:p/:p` | курси валют, провайдери курсів, власні курси | observed: GET |
| GET | `/common/currencyExchangeRates/currencyRateProvider` | курси валют, провайдери курсів, власні курси | observed: GET |
| PATCH | `/common/currencyExchangeRates/currencyRateProvider/:p` | курси валют, провайдери курсів, власні курси | bundle-only: PATCH |
| GET | `/common/currencyExchangeRates/currencyRateProvider/all` | курси валют, провайдери курсів, власні курси | observed: GET |
| POST | `/common/currencyExchangeRates/custom` | курси валют, провайдери курсів, власні курси | bundle-only: POST |
| DELETE | `/common/currencyExchangeRates/custom/:p/:p` | курси валют, провайдери курсів, власні курси | bundle-only: DELETE |
| GET | `/common/currencyExchangeRates/custom/all` | курси валют, провайдери курсів, власні курси | observed: GET |
| GET | `/common/currencyExchangeRates/paypal/:p` | курси валют, провайдери курсів, власні курси | bundle-only: GET |
| POST | `/common/event` | довідники/службові (валюти, крипто, періоди, час, версія, події) | observed: POST |
| POST | `/common/event-unatorized` | довідники/службові (валюти, крипто, періоди, час, версія, події) | bundle-only: POST |
| POST | `/common/linkStatus` | довідники/службові (валюти, крипто, періоди, час, версія, події) | bundle-only: POST |
| GET | `/common/schedulePeriods` | довідники/службові (валюти, крипто, періоди, час, версія, події) | observed: GET |
| POST | `/common/sendReferalMail` | довідники/службові (валюти, крипто, періоди, час, версія, події) | bundle-only: POST |
| GET | `/common/time` | довідники/службові (валюти, крипто, періоди, час, версія, події) | observed: GET |
| GET | `/common/userActivities` | довідники/службові (валюти, крипто, періоди, час, версія, події) | bundle-only: GET |
| GET | `/common/version` | довідники/службові (валюти, крипто, періоди, час, версія, події) | observed: GET |
| GET, POST | `/companies` | компанії (CRUD, демо-дані, налаштування) | observed: GET; bundle-only: POST |
| PATCH, DELETE | `/companies/:p` | компанії (CRUD, демо-дані, налаштування) | bundle-only: DELETE,PATCH |
| PATCH | `/companies/:p/account-need-confirm` | компанії (CRUD, демо-дані, налаштування) | bundle-only: PATCH |
| PATCH | `/companies/:p/use-historical-rates-for-operations` | компанії (CRUD, демо-дані, налаштування) | bundle-only: PATCH |
| POST | `/companies/cleanupDemoData` | компанії (CRUD, демо-дані, налаштування) | bundle-only: POST |
| POST | `/companies/closedReferal` | компанії (CRUD, демо-дані, налаштування) | observed: POST |
| GET | `/companies/referalToken` | компанії (CRUD, демо-дані, налаштування) | observed: GET |
| POST | `/consulting/request` | заявка на консалтинг | bundle-only: POST |
| GET | `/creditors` | контрагенти певного типу | observed: GET |
| GET | `/employees` | користувачі компанії | observed: GET |
| PATCH, DELETE | `/employees/:p` | користувачі компанії | bundle-only: DELETE,PATCH |
| PATCH | `/employees/mutual-settlements` | користувачі компанії | bundle-only: PATCH |
| GET | `/export-templates` | шаблони Build Excel | observed: GET |
| GET | `/fastPermissions` | шаблони "швидких" прав | observed: GET |
| GET, POST, PATCH, DELETE | `/fastPermissions/:p` | шаблони "швидких" прав | bundle-only: DELETE,GET,PATCH,POST |
| GET | `/features/proxy` | feature flags (Unleash proxy) | observed: GET |
| POST | `/features/proxy/client/metrics` | feature flags (Unleash proxy) | observed: POST |
| GET, POST | `/filter` | збережені фільтри | observed: GET; bundle-only: POST |
| PATCH, DELETE | `/filter/:p` | збережені фільтри | bundle-only: DELETE,PATCH |
| GET | `/futurePayments` | майбутні платежі (віджет сайдбару) | observed: GET |
| GET | `/futurePayments/byPeriod` | майбутні платежі (віджет сайдбару) | observed: GET |
| GET, POST | `/importParsers` | імпорт виписок (парсери, історія, колонки) | observed: GET; bundle-only: POST |
| POST | `/imports` | імпорт виписок (парсери, історія, колонки) | bundle-only: POST |
| GET | `/imports/export-columns` | імпорт виписок (парсери, історія, колонки) | observed: GET |
| GET | `/imports/history` | імпорт виписок (парсери, історія, колонки) | observed: GET |
| DELETE | `/imports/history/:p` | імпорт виписок (парсери, історія, колонки) | bundle-only: DELETE |
| GET, POST | `/integration/apiKeys` | API-ключі (користувача/компанії) | observed: GET; bundle-only: POST |
| DELETE | `/integration/apiKeys/:p` | API-ключі (користувача/компанії) | bundle-only: DELETE |
| GET, POST, PATCH | `/integration/companyApiKeys` | API-ключі (користувача/компанії) | observed: GET; bundle-only: PATCH,POST |
| DELETE | `/integration/companyApiKeys/:p` | API-ключі (користувача/компанії) | bundle-only: DELETE |
| GET | `/integrationTypes` | типи інтеграцій | observed: GET |
| GET, POST | `/integrations` | банківські/сервісні інтеграції | observed: GET; bundle-only: POST |
| DELETE | `/integrations/:p` | банківські/сервісні інтеграції | bundle-only: DELETE |
| GET | `/integrations/:p/history` | банківські/сервісні інтеграції | bundle-only: GET |
| GET | `/integrations/abankV2Credentials` | банківські/сервісні інтеграції | bundle-only: GET |
| DELETE | `/integrations/abankV2Credentials/:p` | банківські/сервісні інтеграції | bundle-only: DELETE |
| PATCH | `/integrations/abankV2Credentials/account` | банківські/сервісні інтеграції | bundle-only: PATCH |
| GET | `/integrations/abankV2Credentials/ping/:p` | банківські/сервісні інтеграції | bundle-only: GET |
| GET | `/integrations/abankV2Credentials/qr` | банківські/сервісні інтеграції | bundle-only: GET |
| POST, PATCH | `/integrations/belvoApiCredentials` | банківські/сервісні інтеграції | bundle-only: PATCH,POST |
| GET | `/integrations/belvoApiCredentials/accounts/:p` | банківські/сервісні інтеграції | bundle-only: GET |
| GET | `/integrations/belvoApiCredentials/banks/:p` | банківські/сервісні інтеграції | bundle-only: GET |
| PATCH | `/integrations/belvoApiCredentials/confirm` | банківські/сервісні інтеграції | bundle-only: PATCH |
| POST | `/integrations/belvoApiCredentials/getlink` | банківські/сервісні інтеграції | bundle-only: POST |
| PATCH | `/integrations/belvoApiCredentials/link` | банківські/сервісні інтеграції | bundle-only: PATCH |
| GET | `/integrations/belvoApiCredentials/status` | банківські/сервісні інтеграції | bundle-only: GET |
| POST | `/integrations/bogBusinessApiCredentials` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/checkboxApiCredentials` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/creditDniproCredentials` | банківські/сервісні інтеграції | bundle-only: POST |
| GET | `/integrations/disconnected` | банківські/сервісні інтеграції | observed: GET |
| GET, POST | `/integrations/dubidocCredentials` | банківські/сервісні інтеграції | bundle-only: GET,POST |
| DELETE | `/integrations/dubidocCredentials/:p` | банківські/сервісні інтеграції | bundle-only: DELETE |
| POST | `/integrations/fakturowniaApiCredentials/getAllSellers` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/fakturowniaApiCredentials/setTokenAndUserDomain` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/fondyApiCredentials` | банківські/сервісні інтеграції | bundle-only: POST |
| GET, POST | `/integrations/fondyApiCredentials/v2` | банківські/сервісні інтеграції | bundle-only: GET,POST |
| POST | `/integrations/hutko` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/idokladApiCredentials/getLink` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/idokladApiCredentials/setTokens` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/monoAcquiringApiCredentials` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/monoCorpApiCredentials` | банківські/сервісні інтеграції | bundle-only: POST |
| GET, POST | `/integrations/monoPersonalCredentials` | банківські/сервісні інтеграції | bundle-only: GET,POST |
| GET, PATCH, DELETE | `/integrations/monoPersonalCredentials/:p` | банківські/сервісні інтеграції | bundle-only: DELETE,GET,PATCH |
| GET | `/integrations/monoPersonalCredentials/:p/accounts` | банківські/сервісні інтеграції | bundle-only: GET |
| POST, PATCH | `/integrations/nordigenApiCredentials` | банківські/сервісні інтеграції | bundle-only: PATCH,POST |
| GET | `/integrations/nordigenApiCredentials/accounts/:p` | банківські/сервісні інтеграції | bundle-only: GET |
| GET | `/integrations/nordigenApiCredentials/allBanks` | банківські/сервісні інтеграції | observed: GET |
| GET | `/integrations/nordigenApiCredentials/banks/:p` | банківські/сервісні інтеграції | bundle-only: GET |
| PATCH | `/integrations/nordigenApiCredentials/confirm` | банківські/сервісні інтеграції | bundle-only: PATCH |
| GET | `/integrations/nordigenApiCredentials/status` | банківські/сервісні інтеграції | bundle-only: GET |
| GET, POST | `/integrations/novapayCredentials` | банківські/сервісні інтеграції | bundle-only: GET,POST |
| PATCH, DELETE | `/integrations/novapayCredentials/:p` | банківські/сервісні інтеграції | bundle-only: DELETE,PATCH |
| PATCH | `/integrations/novapayCredentials/:p/jwt` | банківські/сервісні інтеграції | bundle-only: PATCH |
| GET | `/integrations/novapayCredentials/accounts` | банківські/сервісні інтеграції | bundle-only: GET |
| GET | `/integrations/novapayCredentials/accounts/jwt` | банківські/сервісні інтеграції | bundle-only: GET |
| GET | `/integrations/novapayCredentials/clients` | банківські/сервісні інтеграції | bundle-only: GET |
| GET | `/integrations/novapayCredentials/clients/jwt` | банківські/сервісні інтеграції | bundle-only: GET |
| POST | `/integrations/novapayCredentials/jwt` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/novapayCredentials/login` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/novapayCredentials/loginJwt` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/novapayCredentials/prelogin` | банківські/сервісні інтеграції | bundle-only: POST |
| GET | `/integrations/novapayCredentials/status` | банківські/сервісні інтеграції | bundle-only: GET |
| GET, POST | `/integrations/partners` | банківські/сервісні інтеграції | observed: GET; bundle-only: POST |
| GET, POST, PATCH | `/integrations/payoneerCredentials` | банківські/сервісні інтеграції | bundle-only: GET,PATCH,POST |
| GET, POST, PATCH | `/integrations/posterApiCredentials` | банківські/сервісні інтеграції | bundle-only: GET,PATCH,POST |
| POST | `/integrations/privatForBusinessCredentials` | банківські/сервісні інтеграції | bundle-only: POST |
| PATCH | `/integrations/privatForBusinessCredentials/:p` | банківські/сервісні інтеграції | bundle-only: PATCH |
| POST | `/integrations/private24PersonalCredentials` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/promCredentials` | банківські/сервісні інтеграції | bundle-only: POST |
| POST, PATCH | `/integrations/pumbForBusinessApiCredentials` | банківські/сервісні інтеграції | bundle-only: PATCH,POST |
| POST, PATCH | `/integrations/saltageApiCredentials` | банківські/сервісні інтеграції | bundle-only: PATCH,POST |
| GET | `/integrations/saltageApiCredentials/accounts/:p` | банківські/сервісні інтеграції | bundle-only: GET |
| GET | `/integrations/saltageApiCredentials/banks/:p` | банківські/сервісні інтеграції | bundle-only: GET |
| PATCH | `/integrations/saltageApiCredentials/connection` | банківські/сервісні інтеграції | bundle-only: PATCH |
| POST | `/integrations/saltageApiCredentials/reconnect` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/saltageApiCredentials/update` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/tronCredentials` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/ukrgazCredentials` | банківські/сервісні інтеграції | bundle-only: POST |
| GET | `/integrations/ukrgazCredentials/:p/accounts` | банківські/сервісні інтеграції | bundle-only: GET |
| POST | `/integrations/ukrgazCredentials/:p/connect` | банківські/сервісні інтеграції | bundle-only: POST |
| POST, PATCH | `/integrations/ukrsibApiCredentials` | банківські/сервісні інтеграції | bundle-only: PATCH,POST |
| POST | `/integrations/wayForPayApiCredentials` | банківські/сервісні інтеграції | bundle-only: POST |
| POST | `/integrations/westernbidCredentials/setLoginAndKey` | банківські/сервісні інтеграції | bundle-only: POST |
| GET, POST | `/integrations/zerionCredentials` | банківські/сервісні інтеграції | bundle-only: GET,POST |
| GET | `/investors` | контрагенти певного типу | observed: GET |
| GET, POST | `/invites` | запрошення користувачів | observed: GET; bundle-only: POST |
| DELETE | `/invites/:p` | запрошення користувачів | bundle-only: DELETE |
| POST | `/login` | вхід/реєстрація | bundle-only: POST |
| GET | `/ml/status` | статус ML-категоризації | observed: GET |
| PATCH | `/ml/status/:p` | статус ML-категоризації | bundle-only: PATCH |
| GET, POST | `/onboarding` | онбординг (класичний і AI), демо-дані | observed: GET; bundle-only: POST |
| PATCH, DELETE | `/onboarding/:p` | онбординг (класичний і AI), демо-дані | bundle-only: DELETE,PATCH |
| GET, PATCH | `/onboarding/ai/session` | онбординг (класичний і AI), демо-дані | observed: GET; bundle-only: PATCH |
| POST | `/onboarding/ai/session/auto-open` | онбординг (класичний і AI), демо-дані | bundle-only: POST |
| GET | `/onboarding/ai/session/chat-history` | онбординг (класичний і AI), демо-дані | bundle-only: GET |
| POST | `/onboarding/ai/session/cta-click` | онбординг (класичний і AI), демо-дані | bundle-only: POST |
| POST | `/onboarding/ai/session/done` | онбординг (класичний і AI), демо-дані | bundle-only: POST |
| POST | `/onboarding/ai/session/skip` | онбординг (класичний і AI), демо-дані | bundle-only: POST |
| POST, DELETE | `/onboarding/demoData` | онбординг (класичний і AI), демо-дані | bundle-only: DELETE,POST |
| GET | `/onboarding/welcome-info` | онбординг (класичний і AI), демо-дані | observed: GET |
| POST | `/onboarding/welcome-seen` | онбординг (класичний і AI), демо-дані | bundle-only: POST |
| POST, PATCH, DELETE | `/operations/:p/:p` | операція: створення/оновлення/видалення за type/subType | bundle-only: DELETE,PATCH,POST |
| PATCH, DELETE | `/operations/:p/:p/:p` | операція: створення/оновлення/видалення за type/subType | bundle-only: DELETE,PATCH |
| PUT | `/operations/:p/:p/:p/files` | вкладення (файли) операції | bundle-only: PUT |
| DELETE | `/operations/:p/:p/:p/files/:p` | вкладення (файли) операції | bundle-only: DELETE |
| PATCH | `/operations/:p/:p/combine/predication/future` | обʼєднання прогнозу з фактом | bundle-only: PATCH |
| PUT | `/operations/:p/:p/files` | вкладення (файли) операції | bundle-only: PUT |
| PATCH | `/operations/:p/:p/payOffFuture/:p/:p` | погашення майбутнього (планового) платежу | bundle-only: PATCH |
| PATCH | `/operations/:p/:p/restore/:p` | відновлення видаленої операції (undo) | bundle-only: PATCH |
| PATCH | `/operations/:p/:p/update` | операція: створення/оновлення/видалення за type/subType | bundle-only: PATCH |
| PATCH | `/operations/:p/:p/updateCategory` | масова зміна категорії | bundle-only: PATCH |
| PATCH | `/operations/:p/restore/:p` | відновлення видаленої операції (undo) | bundle-only: PATCH |
| POST | `/operations/consumption/:p` | витратна операція за підтипом | bundle-only: POST |
| GET | `/operations/history` | історія дій (аудит/undo) по операціях і рахунках | observed: GET |
| GET | `/operations/history/account` | історія дій (аудит/undo) по операціях і рахунках | observed: GET |
| GET | `/operations/history/used-transactions` | історія дій (аудит/undo) по операціях і рахунках | observed: GET |
| POST, PATCH | `/operations/income/investment` | доходні операції за підтипом | bundle-only: PATCH,POST |
| DELETE | `/operations/income/investment/:p` | доходні операції за підтипом | bundle-only: DELETE |
| GET | `/operations/income/investment/id=:p` | доходні операції за підтипом | bundle-only: GET |
| POST | `/operations/income/invoices` | фактури: CRUD, товари/послуги, реквізити, PDF, відправка, підпис Dubidoc, файли | bundle-only: POST |
| GET, PATCH, DELETE | `/operations/income/invoices/:p` | фактури: CRUD, товари/послуги, реквізити, PDF, відправка, підпис Dubidoc, файли | bundle-only: DELETE,GET,PATCH |
| PUT | `/operations/income/invoices/:p/files` | фактури: CRUD, товари/послуги, реквізити, PDF, відправка, підпис Dubidoc, файли | bundle-only: PUT |
| DELETE | `/operations/income/invoices/:p/files/:p` | фактури: CRUD, товари/послуги, реквізити, PDF, відправка, підпис Dubidoc, файли | bundle-only: DELETE |
| PATCH | `/operations/income/invoices/confirmedInvoice` | фактури: CRUD, товари/послуги, реквізити, PDF, відправка, підпис Dubidoc, файли | bundle-only: PATCH |
| POST | `/operations/income/invoices/downloadInvoice` | фактури: CRUD, товари/послуги, реквізити, PDF, відправка, підпис Dubidoc, файли | bundle-only: POST |
| GET | `/operations/income/invoices/downloadPayment` | фактури: CRUD, товари/послуги, реквізити, PDF, відправка, підпис Dubidoc, файли | bundle-only: GET |
| GET, POST, PATCH | `/operations/income/invoices/goods` | фактури: CRUD, товари/послуги, реквізити, PDF, відправка, підпис Dubidoc, файли | observed: GET; bundle-only: PATCH,POST |
| PATCH, DELETE | `/operations/income/invoices/goods/:p` | фактури: CRUD, товари/послуги, реквізити, PDF, відправка, підпис Dubidoc, файли | bundle-only: DELETE,PATCH |
| GET, POST | `/operations/income/invoices/props` | фактури: CRUD, товари/послуги, реквізити, PDF, відправка, підпис Dubidoc, файли | observed: GET; bundle-only: POST |
| PATCH, DELETE | `/operations/income/invoices/props/:p` | фактури: CRUD, товари/послуги, реквізити, PDF, відправка, підпис Dubidoc, файли | bundle-only: DELETE,PATCH |
| POST | `/operations/income/invoices/send` | фактури: CRUD, товари/послуги, реквізити, PDF, відправка, підпис Dubidoc, файли | bundle-only: POST |
| POST | `/operations/income/invoices/signWithDubidoc` | фактури: CRUD, товари/послуги, реквізити, PDF, відправка, підпис Dubidoc, файли | bundle-only: POST |
| DELETE | `/operations/income/invoices/{id}/files/:p` | фактури: CRUD, товари/послуги, реквізити, PDF, відправка, підпис Dubidoc, файли | bundle-only: DELETE |
| POST, PATCH | `/operations/income/loan` | доходні операції за підтипом | bundle-only: PATCH,POST |
| DELETE | `/operations/income/loan/:p` | доходні операції за підтипом | bundle-only: DELETE |
| GET | `/operations/income/loan/id=:p` | доходні операції за підтипом | bundle-only: GET |
| POST, PATCH | `/operations/income/loanRepayment` | доходні операції за підтипом | bundle-only: PATCH,POST |
| DELETE | `/operations/income/loanRepayment/:p` | доходні операції за підтипом | bundle-only: DELETE |
| GET | `/operations/income/loanRepayment/id=:p` | доходні операції за підтипом | bundle-only: GET |
| POST, DELETE | `/operations/income/sale` | доходні операції за підтипом | bundle-only: DELETE,POST |
| PATCH, DELETE | `/operations/income/sale/:p` | доходні операції за підтипом | bundle-only: DELETE,PATCH |
| PATCH | `/operations/income/sale/approve` | доходні операції за підтипом | bundle-only: PATCH |
| PATCH | `/operations/income/sale/updateAccounts` | доходні операції за підтипом | bundle-only: PATCH |
| PATCH | `/operations/income/sale/updateComment` | доходні операції за підтипом | bundle-only: PATCH |
| PATCH | `/operations/income/sale/updateProjects` | доходні операції за підтипом | bundle-only: PATCH |
| PATCH | `/operations/income/sale/updateTags` | доходні операції за підтипом | bundle-only: PATCH |
| POST | `/operations/log` | журнал операцій (POST = список; body {query:"<querystring>"}) | observed: POST |
| GET | `/operations/log/count` | кількість операцій у журналі | observed: GET |
| POST | `/operations/log/pdf` | PDF-експорт журналу | bundle-only: POST |
| GET | `/operations/log/predictions/:p` | прогнози для операції | bundle-only: GET |
| POST | `/operations/transfer` | переказ між рахунками (CRUD, перетворення операції на переказ) | bundle-only: POST |
| DELETE | `/operations/transfer/:p` | переказ між рахунками (CRUD, перетворення операції на переказ) | bundle-only: DELETE |
| PATCH | `/operations/transfer/:p/:p` | переказ між рахунками (CRUD, перетворення операції на переказ) | bundle-only: PATCH |
| GET, PATCH | `/operations/transfer/id=:p` | переказ між рахунками (CRUD, перетворення операції на переказ) | bundle-only: GET,PATCH |
| PATCH | `/operations/transfer/transformOperationToTransfer/:p` | переказ між рахунками (CRUD, перетворення операції на переказ) | bundle-only: PATCH |
| GET | `/owners` | контрагенти певного типу | observed: GET |
| GET | `/paymentHistory` | історія оплат підписки, реквізити | observed: GET |
| GET, PATCH | `/paymentHistory/props` | історія оплат підписки, реквізити | observed: GET; bundle-only: PATCH |
| POST | `/paymentHistory/props/email` | історія оплат підписки, реквізити | bundle-only: POST |
| DELETE | `/paymentHistory/props/email/:p` | історія оплат підписки, реквізити | bundle-only: DELETE |
| POST | `/pdfParse/upload` | парсинг PDF-виписок | bundle-only: POST |
| GET, POST, DELETE | `/permissionPeriods` | закриті періоди для ролі | observed: GET; bundle-only: DELETE,POST |
| GET | `/permissionTypes` | типи прав (read/edit -> HTTP-методи) | observed: GET |
| GET, POST | `/permissions` | права ролі по ресурсах | observed: GET; bundle-only: POST |
| DELETE | `/permissions/:p` | права ролі по ресурсах | bundle-only: DELETE |
| GET | `/permissions/ids` | права ролі по ресурсах | observed: GET |
| GET | `/permissions/validate` | права ролі по ресурсах | bundle-only: GET |
| PATCH | `/predictions/deleteMany` | прогнози (масове видалення) | bundle-only: PATCH |
| GET | `/project-distribution-templates` | шаблони розподілу по проєктах | observed: GET |
| GET, POST | `/projects` | проєкти (CRUD, bulk) | observed: GET; bundle-only: POST |
| PATCH, DELETE | `/projects/:p` | проєкти (CRUD, bulk) | bundle-only: DELETE,PATCH |
| PATCH | `/projects/all/bulk` | проєкти (CRUD, bulk) | bundle-only: PATCH |
| POST | `/registration/demo` | вхід/реєстрація | bundle-only: POST |
| POST | `/registration/invalidEmailToPD` | вхід/реєстрація | bundle-only: POST |
| GET, POST | `/remuneration-sheets` | відомості оплати праці (CRUD) | observed: GET; bundle-only: POST |
| GET, PATCH, DELETE | `/remuneration-sheets/:p` | відомості оплати праці (CRUD) | bundle-only: DELETE,GET,PATCH |
| GET | `/remuneration-sheets/:p/history` | відомості оплати праці (CRUD) | bundle-only: GET |
| GET | `/resources` | перелік ресурсів RBAC | observed: GET |
| GET, POST | `/roles` | ролі (посади) | observed: GET; bundle-only: POST |
| PATCH, DELETE | `/roles/:p` | ролі (посади) | bundle-only: DELETE,PATCH |
| PATCH | `/roles/all/bulk` | ролі (посади) | bundle-only: PATCH |
| GET, POST | `/rules` | автоправила (CRUD, порядок, статус) | observed: GET; bundle-only: POST |
| PATCH, DELETE | `/rules/:p` | автоправила (CRUD, порядок, статус) | bundle-only: DELETE,PATCH |
| PATCH | `/rules/order` | автоправила (CRUD, порядок, статус) | bundle-only: PATCH |
| GET | `/rules/status` | автоправила (CRUD, порядок, статус) | observed: GET |
| PATCH | `/rules/status/:p` | автоправила (CRUD, порядок, статус) | bundle-only: PATCH |
| GET | `/staffMembers` | контрагенти певного типу | observed: GET |
| GET | `/storage/:p` | файлове сховище (логотипи, вкладення) | bundle-only: GET |
| POST, DELETE | `/storage/logo` | файлове сховище (логотипи, вкладення) | bundle-only: DELETE,POST |
| GET | `/storage/logo/company/:p` | файлове сховище (логотипи, вкладення) | bundle-only: GET |
| POST | `/storage/upload` | файлове сховище (логотипи, вкладення) | bundle-only: POST |
| POST | `/subscriptions` | підписка (використання, health, аддони, Stripe) | bundle-only: POST |
| POST | `/subscriptions/addAddon` | підписка (використання, health, аддони, Stripe) | bundle-only: POST |
| POST | `/subscriptions/deleteAddon` | підписка (використання, health, аддони, Stripe) | bundle-only: POST |
| GET | `/subscriptions/health` | підписка (використання, health, аддони, Stripe) | observed: GET |
| GET | `/subscriptions/invoiceLink` | підписка (використання, health, аддони, Stripe) | bundle-only: GET |
| GET | `/subscriptions/preview` | підписка (використання, health, аддони, Stripe) | bundle-only: GET |
| POST | `/subscriptions/switch/default-payment-method` | підписка (використання, health, аддони, Stripe) | bundle-only: POST |
| POST | `/subscriptions/switch/setup-intent` | підписка (використання, health, аддони, Stripe) | bundle-only: POST |
| GET | `/subscriptions/used` | підписка (використання, health, аддони, Stripe) | observed: GET |
| GET | `/suppliers` | контрагенти певного типу | observed: GET |
| PATCH | `/suppliers/update/many` | контрагенти певного типу | bundle-only: PATCH |
| GET, POST | `/tags` | теги | observed: GET; bundle-only: POST |
| PATCH, DELETE | `/tags/:p` | теги | bundle-only: DELETE,PATCH |
| GET, POST, PATCH | `/tagsWithPagination` | теги з пагінацією | observed: GET; bundle-only: PATCH,POST |
| PATCH, DELETE | `/tagsWithPagination/:p` | теги з пагінацією | bundle-only: DELETE,PATCH |
| GET | `/tagsWithPagination/count` | теги з пагінацією | observed: GET |
| GET | `/tariffs` | тарифи та аддони | observed: GET |
| GET | `/tariffs/addons` | тарифи та аддони | observed: GET |
| DELETE | `/tariffs/cancel/:p` | тарифи та аддони | bundle-only: DELETE |
| GET | `/taxOrganisations` | контрагенти певного типу | observed: GET |
| GET | `/translations` | переклади інтерфейсу | observed: GET |
| POST | `/update_user_data` | оновлення даних користувача (маркетинг) | bundle-only: POST |
| GET, DELETE | `/user-sessions` | активні сесії | observed: GET; bundle-only: DELETE |
| DELETE | `/user-sessions/current` | активні сесії | bundle-only: DELETE |
| POST | `/user/authByToken` | профіль користувача, 2FA, країна | bundle-only: POST |
| PATCH | `/user/country` | профіль користувача, 2FA, країна | bundle-only: PATCH |
| GET | `/user/fb` | профіль користувача, 2FA, країна | observed: GET |
| GET | `/user/isEmailExists` | профіль користувача, 2FA, країна | bundle-only: GET |
| GET, PATCH | `/user/profile` | профіль користувача, 2FA, країна | observed: GET,PATCH |
| PATCH | `/user/profile/email2FAStatus` | профіль користувача, 2FA, країна | bundle-only: PATCH |
| POST | `/user/profile/totp-confirm` | профіль користувача, 2FA, країна | bundle-only: POST |
| PATCH | `/user/profile/totp-disable` | профіль користувача, 2FA, країна | bundle-only: PATCH |
| GET | `/user/profile/totp-setup` | профіль користувача, 2FA, країна | bundle-only: GET |
| GET, PATCH | `/vat-settings` | ставка ПДВ за замовчуванням | observed: GET; bundle-only: PATCH |
| GET | `/version.json` | версія фронтенду | bundle-only: GET |
| GET, POST | `/webhooks` | вебхуки (CRUD) | observed: GET; bundle-only: POST |
| PATCH, DELETE | `/webhooks/:p` | вебхуки (CRUD) | bundle-only: DELETE,PATCH |

**Ключові write-флоу (з бандла, не виконувались):**
- Створення операції: `POST /operations/{income|consumption}/{subType}?context=operation&offset=<ms>&isDuplicate=<bool>` (тіло — поля Operation: рахунок, сума/валюти, `date`, `dateOfPayment`, категорія, контрагент `<type>Id`, `projects:[{id,stake}]`, `tagIds`, `comment`, schedule-поля). Переказ — `POST /operations/transfer?...` з `accountFromId/accountToId`, двома сумами і курсом.
- Масові зміни: `PATCH /operations/{type}/{subType}/updateCategory {ids, categoryId}`, `PATCH /operations/income/sale/updateProjects {ids, projects}`, `…/updateComment`, `…/updateTags`, `…/updateAccounts`, `PATCH /operations/{type}/{id}?isBulkUpdate=true`, `DELETE /operations/income/sale?isBulkUpdate=true {ids}`.
- Undo: `DELETE …?undoHistoryId=…`, `PATCH /operations/{type}/{subType}/restore/{id}?undoHistoryId=…`.
- Рахунок: `POST /accounts {typeId, currencyId, name, startingBalance, crypto, partnersId}`, `PATCH /accounts/{id} {typeId, currencyId, name, startingBalance}`.
- Автоправило: `POST /rules <Rule>`, `PATCH /rules/{id}`, `PATCH /rules/order`, `PATCH /rules/status/{id}`.
- Користувачі/ролі: `POST /invites {roleId, name, email}`, `PATCH /employees/{id} {roleId, name}`, `POST /roles {label}`, `POST /permissions` (створення прав ролі).
- Вебхук/API: `POST /webhooks {name, url}`, `PATCH /webhooks/{id} {name, url}`, `POST integration/companyApiKeys {name}`.
- Компанія: `POST /companies <payload>`, `PATCH /companies/{id} {name, currencyId}`, `PATCH /companies/{id}/account-need-confirm {accountNeedConfirm}`, `POST /onboarding/demoData`, `POST /companies/cleanupDemoData`.

---

## 5. Права доступу й ролі

**Архітектура RBAC.** Права привʼязані до REST-ресурсів і HTTP-методів:
- `PermissionType`: `read:get`, `edit:post`, `edit:put`, `edit:patch`, `edit:delete` (у UI — три колонки «Przeglądanie / Edytow. / Usunięcie»).
- `Resource` = префікс API (`accounts`, `projects`, `tags`, `categories/income`, `categories/consumption`, `clients`, `investors`, `borrowers`, `creditors`, `owners`, `staffMembers`, `suppliers`, `counterparties`, `taxOrganisations`, `operations/income/{sale|investment|loan|loanRepayment|generic}`, `operations/consumption/{supplier|salary|tax|dividend|loan|loanRepayment|other|generic}`, `operations/transfer`, `operations/log`, `operations/history`, `futurePayments`, `analytics/{cash|profitAndLoss|debit|credit|projects|accounts/statement|calendar|planActual|financialPerformance|vat|custom|ai}`, `imports`, `invoices/{goods|props|companies}`, `rules`, `roles`, `permissions`, `invites`, `employees`, `webhooks`, `integration/{apiKeys|companyApiKeys}`, `paymentHistory`, `remunerationSheets`, `marketplace/applications`, `ml`, `attachment`, …).
- `Permission { roleId, context, resources[{resourceId, typeIds[], items[]}] }` — `items` дозволяє обмежити доступ **конкретними сутностями** (напр. лише певні рахунки/категорії/проєкти).
- `fastPermissions` — шаблони ролей («Wyświetl wszystkie», «Przeglądanie i edycja wszystkiego», «Przeglądanie, edytowanie i usuwanie wszystkich»), системна роль «Pełny dostęp»; власник компанії має всі права (окремий рядок «Właściciel»).
- `PermissionPeriod` — **закриття періоду** для ролі: «Close period by payment date» і «Close period by accrual date» (+ «Select period»): операції в закритому періоді не можна змінювати.

**Матриця у формі «Edycja stanowiska»** (що можна налаштувати):

| Блок | Елементи | Рівні |
|---|---|---|
| Глобальні тумблери | Wyświetlanie kont (видимість рахунків), Rejestr transakcji (бачити журнал), Edycja operacji, Close period by payment date (+період), Close period by accrual date (+період) | on/off |
| Обʼєкти журналу | Wszystko konta ▸, Wszystko kategorie wpływów ▸, Wszystko kategorie wydatków ▸, Wszystko kredytodawcy ▸, Wszystko moi kontrahenci ▸, Wszystko właściciele ▸, Wszystkie projekty ▸, Wszystko tagi ▸ (▸ = розгорнути до окремих записів) | Przeglądanie / Edytow. / Usunięcie |
| Analityka | Rachunek zysków (P&L), Cash flow, Należność, Zobowiązania, Projekty, Wyciąg z konta, Historia działań, Plan vs Actual, Financial Performance, Balance | Przeglądanie (кожен окремо) |
| Przyszłe płatności | тумблер + перегляд за системними категоріями: Spłata pożyczki (дохід), Uzyskiwanie pożyczki, Inwestycje, Udzielenie pożyczki, Spłata pożyczki (витрата), Podatki, Pensja, Dywidendy, Kategorie wydatków, Kategorie dochodów | Przeglądanie |
| Модулі | Kalendarz, Faktury, AI Advisor, Użytkownicy | on/off |
| Ustawienia | Konta, Projekty, Tagi, Kategorie wpływów, Kategorie wydatków, Klienty, Inwestorzy, Kredytobiorcy, Kredytodawcy, Moi kontrahenci, Pracownicy, Właściciele, Kontrahenci, Rodzaje podatków | Przeglądanie / Edytow. |

Додатково: Remuneration sheet доступний лише власнику або ролям з доступом до всіх даних компанії; «Wsparcie» toggle дає підтримці доступ до акаунта; «Niestandardowe dostępy» (кастомні ролі) і 2FA — фічі тарифу. Резюме прав у списку користувачів генерується автоматично («Pełny dostęp», «Rejestr, analityka, raporty»).

---

## 6. Тарифи й обмеження

Ціни (USD, помісячно; півроку −15%, рік −20%; валюта цін перемикається):

| Параметр | Lite ($25) | Pro ($45, «Maksymalna korzyść») | Advanced ($85) |
|---|---|---|---|
| Транзакцій / міс. | 600 | 1 500 | 5 000 |
| Банківських інтеграцій | 2 | 15 | 100 |
| Крипто-інтеграцій | — | 3 | 5 |
| Користувачів | 2 | 7 | 30 |
| Автоправил | 2 | 50 | 500 |
| Основні звіти | CF + P&L | CF + P&L + Balance | All reports |
| Raport Projekty | так | так | так |
| Kalendarz płatności | — | так | так |
| Kontrola zadłużenia (Należność/Zobowiązania) | — | так | так |
| Plan/Actual | — | — | так |
| Financial performance | — | так | так |
| AI Advisor (запитів/міс.) | 20 | 80 | 300 |
| Niestandardowe dostępy (кастомні ролі) | — | так | так |
| Uwierzytelnianie dwuskładnikowe (2FA) | так | так | так |
| Відкритий API | — | так | так |
| Мобільні застосунки, імпорт Excel/виписок, Telegram-бот | так | так | так |
| Підтримка | AI + чат | 1 консультація/міс. 30 хв | 2 консультації/міс. з Senior Support Manager |
| Dostęp do współpracy (WKRÓTCE) | тільки перегляд | тільки перегляд | повний доступ |

Інші коди тарифів у системі: `Trial`, `TrialWithoutRecurrent`, `Starter`, `LiteV2`, `ProV2`, `Boss` (+ старі `Lite/Pro`). Пробний період з бейджами «Trial».

**Аддони (річна оплата):** Dodatkowa integracja z bankami $36/рік (за одиницю), Dodatkowy pracownik $36, +30 auto rules $180, +50 auto rules $240, Payment calendar $120, P&L report $120, Plan/Actual report $180, Debtor & Creditor report $120, Financial Performance report $180, Higher API rate limits (+5 req/5 s, +60 req/min за одиницю) $120; є вкладка «One-time» (разові: додаткові транзакції, пакети AI-запитів 30/100/300, продовження тріалу, консультації, інтеграції партнерів KeyCRM/Sitniks/Uspacy).

**Як працює гейтінг (спостереження + код):**
- Ліміти рахуються через `GET /subscriptions/used` (транзакції за поточний розрахунковий місяць, правила, ролі, співробітники, крипто/банк-інтеграції, імпорти) і показуються в «Subskrypcja» та «Effectiveness».
- Звіти поза тарифом — замок на плитці/вкладці і «restricted dialog» з пропозицією апгрейду або аддону (`useAnalyticAccess`, `setShowRestrictedDialog`).
- Сервер повертає 402/403 для заблокованих ресурсів → фронт розлогінює/редіректить.
- При даунгрейді — режим «Tylko podgląd» (тільки перегляд) для частини даних.
- Неоплата: `tariffUnpaid`, `stripePastDue` → банери «subscription past due / expired».
- Оплата через Stripe (`/subscriptions`, `/subscriptions/switch/setup-intent`, `…/default-payment-method`, `/subscriptions/preview`, `/subscriptions/addAddon|deleteAddon`, `/tariffs/cancel/{id}`).

---

## 7. Інтеграції

**Агрегатори відкритого банкінгу:**
- **Nordigen / GoCardless** (ЄС/ЄЕЗ/UK, ~30 країн; список банків по країнах з `maxTakingDaysNumber`, `logoLink`; мультирахунки, реконект, ліміти запитів) — `/integrations/nordigenApiCredentials/*`.
- **Salt Edge** («Saltage») — `/integrations/saltageApiCredentials/*` (banks/accounts/reconnect/update).
- **Belvo** (Латинська Америка: Бразилія, Колумбія, Мексика) — `/integrations/belvoApiCredentials/*`.

**Прямі інтеграції (UA/GE):** Privat24 (особисті), PrivatBank Business (Приват для бізнесу), monobank (особисті/ФОП), monobank Corporate, monobank acquiring, A-Bank (V2), ПУМБ for Business, Ukrsibbank, Ukrgasbank, Credit Dnipro, NovaPay, Bank of Georgia Business.

**Платіжні/сервіси:** PayPal, Wise (OAuth, `transferwise_oauth_client`), Payoneer, Stripe, Revolut Business, Fondy (v1/v2), Hutko, WayForPay, WesternBid, Airwallex/Finom/N26/Paysera/Skrill/Neteller/Soldo/Swan/Vivid (через агрегатор), Tinkoff (legacy).

**Крипто:** TRON (USDT-гаманці), Zerion (портфель), Binance (імпорт).

**Каси/ритейл/маркетплейси:** Poster (POS HoReCa), Checkbox і Vchasno.Kasa (ПРРО), Prom.ua, Ordage, Profit.Store.

**Фактури/облік/документи:** Fakturownia (PL), iDoklad (CZ), Dubidoc (електронний підпис фактур), Dilovod, Master, SMARTFIN, QuickBooks і Xero (інвойси → очікувані доходи), «1C → Finmap Migration» (soon).

**CRM/ERP/телефонія (через marketplace/партнерів):** HubSpot, Salesforce, Odoo, KeyCRM, Sitniks, Uspacy, NetHunt, SalesDrive, RoApp, Vortex CRM, Creatio, Servio, KeepinCRM, Unitalk, Voiptime; Hubstaff.

**Автоматизація/розробникам:** публічний REST API (ключі користувача/компанії, rate limits як аддон), вебхуки, Zapier, ApiX-Drive, **Finmap MCP** (керування з AI-асистента), Folio (AI-асистент), Telegram-бот (додавання операцій з Telegram), мобільні застосунки iOS/Android.

**Імпорт файлів (≈130 парсерів):** AI import (будь-який файл), Excel (шаблон), CSV/PDF-виписки банків UA (≈45), PL (Santander, ING, mBank, Pekao, PKO, Nest, SON, Velo, Millennium, Fakturownia), KZ (Kaspi, Halyk, Jusan, Forte, CenterCredit, RBK, Home Credit, Freedom, VTB), UZ (Agrobank, Kapitalbank, Ipak Yuli, NBU, Orient Finans, SQB, Asia Alliance), BR (Cora, Inter, C6), «Inne kraje» (BBVA, Citi, Revolut, Wise Business, Mercury, Chase, Bank of America, UBS, Swedbank, SEB Latvia, Paysera, Emirates NBD, HDFC, TBC, Bank of Georgia, CaixaBank, Erste, OTP Hungary, Ziraat, Kuveyt Türk, … ), сервіси (Upwork, PayPal, Binance, WesternBid, DNTrade, Payoneer, Trustee).

**Курси валют:** провайдери Default, PayPal, Custom, NBP (Польща), Mastercard, CNB (Чехія), NBK (Казахстан), Cryptocurrency; вибір провайдера на рівні компанії; ручні курси.

---

## 8. Що не вдалося дослідити і чому

**Свідомо не виконувалось (мутуючі дії):**
- Збереження будь-яких форм: створення/редагування/видалення операцій, переказів, рахунків, категорій, контрагентів, проєктів, тегів, фактур, планів, кастомних метрик, ролей, інвайтів, вебхуків, API-ключів, компаній, власних курсів; «Zapisz filtr», «Save as template», «Build file»/Excel-експорт (не натискались).
- Імпорт файлів (Excel/AI/PDF), підключення банків (Nordigen/Salt Edge/Belvo consent-флоу), «Podłącz ponownie bank», «Podłączyć bank».
- «Run AI agent», надсилання промптів в AI Advisor, «Auto-confirm actions», quick queries, AI-категоризація; «Call a financier»/«Order» консалтингу.
- Undo («Odwołaj», «Anulować działanie»), bulk-видалення, drag-сортування рахунків/категорій/правил, тумблери активності автоправил, «Enable Backup», 2FA, «Sign out all», «Delete Profile», «Wygeneruj nowy klucz TG», «Wsparcie», зміна мови/валюти, перемикання компанії, апгрейд/даунгрейд тарифу, оплата аддонів, logout.
- Через це не побачено: точні payload-и write-запитів (відновлено лише з бандла), відповіді на помилки валідації сервера, вигляд згенерованого PDF/Excel, детальні кроки підключення банків, екран результату імпорту/AI-імпорту, відповіді AI-агента.

**Недоступно/обмежено в цьому акаунті:**
- `/analytic/custom` — нескінченний лоадер (фіча/права); `/analytic/consulting` — редірект на `/log` (feature-flag вимкнено); `/settings/companySubscription/{invoices|paymentDetails|billingPeriod}` як окремі URL — редірект на `/log` (вкладки працюють лише всередині сторінки).
- Remuneration sheet — «No access» (поточний користувач не власник; `GET /remuneration-sheets` → 403), тому структура відомості зарплат не відома.
- Фактур, товарів, реквізитів, вебхуків, власних курсів, split-шаблонів, збережених фільтрів, бекапів у компанії немає → бачили лише порожні стани і форми створення (рядок/деталь фактури не побачено).
- Список «Pracownicy» (staffMembers) порожній → зарплатні операції/відомість на живих даних не перевірені.
- Деякі GET без обовʼязкових параметрів повертали 400/404 (`/futurePayments`, `/imports/history`, `/analytics/planActual/history`, `/analytics/remuneration-report/month`).
- Вкладка «One-time» аддонів, мобільні застосунки, Telegram-бот, auth-екрани (щоб не розлогінитися), публічна документація API/вебхуків (зовнішні посилання) — не відкривались.

**Побічні ефекти, які зробив сам застосунок під час перегляду (для прозорості):**
- При кожному повному перезавантаженні сторінки фронтенд сам викликає `PATCH /user/profile {currentCompanyId, currentLangIso, location}` з тими ж значеннями (≈14 разів).
- Закриття реферального попапу на сторінці тарифів викликало `POST /companies/closedReferal` (позначка «попап закрито»).
- Індикатор «Effectiveness» зріс (N/5 → M/5) після відвідування звітів (P&L тощо) — це лічильник використання, обчислюваний сервером (`/subscriptions/health`).
- Фронтенд постійно шле аналітичні події `POST /common/event` та метрики Unleash `POST /features/proxy/client/metrics`.
- Під час сесії банк синхронізував нові транзакції (баланси змінились) — зовнішня подія, не повʼязана з дослідженням.
- Жодних операцій, довідників, налаштувань чи прав не створено/не змінено/не видалено (перевірено по перехопленим non-GET запитам).

**Нотатка щодо локальних артефактів:** скриншоти та злиті схеми API містять реальні дані акаунта й зберігаються лише локально, поза репозиторієм.
