@AGENTS.md

# CLAUDE.md — FinFlow Project Rules

## Project Overview
**FinFlow** — SaaS cash-flow and management-accounting app for small/medium businesses (2–50 people). Target market: Poland (PL/EN/UA interface planned in S03, base currency PLN).
Working today: accounts, income/expense/transfer transactions, Cash Flow, P&L, Balance, payment calendar, CSV export, Enable Banking bank connection (beta).
Roadmap: `docs/superpowers/specs/2026-10-22-finflow-roadmap.md`. Sub-project specs: `docs/superpowers/specs/`, plans: `docs/superpowers/plans/`, change log and known follow-ups: `PROGRESS.md`.

## Tech Stack
- **Framework:** Next.js 16 (App Router; Turbopack for `next dev` and `next build`), React 19.2, TypeScript 5 (strict)
- **Proxy:** `proxy.ts` — the Next 16 name for middleware (Node.js runtime). It gates only app pages (`/<segment>/...`, see `isAppPath` in `lib/auth/paths.ts`): it verifies the signature and expiry of the `__session` cookie (not revocation); an invalid cookie is cleared and the visitor is redirected to `/login?redirect=…`, a verification failure on our side (including Google signing-key fetch errors) answers 503 and leaves the cookie alone. `/login` and `/register` are never redirected, so a visitor with a stale cookie can always sign in again. Firestore data is protected by security rules, not by the proxy.
- **Auth/session (S01):** after every Firebase sign-in the browser calls `POST /api/auth/session` with a fresh ID token (`auth_time` ≤ 5 min, else 401 `reauth_required`); the server mints an HttpOnly 7-day Firebase session cookie (`__session`). Sessions are absolute: there is no silent renewal. API routes call `await requireUser(req)` / `requireVerifiedUser(req)` from `lib/server/auth.ts` (revocation-checked; POST/PUT/PATCH/DELETE also need a same-origin `Origin`; `requireVerifiedUser` reads the live user record, not the cookie claim). There is no Bearer-token auth. Every route under `app/api` must call one of them or be on the allow-list (with a reason) in `tests/unit/server/route-auth-coverage.test.ts`. Sign-out calls `POST /api/auth/logout`, which revokes ALL refresh tokens of the user (every device is signed out), but only through a live, non-revoked session (a stale revoked cookie is merely cleared); the root `AuthProvider` triggers it too when the SDK has no user. The Banks settings page (`settings/banks`, where the Enable Banking callback returns) accepts the bank return value `?eb_auth=` only for a connection started in this tab (`eb_pending` in sessionStorage, `lib/enablebanking/pending.ts`). Never write `__session` from client code. Shared path and `?redirect=` rules (`safeRedirectPath`) live in `lib/auth/paths.ts`.
- **Client data:** Firebase JS SDK 12 (Auth + Firestore), used only from `lib/firebase/` and `lib/hooks/`
- **Server data:** `firebase-admin`, used ONLY inside `lib/server/` (each file starts with `import 'server-only'`); entry point `getAdmin()` in `lib/server/firebase-admin.ts`. Firestore uses `preferRest: true` in production only (faster serverless cold start); on the emulator it uses gRPC, because REST would need Application Default Credentials
- **UI:** shadcn/ui (`base-nova` style on `@base-ui/react`), Recharts, Tailwind CSS 4, lucide-react, next-themes, sonner
- **Banking:** Enable Banking (AIS/PSD2) — routes `app/api/enablebanking/*`, `lib/enablebanking/jwt.ts` (server-only JWT), `lib/enablebanking/client.ts` (`ebFetch` for client components: same-origin fetch that authenticates with the session cookie; on 401 it clears the session and navigates to `/login?redirect=…`)
- **Payments:** Stripe is NOT wired yet (`lib/stripe.ts` is unused; billing arrives in S17)
- **Tooling:** npm, Node.js 24 (`engines.node` = `24.x`), ESLint 9 flat config (`eslint.config.mjs` + `eslint-config-next` 16), Vitest, `@firebase/rules-unit-testing`, Playwright

## Hosting & Infrastructure
- **Hosting:** Vercel — team `biuro-3838s-projects` (Hobby until S17; Hobby is non-commercial, so move to Pro before billing goes live), project `finflow`, Git integration with GitHub `remit-agency/finflow`. Push to `master` → production; every PR → preview deployment. Hobby builds a commit only if its author is the GitHub account connected to the Vercel owner (`remit-agency`); this repo's local git author is set to it, otherwise deployments end `BLOCKED`.
- **Function region:** `fra1` (Frankfurt), pinned in `vercel.json` (`{ "regions": ["fra1"] }`). Node.js 24.x.
- **Firebase:** project `finflow-e94b5`, Firestore location `eur3` (EU multi-region). Rules `firestore.rules` (deny by default), `storage.rules` (deny all — Storage is unused), indexes `firestore.indexes.json`, all wired in `firebase.json`; default project in `.firebaserc`.
  Deploy rules + indexes: `firebase deploy --only firestore:rules,firestore:indexes --project finflow-e94b5 --account "$FIREBASE_ACCOUNT"` (the Firebase CLI account is `FIREBASE_ACCOUNT` in the gitignored `.env`). Add `,storage` only once a default Storage bucket exists: without one the CLI aborts with `Firebase Storage has not been set up`.
- **Health check:** `GET /api/health` → `{ ok, region, firestore: 'ok' }` (admin read of `_meta/health`; no user data).
- **CI:** job `ci` in `.github/workflows/ci.yml` on every PR and every push to `master`: install → server-import guard → lint → typecheck → unit → rules (emulator) → Playwright e2e (emulators) → build. The job id `ci` is the required status check on `master`: do not rename it. `master` is protected: merge only via PR with green CI.
- **Cloudflare Pages / OpenNext / wrangler were removed in S00.** Do not reintroduce `getCloudflareContext`, webpack aliases for `@firebase/*`, a custom `webpack()` config (it fails Turbopack builds) or post-build patch scripts.

## Environment Variables
Names are listed in `.env.example` (committed, names only). Local values live in `.env.local` (gitignored). Never commit, log or paste values.

| Variable | Kind (Vercel) | Read by |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID`, `_MEASUREMENT_ID` | plain | `lib/firebase/firebase.ts` |
| `NEXT_PUBLIC_APP_URL` | plain | Enable Banking redirect URL, `app/robots.ts`, `app/sitemap.ts` |
| `ENABLEBANKING_APP_ID`, `ENABLEBANKING_PRIVATE_KEY` | sensitive | `lib/enablebanking/jwt.ts` |
| `FIREBASE_SERVICE_ACCOUNT` (base64 of the service-account JSON) | sensitive | `lib/server/firebase-admin.ts` |
| `EB_STATE_SECRET` (32 random bytes, base64) | sensitive | `lib/server/eb-state.ts` |
| `NEXT_PUBLIC_USE_EMULATORS=1`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST` | local / CI only | emulator wiring |

Secret sources on the dev machine (gitignored): `.secrets/` (Enable Banking key + certificate, Firebase service-account JSON) and `.env` (tooling: `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `FIREBASE_ACCOUNT`).

## Commands
| Command | What it does |
|---|---|
| `npm run dev` | Next dev server (Turbopack; output in `.next/dev`; also refreshes `AGENTS.md`) |
| `npm run build` / `npm start` | production build / serve it |
| `npm run lint` | `eslint .` — `next build` no longer lints, so run it before every commit |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:server-imports` | `scripts/check-server-imports.mjs`: loads the server-side CommonJS dependencies with `require(esm)` disabled, as the Vercel runtime does (see "What NOT to Touch") |
| `npm run test:unit` | Vitest, `tests/unit/**/*.test.ts` (`vitest.config.ts`; `server-only` is stubbed) |
| `npm run test:rules` | Firestore rules tests on the emulator, `tests/rules/**/*.test.ts` (`vitest.rules.config.ts`, project `demo-finflow`) |
| `npm run test:e2e` | Playwright, `tests/e2e/**/*.spec.ts`; the smoke flow needs the Auth + Firestore emulators — see `.github/workflows/ci.yml` for the exact command and env |
| `npm run ui:shots` | Screenshots of the key screens (1440×900 and 390×844, `dark` forced on `<html>`, asserts the shell stays light) into `ui-shots/` (gitignored) for the visual review; starts the Auth + Firestore emulators itself (Java 21 on PATH) |

The Firebase emulators need Java 21. No system-wide JDK is installed on the dev machine, so rules tests and e2e-with-emulators run in CI. To run them locally, either install Temurin 21 (`winget install EclipseAdoptium.Temurin.21.JDK`) and open a new terminal, or use the portable JRE in `~/.jre/temurin-21` (only if the user agreed to unpack it during S00) by prefixing the command with `PATH="$HOME/.jre/temurin-21/bin:$PATH"` in Git Bash.

## Folder Structure
```
app/
  (auth)/login, register          ← auth pages (client components)
  (app)/[orgSlug]/                ← signed-in app; orgSlug is the Firestore orgId
    layout.tsx                    ← server layout: ShellProvider + AppShell (S01A)
    transactions/  analytics/{cashflow,pl,balance,calendar}/  settings/{company,categories,banks,subscription}/ (layout.tsx = section menu; settings/ redirects)
  api/health/route.ts             ← health check (firebase-admin)
  api/auth/{session,logout}/route.ts  ← mint / revoke the session cookie
  api/enablebanking/{institutions,session,callback,accounts}/route.ts
  page.tsx (landing), pricing/, layout.tsx, globals.css, robots.ts, sitemap.ts
components/
  ui/            ← shadcn generated files (CLI only; the hand edits are marked `FinFlow (S01A)`)
  shell/         ← AppShell, AppHeader, OrgSwitcher, ProfileMenu, AccountsSidebar, ModuleTabs (S01A)
  charts/ forms/ transactions/ settings/ landing/ auth/ (VerifyEmailBanner)  ThemeToggle.tsx
lib/
  auth/          ← paths.ts: pure path and `?redirect=` rules shared by proxy.ts and the browser
  firebase/      ← client SDK init (firebase.ts), Firestore helpers, session.ts (establish/clear the session cookie) — browser only
  hooks/         ← useAuth (AuthProvider, single instance in the root layout), useOrg, useAccounts, useCategories, useTransactions, useShell (ShellProvider: shell state and the global TransactionForm/AccountForm)
  server/        ← server-only: firebase-admin.ts, auth.ts, session-cookie.ts, request-guards.ts, http-error.ts, eb-state.ts
  enablebanking/ ← jwt.ts (server-only), client.ts (ebFetch)
  shell/         ← pure shell helpers: modules.ts (tabs), settings-sections.ts, sidebar-store.ts
  utils/         ← accounts (summarizeAccounts), analytics, currency, date, export (CSV), journal (day totals, UTC dates)
scripts/         ← check-server-imports.mjs (CI guard), vercel.mjs (Vercel API helper), verify-firestore-rules.mjs (black-box rules check)
types/           ← shared TS types (Organization, Account, Transaction, …)
tests/
  unit/          ← Vitest
  rules/         ← Firestore security-rules tests (emulator)
  e2e/           ← Playwright
proxy.ts         ← Next 16 proxy (ex-middleware)
firebase.json  .firebaserc  firestore.rules  firestore.indexes.json  storage.rules
vercel.json  .github/workflows/ci.yml  .env.example  AGENTS.md (managed by next dev)
docs/            ← research, specs, plans
```

## Firestore Data Model (S00)
- `organizations/{orgId}`: `{ name, currency, ownerId, plan, trialEndsAt, createdAt, members: { [uid]: { role: 'owner' } } }`
  - subcollections: `accounts`, `categories`, `transactions`, `bankConnections`
- `_meta/{docId}` — server-only (for example `_meta/health`); clients are denied by the rules
- Membership lookup on the client: `where('members.<uid>.role', '!=', null)` in `useOrg`. S02 moves membership into its own documents.

## Coding Conventions
- TypeScript strict mode always
- Server Components by default, `'use client'` only when needed (forms, hooks, charts)
- Next 16: `params`, `searchParams`, `cookies()`, `headers()` are async — always `await` them (or React `use()` in client components)
- Client Firebase calls only in `/lib/firebase/` and `/lib/hooks/` (legacy exception: `app/(app)/[orgSlug]/settings/company/page.tsx` and `settings/categories/page.tsx` still call `updateDoc`/`deleteDoc` directly)
- Server-side Firestore/Auth only through `getAdmin()` from `lib/server/`; route handlers that use it `export const runtime = 'nodejs'`; map errors with `HttpError` + `errorResponse()`
- Browser → API calls that need a user rely on the `__session` cookie (`ebFetch`, same-origin); the route calls `requireUser()` / `requireVerifiedUser()` and then `requireOrgMember()`
- Enable Banking OAuth `state` is HMAC-signed (`lib/server/eb-state.ts`, 15 min) and carries uid + orgId; the callback verifies it, requires the session uid to equal the state uid, and re-checks membership. The bank connection (`/api/enablebanking/session`) needs a verified email (`requireVerifiedUser`, 403 `email_not_verified`); verification is soft everywhere else
- `cn()` from `lib/utils` for className merging
- All dates: `Date` objects in code, Firestore `Timestamp` in DB
- Currency formatting: `Intl.NumberFormat` via `formatCurrency(amount, currency)`
- Before committing: `npm run lint && npm run typecheck && npm run test:unit` (add `npm run check:server-imports` when you touch server dependencies)

## Design System (S01A: Finmap ergonomics, FinFlow look)

### Shell
- `app/(app)/[orgSlug]/layout.tsx` (server) mounts `ShellProvider` (`lib/hooks/useShell.tsx`) and `AppShell` (`components/shell/`). `AppHeader`: wordmark, `OrgSwitcher`, «Дохід / Витрата / Переказ», `ProfileMenu` (`button` «Профіль»: email, «Налаштування», «Вийти»). Below the header a rounded white panel holds the collapsible `AccountsSidebar` and a scrolling content column: `ModuleTabs` «Платежі / Аналітика» (sticky, outside `<main>`), `VerifyEmailBanner`, then `<main>` with the page. Below 1024 px the sidebar is a drawer («☰», a left-anchored Dialog) that closes on a choice, on `Esc`, on a route change and when the window grows past 1024 px.
- Shared state comes from `useShell()`: `orgId`, `org` (only the URL's org, otherwise null), `chooseOrg(id)` (the switcher uses it: navigates and loads the org without flicker), `accounts`, `incomeCategories`/`expenseCategories`, `selectedAccountId`/`selectAccount` (null when the selected account no longer exists; the toolbar account select of the journal and the sidebar are one state), `openTransactionForm(type)`, `openAccountForm(account?)`, `sidebarCollapsed`/`toggleSidebar` (localStorage `finflow:sidebar-collapsed`, in-memory fallback; per browser, not live-synced between tabs), `drawerOpen`. Pages read accounts and categories from it instead of subscribing again (one categories subscription; `useCategories` seeds the default income categories with deterministic ids `default-income-*`, so seeding is idempotent). The forms are rendered once, by `ShellProvider`, and mount on open. The URL's org wins over the org remembered in localStorage.
- Module tabs list only shipped modules (`lib/shell/modules.ts`). Settings sections: `lib/shell/settings-sections.ts` (`settings/layout.tsx` renders the section menu).
- Sidebar total: «Разом у {валюта компанії}», only accounts in the company currency (`summarizeAccounts`); no other currency is mentioned until S04 (conversion).

### Theme
- The signed-in app is light only. `.app-shell` and `:root:has(.app-shell)` pin the shadcn variables to the FinFlow palette (`color-scheme: light`), and `@custom-variant dark` is `&:is(.dark:not(:has(.app-shell)) *)`, i.e. off while a shell is on the page. Portaled dialogs, menus and selects therefore stay light although `next-themes` keeps `dark` on `<html>`. Marketing pages (`/`, `/pricing`) and the auth pages keep light + dark (default dark, `ThemeToggle`).
- Rules: no `dark:` variants in `components/shell/*` and app pages; no hard-coded colours (`bg-[#…]`, `text-[#…]`, inline `color: '#…'`) in app pages and shell components, use the tokens below. Colours chosen by users (account/category `color`) and preset palettes stored on documents are data and stay inline. `components/charts/*`, `TransactionForm`, `AccountForm` and `EnableBankingConnect` still use literal colours (follow-up in `PROGRESS.md`).

### Tokens (`app/globals.css`, Tailwind utilities)
| Token | Value | Use |
|---|---|---|
| `canvas` | #f4f6f5 | app background, day-group rows, hovers |
| `surface` | #ffffff | panels, cards, inputs |
| `line` | #e3e7e5 | borders (`border-line`, `ring-line`) |
| `ink` / `ink-muted` / `ink-subtle` | #17201d / #5f6b66 / #8a9590 | text |
| `brand` / `brand-hover` | #00c896 / #00b584 | primary action (shadcn `--primary` and `--primary-hover` in the shell) |
| `brand-soft` / `brand-soft-hover` / `brand-soft-foreground` | #e6f9f3 / #d2f3e8 / #00875f | soft buttons, selection, active items |
| `income` / `expense` / `expense-soft` | #00a37a / #dc2626 / #fdecec | amounts (`+` green, `−` red, `tabular-nums`) and danger |
| `rounded-control` / `rounded-field` / `rounded-panel` | 8 / 10 / 12 px | buttons and rows / fields and blocks / panels and cards |
| `shadow-panel` / `shadow-pop` | minimal | the shell panel / floating layers |

### Typography
- `Manrope` (`--font-body`) for text, 14 px in the shell; `Unbounded` (`font-display`) only for the wordmark and large headings; both loaded with `next/font/google` in `app/layout.tsx` (latin + cyrillic). Amounts and data always `tabular-nums` (`formatCurrency` for formatting).

### Components
- shadcn `base-nova` primitives in `components/ui`. FinFlow additions are marked `FinFlow (S01A)`: `Button variant="soft"`, the primary hover via `--primary-hover`, `Badge variant="chip"`, and the hand-written `table.tsx` (shadcn table API). Dialog, card, input, select and tabs get their look from the tokens only.
- `cn()` (`lib/utils.ts`) is an `extendTailwindMerge` that knows the token radii and shadows (`rounded-control`, `shadow-pop`, …), so `cn('rounded-lg', 'rounded-control')` keeps only the last one. Add any new token with a utility group to that config.
- One primary action per section; the header CTAs are the exception (they are the app's main entry points).
- Journal: a real table (`components/ui/table.tsx`) grouped by day (`th scope="rowgroup"`), edit on row click or Enter, no delete. Below `sm` the row is account + category on the left, amount on the right; the day total sits in the group header (a day with several currencies shows none).
- Charts: Recharts with custom tooltips; `components/charts/*` keep their own colours and fixed layouts.

### Visual check
- `npm run ui:shots` (see Commands) writes 16 screenshots to `ui-shots/` (gitignored; desktop 1440×900 and phone 390×844) with `dark` forced on `<html>`. Run it after any shell or token change and look at the images before calling a UI task done.

## Banned Copy Phrases
- "seamless", "powerful", "robust", "leverage", "streamline"
- "game-changer", "revolutionary", "cutting-edge"
- "in today's fast-paced world"
- Generic CTAs like "Get Started" → use "Start free trial" or "Try 14 days free"
- No invented testimonials, customer counts or ratings; never advertise a feature that is not shipped

## What NOT to Touch
- `/components/ui/` — shadcn generated files: change them via the CLI; the only hand edits are the `FinFlow (S01A)` variants and `table.tsx` (keep them when regenerating)
- `lib/firebase/firebase.ts` config — environment variables only, no hardcoded keys
- `.env`, `.env.local`, `.secrets/` — never commit, never copy values into code, docs or chat
- The managed block in `AGENTS.md` — written by `next dev`; commit it as is
- The `overrides` entry `jwks-rsa → jose ^5.10.0` in `package.json` and the `check:server-imports` CI step. Why: `firebase-admin` → `jwks-rsa` `require()`s `jose`, and `jose` 6 is ESM-only. Local Node 24 and CI load it through `require(esm)`, but the Vercel runtime has that disabled, so every route importing `firebase-admin/auth` crashed with `ERR_REQUIRE_ESM` in production only. Removing the override (or a `firebase-admin`/`jwks-rsa` upgrade) must pass `npm run check:server-imports`. Add each new CommonJS server dependency to `SERVER_CJS_MODULES` in `scripts/check-server-imports.mjs`.
- `import 'server-only'` in `lib/server/*` and `firebase-admin` imports outside `lib/server/` — client code must never pull in the Admin SDK

## Freemium / Trial Logic
- Today: registration (`lib/firebase/firestore.ts`) stores `plan: 'trial'` and `trialEndsAt` = now + 14 days on the organization; nothing enforces the trial yet
- Clients cannot change `plan`, `trialEndsAt`, `ownerId` or `members` (`firestore.rules`)
- Planned (S17): Stripe billing in PLN, read-only after the trial, `/pricing` redirect
