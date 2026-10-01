# Hisaab — CLAUDE.md

A private, offline income and expense tracker for Android (iOS later).
No login, no server, no network. Open the app and start logging.

**The #1 rule: keep it simple.** This is a small personal app, not a platform.
Write the least code that works. When in doubt, choose the boring option and ask me.

---

## Scope (v1) — build only this

1. **Transactions** — expense, income, or move money between my own accounts.
2. **Accounts** — name and starting balance (e.g. Cash, Bank, Savings). Balance is calculated, never stored.
3. **One app currency** — the user picks it once on first launch and can change it in Settings.
   Every amount in the app is shown in that currency. There is no per-account currency.
4. **Categories** — name, emoji/icon, colour, optional monthly budget. Separate lists for spending and income.
5. **Recurring items** — weekly, monthly or yearly. Logged automatically when the app opens and they're due.
6. **Insights** — for a chosen month: total in, total out, spending by category, last 6 months in vs out.
7. **Export / import** — save all data to a JSON file and restore it (this is the only backup).

### Not in v1 (do not build, do not scaffold, do not "prepare for")
Login, cloud sync, backend, analytics, crash reporting, ads, notifications, passcode/encryption,
multiple currencies, per-account currencies, exchange rates or conversion of any kind, receipts/attachments, split transactions, savings goals, widgets, web version,
i18n, onboarding carousels (the single currency-picker screen is the only first-launch screen), feature flags, theming systems beyond light/dark.

## Stack — use exactly this

- Expo (latest stable SDK), TypeScript, **Expo Router** for navigation
- **expo-sqlite** for storage, with plain SQL in one file
- **date-fns** for dates
- Expo's built-in modules for export/import (expo-file-system, expo-sharing, expo-document-picker)
- **expo-localization** to preselect the currency on first launch
- **expo-splash-screen** to hold the splash until data is ready
- Styling with React Native `StyleSheet` and one `theme.ts` file
- **react-native-gifted-charts** (with `expo-linear-gradient`) for the Insights charts; it draws with `react-native-svg`, which Lucide already needs

### Approved packages
Only the ones above plus what `create-expo-app` installs. **Ask me before adding any other package.**
Specifically do NOT add: Redux, Zustand, TanStack Query, Drizzle or any ORM, NativeWind/Tailwind,
UI kits, other chart libraries, bottom-sheet libraries, form libraries, Axios, lodash, moment.

## Architecture rules

- **One data file:** `src/db.ts` holds the schema, migrations (a simple `user_version` check) and
  every read/write as a plain async function (`addTransaction`, `getMonthSummary`, …). Screens never write SQL.
- **State:** screens load data with a small `useData(fn)` hook. No global store. Local UI state = `useState`.
- **Every change shows up instantly, everywhere — no refresh, no navigating away and back.**
  How: `src/db.ts` keeps a `version` number and a list of listeners. Every write function
  (add/edit/delete of any transaction, account, category, recurring item, settings, import)
  bumps `version` and notifies listeners *after* the write succeeds. `useData(fn)` subscribes on mount
  and re-runs `fn` whenever `version` changes, so every screen that is already open — including the
  tab behind a modal — updates immediately. It also re-runs on screen focus as a safety net.
  No pull-to-refresh, no manual reload buttons, no optimistic copies of data in component state.
- **Acceptance check (must pass before any step is done):** with Home open, add an expense from the
  modal → on Save the modal closes and Home already shows the new balance, the new row in Recent and
  the updated "this month" total. Same for edit and delete from the detail screen, and for Activity,
  Recurring and Insights if they are open in the background.
- **Money:** store every amount as an integer × 100 (`2,450` → `245000`), whatever the currency, so
  changing currency never breaks stored data. All formatting goes through one `formatMoney(minor)` in
  `src/money.ts`, which reads the app currency from settings.
- **Currency:** one app-wide currency stored in `settings` as `currency` (a code like `PKR`).
  `src/money.ts` holds a short hard-coded list of about 15 currencies with code, symbol and how many
  decimals to *display* (PKR, INR, JPY: 0; USD, GBP, EUR, AED, SAR: 2; …). No currency library.
  - **First launch:** one screen, "Which currency do you use?", with the likely currency preselected
    and a Continue button. Nothing else on that screen. It never shows again.
  - **Preselecting the currency:** read the phone's region settings with `expo-localization`
    (`getLocales()[0]`). Use its `currencyCode` if it is in our list; otherwise map `regionCode`
    (PK → PKR, IN → INR, US → USD, GB → GBP, AE → AED, SA → SAR, …); otherwise fall back to USD.
    Put this in one pure function `guessCurrency(locale)` in `src/money.ts` with unit tests.
    **Never** use GPS/location permission, IP lookup or any network call for this. The user can
    always pick a different currency, so the guess only saves them a tap.
  - **Changing it later** (Settings) only changes the symbol and formatting. It does **not** convert
    amounts: 5,000 PKR becomes 5,000 USD. Show a confirmation that says exactly that before saving.
  - Changing currency is a write, so every open screen updates instantly (see above).
  - The amount keypad only allows decimals when the currency displays them (no `.` key for PKR).
- **Transfers are not spending or income.** Never count them in In/Out totals.
- **Loading:** the app is offline and local, so screens should never visibly load. Keep the splash screen
  up (`expo-splash-screen`, preventAutoHideAsync) until the database is open, migrations have run and
  due recurring items are logged. Then hide it, so Home appears already filled in. While `useData` is
  still loading, render nothing for that section (no spinner, no skeleton), so there's no flash.
  The only visible progress is for import and export: the button shows "Importing…" / "Exporting…".
- **Charts:** Insights uses `react-native-gifted-charts` only. Simple bars elsewhere (e.g. the category split bar) stay plain `View`s.
- **Sheets/modals:** use Expo Router's modal presentation. No custom animation work.
- No network calls anywhere. No `fetch`.

## Guardrails — what "simple" means here

### File budget
Only these files outside `app/`. A new file needs my OK, with one line saying why.
```
src/db.ts          schema, migrations, every query and write, change listeners
src/useData.ts     the one data hook
src/money.ts       currency list, formatMoney, parseAmount, guessCurrency
src/dates.ts       today(), month helpers, nextOccurrence() for recurring
src/theme.ts       colours (light + dark), spacing, font sizes
src/types.ts       Account, Category, Transaction, Recurring
src/components/    only pieces used on 2+ screens (e.g. Row, Button, AmountText, Keypad)
src/__tests__/     tests for money, dates, db change listeners
```
- A file over ~250 lines means it's doing too much. Tell me, don't split it silently.
- No `services/`, `hooks/`, `utils/`, `lib/`, `constants/`, `context/`, `store/` or `features/` folders.

### No speculative code
- Don't add repositories, service layers, dependency injection, providers or context, event buses,
  factories, generic `<DataTable>`-style components, or component "variants" nobody asked for.
- Don't add optional props, config options or parameters for cases that don't exist yet.
- No `React.memo`, `useMemo` or `useCallback` unless a list is visibly slow. `FlatList` is fine.
- No placeholder screens, "coming soon" sections, TODO stubs or commented-out code.
- No mock or sample data in app code.
- Types live in `types.ts` as plain TypeScript types. No zod, no runtime schema libraries,
  no enums: use string unions.

### Stay in the lane
- Only touch the files the current step needs. No drive-by refactors, renames, reformatting or
  "improvements" to earlier steps unless I ask.
- Stay in Expo's managed workflow: no `expo prebuild`, no `android/` or `ios/` folders, no native
  modules, no custom config plugins.
- No new tooling: no ESLint or Prettier config changes, Husky, Storybook, Detox, CI files, Docker,
  monorepo setup or path-alias config. Tests run on `jest-expo` only.
- Install packages only with `npx expo install` so versions match the SDK.

### Data rules
- IDs are SQLite `INTEGER PRIMARY KEY AUTOINCREMENT`. No UUID library.
- Dates are local `YYYY-MM-DD` strings. No time zones, no UTC conversion, no timestamps in the UI.
  "Today" = the phone's local date, from one `today()` function.
- Totals and balances use SQL `SUM` in `db.ts`. Never load every transaction into JS just to add them up.
- Migrations only add things. Never drop a table or column that holds user data.
- Every write that changes more than one row (delete account, delete category, import) runs in a
  single SQL transaction, so a failure changes nothing.

### Errors and copy
- Show errors as one plain sentence next to the field, e.g. "Enter an amount above zero."
  No custom error classes, no logging framework, no toast library.
- Deletes ask first with a simple native `Alert.alert`.
- Write UI text as plain English strings in the screen file. No i18n, no strings file.
- Icon-only buttons get an `accessibilityLabel`. Touch targets are at least 44×44.

### When stuck
- If the same error survives 3 attempts, stop. Explain what you tried and what you think is wrong.
- If the plan in this file conflicts with what you find in the Expo docs, tell me and wait.
- Never "fix" a problem by adding a package, disabling TypeScript checks (`any`, `@ts-ignore`) or
  skipping a test.

## Data model

```sql
accounts     (id, name, type['cash'|'debit'|'savings'|'credit'], opening_minor, color,
              limit_minor NULL, due_day NULL, created_at)   -- limit and due day: credit cards only
categories   (id, name, kind['expense'|'income'], icon, color, budget_minor NULL, is_default)
transactions (id, type['expense'|'income'|'transfer'], amount_minor, account_id,
              to_account_id NULL, category_id NULL,
              note, date 'YYYY-MM-DD', recurring_id NULL, created_at)
recurring    (id, name, type['expense'|'income'], amount_minor, account_id, category_id,
              freq['weekly'|'monthly'|'yearly'], anchor_day, next_date, active)
settings     (key, value)   -- currency, theme, onboarded
```
Deleting a category moves its transactions to "Other". Deleting an account asks first and
deletes its transactions. Seed default categories on first launch: Groceries, Dining out,
Transport, Bills, Rent, Mobile & internet, Subscriptions, Shopping, Health, Family, Other /
Salary, Freelance, Gifts, Other income. Seed one account called "Cash".
A transfer moves the same amount out of one account and into the other.
A credit card stores what is owed as a negative `opening_minor`, so balances and transfers work as for any account.
It has a required limit and payment due day. Warn from 80% of the limit used (red from 95%). Adding or editing an
expense or transfer-out that would push the card past its limit is refused. Payments and refunds are always
allowed, and recurring items log regardless because the charge already happened.

## Screens (Expo Router)

```
app/(tabs)/index.tsx       Home: total balance, accounts, this month, upcoming, recent
app/(tabs)/activity.tsx    All transactions, search, filter by month/type
app/(tabs)/recurring.tsx   Upcoming 30 days + list
app/(tabs)/insights.tsx    Month picker, totals, by-category bars, 6-month bars
app/add.tsx                Modal: amount → type/account → category → note/date → Save (one screen is fine)
app/transaction/[id].tsx   Detail, edit, delete
app/account/[id].tsx       Add/edit account (id = "new" for create)
app/category/[id].tsx      Add/edit category
app/recurring/[id].tsx     Add/edit recurring item
app/welcome.tsx            First launch only: pick currency
app/settings.tsx           Currency, categories list, export, import, delete all data
```
Design reference: `design/prototype.html` (Family-inspired: plain white canvas, black type, round colour
category icons, icon-only tab bar with a floating black + button, and every action in a black floating
sheet with a huge centred amount and a plain-digit keypad). Match the feel, not every detail.

## How to work with me

- **Before each step:** list the files you'll create or change and any package you'll install, then
  wait for my OK.
- Build **one step at a time** in this order and **stop after each step** so I can test on my phone:
  1. Project setup, `theme.ts`, `money.ts`, `db.ts` with schema + seed, welcome/currency screen,
     tests for money formatting (0 and 2 decimal currencies) + dates
  2. Add transaction + Home (balances, recent list)
  3. Activity + transaction detail/edit/delete
  4. Accounts + categories
  5. Recurring (auto-log on app open) + tests for next-date logic (month-end, leap year)
  6. Insights
  7. Export / import + settings
- Keep files small and flat. No abstraction until the same code appears three times.
- Write tests only for pure logic (`money.ts`, recurring dates, month totals). No UI tests.
- Before finishing a step: run `npx tsc --noEmit` and the tests, confirm the acceptance check under
  Architecture rules still holds, and tell me what to try in the app.
- Add a unit test that a write bumps `version` and calls listeners, and that a failed write does not.
- If something in this file seems wrong or you want to add scope, **ask instead of doing it**.
- **After each step:** give me a short summary of the files changed, what to test on the phone, and
  anything you left out on purpose. Then commit with a one-line message. Don't commit if tests fail.
