import { openDatabaseAsync } from 'expo-sqlite';
import { dayOfPeriod, firstOnOrAfter, keyRanges, lastMonths, nextOccurrence, periodBounds, periodDayCount, periodOf, shiftDays, today } from './dates';
import type { DayRange, PayCalendar } from './dates';
import { formatMoney, setAppCurrency } from './money';
import { ICON_NAMES, toEmoji } from './emoji';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, SCHEMA } from './seed';
import { BACKUP_VERSION } from './backup';
import type { Backup } from './backup';
import type { Account, Category, CategorySpend, DaySpend, InsightsData, MonthTotals, NetWorthTrend, Payday, Recurring, RecurringRow, Transaction, ThemeSetting, TransactionFilter, TransactionRow } from './types';

// The small part of expo-sqlite that we use, so tests can pass a fake.
export type Db = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

// In development, Fast Refresh runs this file again after an edit, which would reset `db` to null while the screens
// are still on screen and asking for data. The open handle is kept on globalThis so it survives that.
const kept = globalThis as typeof globalThis & { hisaabDb?: Db };
let db: Db | null = kept.hisaabDb ?? null;
let version = 0;
const listeners = new Set<() => void>();

export function getVersion() {
  return version;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The pay calendar, kept in memory so the period helpers can stay synchronous. Loaded on open and after every write.
let cal: PayCalendar = { startDay: 1, starts: null };

async function refreshCalendar() {
  const payday = await getPayday();
  if (payday.mode === 'start') {
    cal = { startDay: payday.startDay, starts: null };
    return;
  }
  const picked = payday.salaryId === null ? null : await db!.getFirstAsync<{ date: string }>(
    "SELECT date FROM transactions WHERE id = ? AND type = 'income' AND is_salary = 1", payday.salaryId,
  );
  if (!picked) {
    cal = { startDay: 1, starts: null };
    return;
  }
  // Each salary from the picked one on starts a period. Later salaries are picked up on the next write.
  const rows = await db!.getAllAsync<{ date: string }>(
    "SELECT DISTINCT date FROM transactions WHERE type = 'income' AND is_salary = 1 AND date >= ? ORDER BY date", picked.date,
  );
  cal = { startDay: 1, starts: rows.map((r) => r.date) };
}

// The period today is in, as its name (the month it ends in). Used for "this month" everywhere.
export function currentPeriodKey(): string {
  return periodOf(today(), cal).key;
}

// The first and last day of a period, for the period picker and the charts.
export function periodDates(key: string): DayRange {
  return periodBounds(key, cal);
}

// How many days a period has. Charts use this for their width.
export function periodDays(key: string): number {
  return periodDayCount(key, cal);
}

// How many days of the current period have passed, today included. Charts compare against this.
export function periodElapsed(): number {
  return dayOfPeriod(today(), cal);
}

// SQL for "the date is in one of these ranges". No ranges matches nothing.
function inRanges(ranges: DayRange[], column = 'date'): { sql: string; params: string[] } {
  if (ranges.length === 0) return { sql: '0', params: [] };
  return {
    sql: `(${ranges.map(() => `${column} BETWEEN ? AND ?`).join(' OR ')})`,
    params: ranges.flatMap((r) => [r.start, r.end]),
  };
}

// Every write goes through here: bump the version and tell listeners only after it succeeded.
async function write<T>(task: (db: Db) => Promise<T>): Promise<T> {
  const result = await task(db!);
  await refreshCalendar();
  version += 1;
  listeners.forEach((listener) => listener());
  return result;
}

// Migrations only add things. Each step runs once, guarded by PRAGMA user_version.
async function migrate(handle: Db) {
  const row = await handle.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) await migrateToV1(handle);
  if (version < 2) await migrateToV2(handle);
  if (version < 3) await migrateToV3(handle);
  if (version < 4) await migrateToV4(handle);
  if (version < 5) await migrateToV5(handle);
  if (version < 6) await migrateToV6(handle);
  if (version < 7) await migrateToV7(handle);
}

// The default categories and the "Cash" account. Used for a new database and after "Delete all data".
async function seedDefaults(handle: Db) {
  const insertCategory = 'INSERT INTO categories (name, kind, icon, color, is_default) VALUES (?, ?, ?, ?, ?)';
  for (const [name, icon, color] of EXPENSE_CATEGORIES) {
    await handle.runAsync(insertCategory, name, 'expense', toEmoji(icon), color, name === 'Other' ? 1 : 0);
  }
  for (const [name, icon, color] of INCOME_CATEGORIES) {
    await handle.runAsync(insertCategory, name, 'income', toEmoji(icon), color, name === 'Other income' ? 1 : 0);
  }
  await handle.runAsync(
    'INSERT INTO accounts (name, opening_minor, color, created_at) VALUES (?, ?, ?, ?)',
    'Cash', 0, '#FF9F0A', new Date().toISOString(),
  );
}

async function migrateToV1(handle: Db) {
  await handle.withTransactionAsync(async () => {
    await handle.execAsync(SCHEMA);
    await seedDefaults(handle);
    await handle.execAsync('PRAGMA user_version = 1');
  });
}

// Databases created before Lucide icons hold emoji in categories.icon. Set the icon by name.
async function migrateToV2(handle: Db) {
  await handle.withTransactionAsync(async () => {
    const update = 'UPDATE categories SET icon = ? WHERE name = ? AND kind = ?';
    for (const [name, icon] of EXPENSE_CATEGORIES) await handle.runAsync(update, icon, name, 'expense');
    for (const [name, icon] of INCOME_CATEGORIES) await handle.runAsync(update, icon, name, 'income');
    await handle.execAsync('PRAGMA user_version = 2');
  });
}

// Accounts get a type. Existing accounts become 'cash'.
async function migrateToV3(handle: Db) {
  await handle.withTransactionAsync(async () => {
    await handle.execAsync("ALTER TABLE accounts ADD COLUMN type TEXT NOT NULL DEFAULT 'cash'");
    await handle.execAsync('PRAGMA user_version = 3');
  });
}

// Credit cards get a limit and a payment due day. Other accounts leave both empty.
async function migrateToV4(handle: Db) {
  await handle.withTransactionAsync(async () => {
    await handle.execAsync('ALTER TABLE accounts ADD COLUMN limit_minor INTEGER');
    await handle.execAsync('ALTER TABLE accounts ADD COLUMN due_day INTEGER');
    await handle.execAsync('PRAGMA user_version = 4');
  });
}

// Categories get a manual order. Existing ones keep the order they had (by id).
async function migrateToV5(handle: Db) {
  await handle.withTransactionAsync(async () => {
    await handle.execAsync('ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
    await handle.execAsync('UPDATE categories SET sort_order = id');
    await handle.execAsync('PRAGMA user_version = 5');
  });
}

// Categories use emoji instead of icons. Every icon name becomes its emoji; custom categories keep their look.
async function migrateToV6(handle: Db) {
  await handle.withTransactionAsync(async () => {
    for (const name of ICON_NAMES) await handle.runAsync('UPDATE categories SET icon = ? WHERE icon = ?', toEmoji(name), name);
    await handle.execAsync('PRAGMA user_version = 6');
  });
}

// Salary transactions and recurring items can be marked as salary, which sets when a pay period starts.
async function migrateToV7(handle: Db) {
  await handle.withTransactionAsync(async () => {
    await handle.execAsync('ALTER TABLE transactions ADD COLUMN is_salary INTEGER NOT NULL DEFAULT 0');
    await handle.execAsync('ALTER TABLE recurring ADD COLUMN is_salary INTEGER NOT NULL DEFAULT 0');
    await handle.execAsync('PRAGMA user_version = 7');
  });
}

export async function openDb(handle?: Db) {
  // A new connection per app session. expo-sqlite otherwise reuses one native connection across JS reloads
  // (Expo Go, Fast Refresh) and closes it when the old session's object is released, which crashes the next query.
  // The file is still called hisaab.db so phones that already have data keep it.
  db = handle ?? (await openDatabaseAsync('hisaab.db', { useNewConnection: true }));
  kept.hisaabDb = db;
  await migrate(db);
  await refreshCalendar();
  setAppCurrency((await getSetting('currency')) ?? 'USD');
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await db!.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

const UPSERT_SETTING = 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)';

export async function setCurrency(code: string) {
  await write(async (handle) => {
    await handle.runAsync(UPSERT_SETTING, 'currency', code);
    setAppCurrency(code);
  });
}

export async function setTheme(theme: ThemeSetting) {
  await write((handle) => handle.runAsync(UPSERT_SETTING, 'theme', theme));
}

// Settings keys: payday_mode ('start' when unset), payday_start_day (1 when unset), payday_salary_id.
export async function getPayday(): Promise<Payday> {
  if ((await getSetting('payday_mode')) === 'salary') {
    const salaryId = await getSetting('payday_salary_id');
    return { mode: 'salary', salaryId: salaryId === null ? null : Number(salaryId) };
  }
  return { mode: 'start', startDay: Number((await getSetting('payday_start_day')) ?? 1) };
}

export async function setPayday(p: Payday) {
  await write((handle) =>
    handle.withTransactionAsync(async () => {
      if (p.mode === 'start') {
        await handle.runAsync(UPSERT_SETTING, 'payday_mode', 'start');
        await handle.runAsync(UPSERT_SETTING, 'payday_start_day', String(p.startDay));
      } else {
        await handle.runAsync(UPSERT_SETTING, 'payday_mode', 'salary');
        if (p.salaryId !== null) await handle.runAsync(UPSERT_SETTING, 'payday_salary_id', String(p.salaryId));
      }
    }),
  );
}

// Income marked as salary, newest first. The Payday form picks the one a period starts from.
export async function getSalaryTransactions(): Promise<TransactionRow[]> {
  return db!.getAllAsync(`${TX_SELECT} ${TX_FROM} WHERE t.type = 'income' AND t.is_salary = 1 ORDER BY t.date DESC, t.id DESC`);
}

export async function setHideBalances(on: boolean) {
  await write((handle) => handle.runAsync(UPSERT_SETTING, 'hide_balances', on ? '1' : '0'));
}

// First launch: save the chosen currency and mark the welcome screen as done, together.
export async function completeWelcome(code: string) {
  await write(async (handle) => {
    await handle.withTransactionAsync(async () => {
      await handle.runAsync(UPSERT_SETTING, 'currency', code);
      await handle.runAsync(UPSERT_SETTING, 'onboarded', '1');
    });
    setAppCurrency(code);
  });
}

export async function isOnboarded(): Promise<boolean> {
  return (await getSetting('onboarded')) === '1';
}

export type NewTransaction = Pick<
  Transaction,
  'type' | 'amount_minor' | 'account_id' | 'to_account_id' | 'category_id' | 'note' | 'date' | 'is_salary'
>;

export const isOverLimit = (e: unknown): e is Error => e instanceof Error && e.name === 'OverLimit';

// What a transaction does to one account's balance.
function balanceEffect(accountId: number, t: Pick<Transaction, 'type' | 'amount_minor' | 'account_id' | 'to_account_id'>) {
  let effect = 0;
  if (t.account_id === accountId) effect += t.type === 'income' ? t.amount_minor : -t.amount_minor;
  if (t.type === 'transfer' && t.to_account_id === accountId) effect += t.amount_minor;
  return effect;
}

// Refuses a change that pushes a credit card past its limit. A change that doesn't raise what is owed is always fine,
// so a card that is already over (a recurring charge landed) can still have its notes edited or be paid off.
// Pass `editingId` when t replaces an existing transaction. Recurring items log without this check: they already happened.
export async function checkCreditLimit(t: NewTransaction, editingId?: number) {
  const old = editingId
    ? await db!.getFirstAsync<Pick<Transaction, 'type' | 'amount_minor' | 'account_id' | 'to_account_id'>>(
        'SELECT type, amount_minor, account_id, to_account_id FROM transactions WHERE id = ?', editingId,
      )
    : null;
  const ids = new Set([t.account_id, t.to_account_id, old?.account_id, old?.to_account_id]);
  for (const id of ids) {
    if (id === null || id === undefined) continue;
    const card = await db!.getFirstAsync<{ name: string; type: string; limit_minor: number | null; balance_minor: number }>(
      `SELECT a.name, a.type, a.limit_minor, ${BALANCE} AS balance_minor FROM accounts a WHERE a.id = ?`, id,
    );
    if (!card || card.type !== 'credit' || card.limit_minor === null) continue;
    const owedBefore = -card.balance_minor;
    const owedAfter = owedBefore - (balanceEffect(id, t) - (old ? balanceEffect(id, old) : 0));
    if (owedAfter > card.limit_minor && owedAfter > owedBefore) {
      const left = Math.max(0, card.limit_minor - owedBefore);
      const error = new Error(
        left === 0
          ? `${card.name} is at its limit. Raise the limit on the account to record this.`
          : `That is more than the ${formatMoney(left)} left on ${card.name}. Raise the limit on the account to record it.`,
      );
      error.name = 'OverLimit';
      throw error;
    }
  }
}

export async function addTransaction(t: NewTransaction) {
  await checkCreditLimit(t);
  await write((handle) =>
    handle.runAsync(
      `INSERT INTO transactions (type, amount_minor, account_id, to_account_id, category_id, note, date, is_salary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      t.type, t.amount_minor, t.account_id, t.to_account_id, t.category_id, t.note, t.date, t.is_salary,
      new Date().toISOString(),
    ),
  );
}

// Balance = opening + income - expense - transfers out + transfers in. Never stored. Needs the accounts table aliased as `a`.
const BALANCE = `(a.opening_minor
  + COALESCE((SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount_minor ELSE -t.amount_minor END)
              FROM transactions t WHERE t.account_id = a.id), 0)
  + COALESCE((SELECT SUM(t.amount_minor) FROM transactions t
              WHERE t.type = 'transfer' AND t.to_account_id = a.id), 0))`;

export async function getAccountsWithBalance(): Promise<(Account & { balance_minor: number })[]> {
  return db!.getAllAsync(`SELECT a.*, ${BALANCE} AS balance_minor FROM accounts a ORDER BY a.id`);
}

// Own order first; the two "Other" categories always come last. Equal orders fall back to id.
export async function getCategories(): Promise<Category[]> {
  return db!.getAllAsync('SELECT * FROM categories ORDER BY is_default, sort_order, id');
}

// Transfers are not income or spending, so they are left out.
export async function getMonthSummary(month: string): Promise<{ in_minor: number; out_minor: number }> {
  const r = inRanges(keyRanges(month, cal));
  const row = await db!.getFirstAsync<{ in_minor: number; out_minor: number }>(
    `SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount_minor END), 0) AS in_minor,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_minor END), 0) AS out_minor
     FROM transactions WHERE ${r.sql}`,
    ...r.params,
  );
  return row ?? { in_minor: 0, out_minor: 0 };
}

const TX_SELECT = `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
       a.name AS account_name, b.name AS to_account_name, rc.name AS recurring_name, rc.freq AS recurring_freq`;
const TX_FROM = `FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN accounts b ON b.id = t.to_account_id
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN recurring rc ON rc.id = t.recurring_id`;

export const NO_FILTER: TransactionFilter = { search: '', type: 'all', month: null, categoryId: null, accountId: null };

// The WHERE part shared by the Activity list and its totals. Search looks at note, category and account names.
export function buildFilter(filter: TransactionFilter): { where: string; params: (string | number)[] } {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (filter.type !== 'all') {
    clauses.push('t.type = ?');
    params.push(filter.type);
  }
  if (filter.month) {
    const r = inRanges(keyRanges(filter.month, cal), 't.date');
    clauses.push(r.sql);
    params.push(...r.params);
  }
  if (filter.categoryId !== null) {
    clauses.push('t.category_id = ?');
    params.push(filter.categoryId);
  }
  if (filter.accountId !== null) {
    clauses.push('(t.account_id = ? OR t.to_account_id = ?)');
    params.push(filter.accountId, filter.accountId);
  }
  const search = filter.search.trim();
  if (search) {
    const like = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    const columns = ['t.note', 'c.name', 'a.name', 'b.name'];
    clauses.push('(' + columns.map((col) => `${col} LIKE ? ESCAPE '\\'`).join(' OR ') + ')');
    params.push(like, like, like, like);
  }
  return { where: clauses.length ? 'WHERE ' + clauses.join(' AND ') : '', params };
}

export async function getTransactions(filter: TransactionFilter, limit: number): Promise<TransactionRow[]> {
  const { where, params } = buildFilter(filter);
  return db!.getAllAsync(
    `${TX_SELECT} ${TX_FROM} ${where} ORDER BY t.date DESC, t.id DESC LIMIT ?`,
    ...params, limit,
  );
}

// Count, money in and money out for the same filter. Transfers are counted but are not in or out.
export async function getTransactionTotals(
  filter: TransactionFilter,
): Promise<{ count: number; in_minor: number; out_minor: number }> {
  const { where, params } = buildFilter(filter);
  const row = await db!.getFirstAsync<{ count: number; in_minor: number; out_minor: number }>(
    `SELECT COUNT(*) AS count,
            COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount_minor END), 0) AS in_minor,
            COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount_minor END), 0) AS out_minor
     ${TX_FROM} ${where}`,
    ...params,
  );
  return row ?? { count: 0, in_minor: 0, out_minor: 0 };
}

// The months that have at least one transaction, newest first, for the Month filter.
export async function getTransactionMonths(): Promise<string[]> {
  const rows = await db!.getAllAsync<{ date: string }>('SELECT DISTINCT date FROM transactions');
  return [...new Set(rows.map((r) => periodOf(r.date, cal).key))].sort().reverse();
}

export async function getTransaction(id: number): Promise<TransactionRow | null> {
  return db!.getFirstAsync(`${TX_SELECT} ${TX_FROM} WHERE t.id = ?`, id);
}

export async function updateTransaction(id: number, t: NewTransaction) {
  await checkCreditLimit(t, id);
  await write((handle) =>
    handle.runAsync(
      `UPDATE transactions SET type = ?, amount_minor = ?, account_id = ?, to_account_id = ?,
              category_id = ?, note = ?, date = ?, is_salary = ? WHERE id = ?`,
      t.type, t.amount_minor, t.account_id, t.to_account_id, t.category_id, t.note, t.date, t.is_salary, id,
    ),
  );
}

export async function deleteTransaction(id: number) {
  await write((handle) => handle.runAsync('DELETE FROM transactions WHERE id = ?', id));
}

export type NewAccount = Pick<Account, 'name' | 'type' | 'opening_minor' | 'color' | 'limit_minor' | 'due_day'>;

export async function getAccount(id: number): Promise<Account | null> {
  return db!.getFirstAsync('SELECT * FROM accounts WHERE id = ?', id);
}

// For the account detail sheet: how many transactions touch the account, and what it spent and received in `month`.
export async function getAccountStats(id: number, month: string): Promise<{ count: number; spent_minor: number; in_minor: number }> {
  const r = inRanges(keyRanges(month, cal));
  const row = await db!.getFirstAsync<{ count: number; spent_minor: number; in_minor: number }>(
    `SELECT COUNT(*) AS count,
       COALESCE(SUM(CASE WHEN type = 'expense' AND ${r.sql} THEN amount_minor END), 0) AS spent_minor,
       COALESCE(SUM(CASE WHEN type = 'income' AND ${r.sql} THEN amount_minor END), 0) AS in_minor
     FROM transactions WHERE account_id = ? OR to_account_id = ?`,
    ...r.params, ...r.params, id, id,
  );
  return row ?? { count: 0, spent_minor: 0, in_minor: 0 };
}

export async function addAccount(a: NewAccount) {
  await write((handle) =>
    handle.runAsync(
      'INSERT INTO accounts (name, type, opening_minor, color, limit_minor, due_day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      a.name, a.type, a.opening_minor, a.color, a.limit_minor, a.due_day, new Date().toISOString(),
    ),
  );
}

export async function updateAccount(id: number, a: NewAccount) {
  await write((handle) =>
    handle.runAsync(
      'UPDATE accounts SET name = ?, type = ?, opening_minor = ?, color = ?, limit_minor = ?, due_day = ? WHERE id = ?',
      a.name, a.type, a.opening_minor, a.color, a.limit_minor, a.due_day, id,
    ),
  );
}

// Removes the account together with every transaction and recurring item that uses it.
export async function deleteAccount(id: number) {
  await write((handle) =>
    handle.withTransactionAsync(async () => {
      await handle.runAsync('DELETE FROM transactions WHERE account_id = ? OR to_account_id = ?', id, id);
      await handle.runAsync('DELETE FROM recurring WHERE account_id = ?', id);
      await handle.runAsync('DELETE FROM accounts WHERE id = ?', id);
    }),
  );
}

export type NewCategory = Pick<Category, 'name' | 'kind' | 'icon' | 'color' | 'budget_minor'>;

export async function getCategory(id: number): Promise<Category | null> {
  return db!.getFirstAsync('SELECT * FROM categories WHERE id = ?', id);
}

export async function addCategory(c: NewCategory) {
  await write((handle) =>
    handle.runAsync(
      `INSERT INTO categories (name, kind, icon, color, budget_minor, is_default, sort_order)
       VALUES (?, ?, ?, ?, ?, 0, COALESCE((SELECT MIN(sort_order) FROM categories WHERE kind = ?), 0) - 1)`,
      c.name, c.kind, c.icon, c.color, c.budget_minor, c.kind,
    ),
  );
}

// ids is one kind's categories in their new order (without the Other category, which stays last).
export async function reorderCategories(ids: number[]) {
  await write((handle) =>
    handle.withTransactionAsync(async () => {
      for (const [position, id] of ids.entries()) {
        await handle.runAsync('UPDATE categories SET sort_order = ? WHERE id = ?', position, id);
      }
    }),
  );
}

// The kind of a category never changes after it is created.
export async function updateCategory(id: number, c: Omit<NewCategory, 'kind'>) {
  await write((handle) =>
    handle.runAsync(
      'UPDATE categories SET name = ?, icon = ?, color = ?, budget_minor = ? WHERE id = ?',
      c.name, c.icon, c.color, c.budget_minor, id,
    ),
  );
}

// Its transactions and recurring items move to the "Other" category of the same kind.
export async function deleteCategory(id: number) {
  await write(async (handle) => {
    const category = await handle.getFirstAsync<{ kind: string; is_default: number }>(
      'SELECT kind, is_default FROM categories WHERE id = ?', id,
    );
    if (!category || category.is_default) throw new Error('This category cannot be deleted.');
    const other = await handle.getFirstAsync<{ id: number }>(
      'SELECT id FROM categories WHERE kind = ? AND is_default = 1', category.kind,
    );
    if (!other) throw new Error('The Other category is missing.');
    await handle.withTransactionAsync(async () => {
      await handle.runAsync('UPDATE transactions SET category_id = ? WHERE category_id = ?', other.id, id);
      await handle.runAsync('UPDATE recurring SET category_id = ? WHERE category_id = ?', other.id, id);
      await handle.runAsync('DELETE FROM categories WHERE id = ?', id);
    });
  });
}

export type NewRecurring = Pick<
  Recurring,
  'name' | 'type' | 'amount_minor' | 'account_id' | 'category_id' | 'freq' | 'anchor_day' | 'next_date' | 'active' | 'is_salary'
>;

// How many active items are due on the given day but not logged yet. The Recurring tab shows a dot for tomorrow.
export async function countRecurringDueOn(day: string): Promise<number> {
  const row = await db!.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM recurring WHERE active = 1 AND next_date = ?', day,
  );
  return row?.count ?? 0;
}

export async function getRecurring(): Promise<RecurringRow[]> {
  return db!.getAllAsync(
    `SELECT r.*, a.name AS account_name, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
     FROM recurring r
     JOIN accounts a ON a.id = r.account_id
     JOIN categories c ON c.id = r.category_id
     ORDER BY r.active DESC, r.next_date, r.id`,
  );
}

// What recurring items have already logged in a month, for the Recurring calendar.
export async function getMonthRecurringActivity(month: string): Promise<TransactionRow[]> {
  const r = inRanges(keyRanges(month, cal), 't.date');
  return db!.getAllAsync(
    `${TX_SELECT} ${TX_FROM} WHERE t.recurring_id IS NOT NULL AND ${r.sql} ORDER BY t.date, t.id`,
    ...r.params,
  );
}

export async function getRecurringItem(id: number): Promise<Recurring | null> {
  return db!.getFirstAsync('SELECT * FROM recurring WHERE id = ?', id);
}

// One transaction for a recurring item on the given date.
async function insertOccurrence(handle: Db, item: Recurring, date: string) {
  await handle.runAsync(
    `INSERT INTO transactions (type, amount_minor, account_id, to_account_id, category_id, note, date, recurring_id, is_salary, created_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
    item.type, item.amount_minor, item.account_id, item.category_id, item.name, date, item.id, item.is_salary,
    new Date().toISOString(),
  );
}

// Logs one transaction for every date an active item has come due, then moves its next_date past today.
// Runs inside the caller's SQL transaction.
async function logDue(handle: Db) {
  const day = today();
  const due = await handle.getAllAsync<Recurring>('SELECT * FROM recurring WHERE active = 1 AND next_date <= ?', day);
  for (const item of due) {
    let next = item.next_date;
    while (next <= day) {
      await insertOccurrence(handle, item, next);
      next = nextOccurrence(item.freq, item.anchor_day, next);
    }
    await handle.runAsync('UPDATE recurring SET next_date = ? WHERE id = ?', next, item.id);
  }
}

// Called when the app opens or comes back to the foreground. Writes (and notifies) only if something is due.
export async function logDueRecurring() {
  const row = await db!.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM recurring WHERE active = 1 AND next_date <= ?', today(),
  );
  if (!row || row.count === 0) return;
  await write((handle) => handle.withTransactionAsync(() => logDue(handle)));
}

const INSERT_RECURRING = `INSERT INTO recurring (name, type, amount_minor, account_id, category_id, freq, anchor_day, next_date, active, is_salary)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export async function addRecurring(r: NewRecurring) {
  await write((handle) =>
    handle.withTransactionAsync(async () => {
      await handle.runAsync(
        INSERT_RECURRING,
        r.name, r.type, r.amount_minor, r.account_id, r.category_id, r.freq, r.anchor_day, r.next_date, r.active, r.is_salary,
      );
      await logDue(handle);
    }),
  );
}

export async function updateRecurring(id: number, r: NewRecurring) {
  await write((handle) =>
    handle.withTransactionAsync(async () => {
      await handle.runAsync(
        `UPDATE recurring SET name = ?, type = ?, amount_minor = ?, account_id = ?, category_id = ?, freq = ?,
                anchor_day = ?, next_date = ?, active = ?, is_salary = ? WHERE id = ?`,
        r.name, r.type, r.amount_minor, r.account_id, r.category_id, r.freq, r.anchor_day, r.next_date, r.active, r.is_salary, id,
      );
      await logDue(handle);
    }),
  );
}

// Transactions it already logged stay; they just stop pointing at it.
export async function deleteRecurring(id: number) {
  await write((handle) =>
    handle.withTransactionAsync(async () => {
      await handle.runAsync('UPDATE transactions SET recurring_id = NULL WHERE recurring_id = ?', id);
      await handle.runAsync('DELETE FROM recurring WHERE id = ?', id);
    }),
  );
}

// Spending (or income) per category for a period, biggest first.
export async function getTotalsByCategory(kind: 'expense' | 'income', month: string): Promise<CategorySpend[]> {
  const r = inRanges(keyRanges(month, cal), 't.date');
  return db!.getAllAsync(
    `SELECT c.id, c.name, c.icon, c.color, c.budget_minor, SUM(t.amount_minor) AS total_minor, COUNT(*) AS count
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.type = ? AND ${r.sql}
     GROUP BY c.id ORDER BY total_minor DESC`,
    kind, ...r.params,
  );
}

// The month of the oldest transaction, or null when there are none.
export async function getEarliestMonth(): Promise<string | null> {
  const row = await db!.getFirstAsync<{ date: string | null }>('SELECT MIN(date) AS date FROM transactions');
  return row?.date ? periodOf(row.date, cal).key : null;
}

// Day 1 is the first day of the period, so periods of different lengths line up on the chart.
async function getDailySpending(month: string): Promise<DaySpend[]> {
  const r = inRanges(keyRanges(month, cal));
  return db!.getAllAsync(
    `SELECT CAST(julianday(date) - julianday(?) AS INTEGER) + 1 AS day, SUM(amount_minor) AS total_minor
     FROM transactions WHERE type = 'expense' AND ${r.sql} GROUP BY date`,
    periodDates(month).start, ...r.params,
  );
}

// Daily spending for this period and the one before, for the small chart on Home.
export async function getSpendTrend(): Promise<{ daily: DaySpend[]; prevDaily: DaySpend[] }> {
  const month = currentPeriodKey();
  const prev = periodOf(shiftDays(periodDates(month).start, -1), cal).key;
  return { daily: await getDailySpending(month), prevDaily: await getDailySpending(prev) };
}

// The local date an account was added (created_at is a UTC timestamp).
const ADDED = "date(created_at, 'localtime')";

// Total balance at the end of `date`: the opening balance of every account added by then, plus income minus expenses.
// Transfers cancel out.
async function getNetWorthOn(date: string): Promise<number> {
  const row = await db!.getFirstAsync<{ total: number }>(
    `SELECT COALESCE((SELECT SUM(opening_minor) FROM accounts WHERE ${ADDED} <= ?), 0)
          + COALESCE((SELECT SUM(CASE WHEN type = 'income' THEN amount_minor WHEN type = 'expense' THEN -amount_minor ELSE 0 END)
                      FROM transactions WHERE date <= ?), 0) AS total`,
    date, date,
  );
  return row?.total ?? 0;
}

// Each day's income minus expenses in a month. Transfers are neither.
async function getDailyNet(month: string): Promise<DaySpend[]> {
  const r = inRanges(keyRanges(month, cal));
  return db!.getAllAsync(
    `SELECT CAST(julianday(date) - julianday(?) AS INTEGER) + 1 AS day,
            SUM(CASE WHEN type = 'income' THEN amount_minor ELSE -amount_minor END) AS total_minor
     FROM transactions WHERE type != 'transfer' AND ${r.sql} GROUP BY date`,
    periodDates(month).start, ...r.params,
  );
}

// For the net worth chart on Home: the balance before this month, each day's change this month (income minus
// expenses, and the opening balance of an account on the day it was added), and the balance on the same date last month.
// So the line is zero until the first account or transaction, then steps up.
export async function getNetWorthTrend(): Promise<NetWorthTrend> {
  const month = currentPeriodKey();
  const { start } = periodDates(month);
  const dayBefore = shiftDays(start, -1);
  const prev = periodOf(dayBefore, cal).key;
  const startMinor = await getNetWorthOn(dayBefore);
  const moved = await getDailyNet(month);
  const r = inRanges(keyRanges(month, cal), ADDED);
  const opened = await db!.getAllAsync<DaySpend>(
    `SELECT CAST(julianday(${ADDED}) - julianday(?) AS INTEGER) + 1 AS day, SUM(opening_minor) AS total_minor
     FROM accounts WHERE ${r.sql} GROUP BY ${ADDED}`,
    start, ...r.params,
  );
  // The same day of last period, or its last day if last period was shorter.
  const prevDate = shiftDays(periodDates(prev).start, Math.min(periodElapsed(), periodDays(prev)) - 1);
  const prevPointMinor = await getNetWorthOn(prevDate);
  return { startMinor, daily: [...moved, ...opened], prevPointMinor };
}

// Money in and out for the six months ending at `endMonth`. Months with nothing are zero.
async function getMonthlyTotals(endMonth: string): Promise<MonthTotals[]> {
  const totals: MonthTotals[] = [];
  for (const month of lastMonths(endMonth, 6)) totals.push({ month, ...(await getMonthSummary(month)) });
  return totals;
}

// One call per screen load. Queries run one after another on purpose (see useData).
export async function getInsights(month: string): Promise<InsightsData> {
  const r = inRanges(keyRanges(month, cal));
  return {
    summary: await getMonthSummary(month),
    spending: await getTotalsByCategory('expense', month),
    monthly: await getMonthlyTotals(currentPeriodKey()),
    byDay: await db!.getAllAsync(
      `SELECT CAST(julianday(date) - julianday(?) AS INTEGER) + 1 AS day, category_id, SUM(amount_minor) AS total_minor
       FROM transactions WHERE type = 'expense' AND ${r.sql} GROUP BY date, category_id`,
      periodDates(month).start, ...r.params,
    ),
    earliestMonth: await getEarliestMonth(),
  };
}

export async function exportAll(): Promise<Backup> {
  const handle = db!;
  return {
    app: 'hisaab',
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    currency: (await getSetting('currency')) ?? 'USD',
    accounts: await handle.getAllAsync('SELECT * FROM accounts ORDER BY id'),
    categories: await handle.getAllAsync('SELECT * FROM categories ORDER BY id'),
    transactions: await handle.getAllAsync('SELECT * FROM transactions ORDER BY id'),
    recurring: await handle.getAllAsync('SELECT * FROM recurring ORDER BY id'),
  };
}

async function clearAll(handle: Db) {
  for (const table of ['transactions', 'recurring', 'categories', 'accounts', 'settings']) {
    await handle.runAsync(`DELETE FROM ${table}`);
  }
}

// Replaces everything with a backup that already passed parseBackup. All or nothing.
export async function replaceAllData(backup: Backup) {
  await write(async (handle) => {
    await handle.withTransactionAsync(async () => {
      await clearAll(handle);
      for (const a of backup.accounts) {
        await handle.runAsync(
          'INSERT INTO accounts (id, name, type, opening_minor, color, limit_minor, due_day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          a.id, a.name, a.type, a.opening_minor, a.color, a.limit_minor, a.due_day, a.created_at,
        );
      }
      for (const c of backup.categories) {
        await handle.runAsync(
          'INSERT INTO categories (id, name, kind, icon, color, budget_minor, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          c.id, c.name, c.kind, toEmoji(c.icon), c.color, c.budget_minor, c.is_default, c.sort_order ?? 0, // older backups have no order and use icon names
        );
      }
      for (const r of backup.recurring) {
        await handle.runAsync(
          `INSERT INTO recurring (id, name, type, amount_minor, account_id, category_id, freq, anchor_day, next_date, active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          r.id, r.name, r.type, r.amount_minor, r.account_id, r.category_id, r.freq, r.anchor_day, r.next_date, r.active,
        );
      }
      for (const t of backup.transactions) {
        await handle.runAsync(
          `INSERT INTO transactions (id, type, amount_minor, account_id, to_account_id, category_id, note, date, recurring_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          t.id, t.type, t.amount_minor, t.account_id, t.to_account_id, t.category_id, t.note, t.date, t.recurring_id, t.created_at,
        );
      }
      await handle.runAsync(UPSERT_SETTING, 'currency', backup.currency);
      await handle.runAsync(UPSERT_SETTING, 'onboarded', '1');
    });
    setAppCurrency(backup.currency);
  });
}

// Back to a brand-new app: default categories, a "Cash" account, and the currency screen again.
export async function deleteAllData() {
  await write(async (handle) => {
    await handle.withTransactionAsync(async () => {
      await clearAll(handle);
      await seedDefaults(handle);
    });
    setAppCurrency('USD');
  });
}

async function findRecurring(handle: Db, id: number): Promise<Recurring> {
  const item = await handle.getFirstAsync<Recurring>('SELECT * FROM recurring WHERE id = ?', id);
  if (!item) throw new Error('This recurring item no longer exists.');
  return item;
}

// Logs the next payment now (today, or its own date if that is already due) and moves on to the one after.
export async function logRecurringNow(id: number) {
  await write((handle) =>
    handle.withTransactionAsync(async () => {
      const item = await findRecurring(handle, id);
      const day = today();
      await insertOccurrence(handle, item, item.next_date <= day ? item.next_date : day);
      await handle.runAsync('UPDATE recurring SET next_date = ? WHERE id = ?', nextOccurrence(item.freq, item.anchor_day, item.next_date), id);
    }),
  );
}

// Skips the next payment without logging it.
export async function skipRecurring(id: number) {
  await write((handle) =>
    handle.withTransactionAsync(async () => {
      const item = await findRecurring(handle, id);
      await handle.runAsync('UPDATE recurring SET next_date = ? WHERE id = ?', nextOccurrence(item.freq, item.anchor_day, item.next_date), id);
    }),
  );
}

// Resuming moves the next date forward to today or later, so the paused period is not logged.
export async function setRecurringActive(id: number, active: boolean) {
  await write((handle) =>
    handle.withTransactionAsync(async () => {
      const item = await findRecurring(handle, id);
      const next = active ? firstOnOrAfter(item.freq, item.anchor_day, item.next_date, today()) : item.next_date;
      await handle.runAsync('UPDATE recurring SET active = ?, next_date = ? WHERE id = ?', active ? 1 : 0, next, id);
    }),
  );
}

// The last four logged payments of an item, and what it added up to this year.
export async function getRecurringActivity(id: number): Promise<{ history: TransactionRow[]; yearCount: number; yearTotal: number }> {
  const year = today().slice(0, 4);
  const history = await db!.getAllAsync<TransactionRow>(
    `${TX_SELECT} ${TX_FROM} WHERE t.recurring_id = ? ORDER BY t.date DESC, t.id DESC LIMIT 2`, id,
  );
  const sum = await db!.getFirstAsync<{ count: number; total: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(amount_minor), 0) AS total FROM transactions
     WHERE recurring_id = ? AND date BETWEEN ? AND ?`,
    id, `${year}-01-01`, `${year}-12-31`,
  );
  return { history, yearCount: sum?.count ?? 0, yearTotal: sum?.total ?? 0 };
}
