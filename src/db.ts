import { openDatabaseAsync } from 'expo-sqlite';
import { currentMonth, firstOnOrAfter, lastMonths, monthRange, nextOccurrence, shiftMonth, today } from './dates';
import { setAppCurrency } from './money';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, SCHEMA } from './seed';
import { BACKUP_VERSION } from './backup';
import type { Backup } from './backup';
import type { Account, Category, CategorySpend, DaySpend, InsightsData, MonthTotals, Recurring, RecurringRow, Transaction, TransactionFilter, TransactionRow } from './types';

// The small part of expo-sqlite that we use, so tests can pass a fake.
export type Db = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

let db: Db | null = null;
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

// Every write goes through here: bump the version and tell listeners only after it succeeded.
async function write<T>(task: (db: Db) => Promise<T>): Promise<T> {
  const result = await task(db!);
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
}

// The default categories and the "Cash" account. Used for a new database and after "Delete all data".
async function seedDefaults(handle: Db) {
  const insertCategory = 'INSERT INTO categories (name, kind, icon, color, is_default) VALUES (?, ?, ?, ?, ?)';
  for (const [name, icon, color] of EXPENSE_CATEGORIES) {
    await handle.runAsync(insertCategory, name, 'expense', icon, color, name === 'Other' ? 1 : 0);
  }
  for (const [name, icon, color] of INCOME_CATEGORIES) {
    await handle.runAsync(insertCategory, name, 'income', icon, color, name === 'Other income' ? 1 : 0);
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

export async function openDb(handle?: Db) {
  // A new connection per app session. expo-sqlite otherwise reuses one native connection across JS reloads
  // (Expo Go, Fast Refresh) and closes it when the old session's object is released, which crashes the next query.
  // The file is still called hisaab.db so phones that already have data keep it.
  db = handle ?? (await openDatabaseAsync('hisaab.db', { useNewConnection: true }));
  await migrate(db);
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
  'type' | 'amount_minor' | 'account_id' | 'to_account_id' | 'category_id' | 'note' | 'date'
>;

export async function addTransaction(t: NewTransaction) {
  await write((handle) =>
    handle.runAsync(
      `INSERT INTO transactions (type, amount_minor, account_id, to_account_id, category_id, note, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      t.type, t.amount_minor, t.account_id, t.to_account_id, t.category_id, t.note, t.date,
      new Date().toISOString(),
    ),
  );
}

// Balance = opening + income - expense - transfers out + transfers in. Never stored.
export async function getAccountsWithBalance(): Promise<(Account & { balance_minor: number })[]> {
  return db!.getAllAsync(
    `SELECT a.*,
       a.opening_minor
       + COALESCE((SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount_minor ELSE -t.amount_minor END)
                   FROM transactions t WHERE t.account_id = a.id), 0)
       + COALESCE((SELECT SUM(t.amount_minor) FROM transactions t
                   WHERE t.type = 'transfer' AND t.to_account_id = a.id), 0) AS balance_minor
     FROM accounts a ORDER BY a.id`,
  );
}

export async function getCategories(): Promise<Category[]> {
  return db!.getAllAsync('SELECT * FROM categories ORDER BY id');
}

// Transfers are not income or spending, so they are left out.
export async function getMonthSummary(month: string): Promise<{ in_minor: number; out_minor: number }> {
  const { start, end } = monthRange(month);
  const row = await db!.getFirstAsync<{ in_minor: number; out_minor: number }>(
    `SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount_minor END), 0) AS in_minor,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_minor END), 0) AS out_minor
     FROM transactions WHERE date BETWEEN ? AND ?`,
    start, end,
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
    const { start, end } = monthRange(filter.month);
    clauses.push('t.date BETWEEN ? AND ?');
    params.push(start, end);
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
  const rows = await db!.getAllAsync<{ month: string }>(
    'SELECT DISTINCT substr(date, 1, 7) AS month FROM transactions ORDER BY month DESC',
  );
  return rows.map((r) => r.month);
}

export async function getTransaction(id: number): Promise<TransactionRow | null> {
  return db!.getFirstAsync(`${TX_SELECT} ${TX_FROM} WHERE t.id = ?`, id);
}

export async function updateTransaction(id: number, t: NewTransaction) {
  await write((handle) =>
    handle.runAsync(
      `UPDATE transactions SET type = ?, amount_minor = ?, account_id = ?, to_account_id = ?,
              category_id = ?, note = ?, date = ? WHERE id = ?`,
      t.type, t.amount_minor, t.account_id, t.to_account_id, t.category_id, t.note, t.date, id,
    ),
  );
}

export async function deleteTransaction(id: number) {
  await write((handle) => handle.runAsync('DELETE FROM transactions WHERE id = ?', id));
}

export type NewAccount = Pick<Account, 'name' | 'opening_minor' | 'color'>;

export async function getAccount(id: number): Promise<Account | null> {
  return db!.getFirstAsync('SELECT * FROM accounts WHERE id = ?', id);
}

export async function addAccount(a: NewAccount) {
  await write((handle) =>
    handle.runAsync(
      'INSERT INTO accounts (name, opening_minor, color, created_at) VALUES (?, ?, ?, ?)',
      a.name, a.opening_minor, a.color, new Date().toISOString(),
    ),
  );
}

export async function updateAccount(id: number, a: NewAccount) {
  await write((handle) =>
    handle.runAsync('UPDATE accounts SET name = ?, opening_minor = ?, color = ? WHERE id = ?', a.name, a.opening_minor, a.color, id),
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
      'INSERT INTO categories (name, kind, icon, color, budget_minor, is_default) VALUES (?, ?, ?, ?, ?, 0)',
      c.name, c.kind, c.icon, c.color, c.budget_minor,
    ),
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
  'name' | 'type' | 'amount_minor' | 'account_id' | 'category_id' | 'freq' | 'anchor_day' | 'next_date' | 'active'
>;

export async function getRecurring(): Promise<RecurringRow[]> {
  return db!.getAllAsync(
    `SELECT r.*, a.name AS account_name, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
     FROM recurring r
     JOIN accounts a ON a.id = r.account_id
     JOIN categories c ON c.id = r.category_id
     ORDER BY r.active DESC, r.next_date, r.id`,
  );
}

export async function getRecurringItem(id: number): Promise<Recurring | null> {
  return db!.getFirstAsync('SELECT * FROM recurring WHERE id = ?', id);
}

// One transaction for a recurring item on the given date.
async function insertOccurrence(handle: Db, item: Recurring, date: string) {
  await handle.runAsync(
    `INSERT INTO transactions (type, amount_minor, account_id, to_account_id, category_id, note, date, recurring_id, created_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
    item.type, item.amount_minor, item.account_id, item.category_id, item.name, date, item.id,
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

const INSERT_RECURRING = `INSERT INTO recurring (name, type, amount_minor, account_id, category_id, freq, anchor_day, next_date, active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export async function addRecurring(r: NewRecurring) {
  await write((handle) =>
    handle.withTransactionAsync(async () => {
      await handle.runAsync(
        INSERT_RECURRING,
        r.name, r.type, r.amount_minor, r.account_id, r.category_id, r.freq, r.anchor_day, r.next_date, r.active,
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
                anchor_day = ?, next_date = ?, active = ? WHERE id = ?`,
        r.name, r.type, r.amount_minor, r.account_id, r.category_id, r.freq, r.anchor_day, r.next_date, r.active, id,
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

// Spending (or income) per category for a month, biggest first. `throughDay` stops at that day of the month.
export async function getTotalsByCategory(kind: 'expense' | 'income', month: string, throughDay?: number): Promise<CategorySpend[]> {
  const { start, end } = monthRange(month);
  const last = throughDay ? `${month}-${String(throughDay).padStart(2, '0')}` : end;
  return db!.getAllAsync(
    `SELECT c.id, c.name, c.icon, c.color, c.budget_minor, SUM(t.amount_minor) AS total_minor
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.type = ? AND t.date BETWEEN ? AND ?
     GROUP BY c.id ORDER BY total_minor DESC`,
    kind, start, last,
  );
}

async function getDailySpending(month: string): Promise<DaySpend[]> {
  const { start, end } = monthRange(month);
  return db!.getAllAsync(
    `SELECT CAST(substr(date, 9, 2) AS INTEGER) AS day, SUM(amount_minor) AS total_minor
     FROM transactions WHERE type = 'expense' AND date BETWEEN ? AND ? GROUP BY date`,
    start, end,
  );
}

// Money in and out for the six months ending at `endMonth`. Months with nothing are zero.
async function getMonthlyTotals(endMonth: string): Promise<MonthTotals[]> {
  const months = lastMonths(endMonth, 6);
  const rows = await db!.getAllAsync<MonthTotals>(
    `SELECT substr(date, 1, 7) AS month,
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount_minor END), 0) AS in_minor,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_minor END), 0) AS out_minor
     FROM transactions WHERE date BETWEEN ? AND ? GROUP BY month`,
    monthRange(months[0]).start, monthRange(endMonth).end,
  );
  return months.map((month) => rows.find((r) => r.month === month) ?? { month, in_minor: 0, out_minor: 0 });
}

// One call per screen load. Queries run one after another on purpose (see useData).
export async function getInsights(month: string): Promise<InsightsData> {
  const prev = shiftMonth(month, -1);
  const isCurrent = month === currentMonth();
  const throughDay = isCurrent ? Number(today().slice(8)) : undefined;
  const summary = await getMonthSummary(month);
  const prevSummary = await getMonthSummary(prev);
  const spending = await getTotalsByCategory('expense', month);
  const prevSpending = await getTotalsByCategory('expense', prev, throughDay);
  const income = await getTotalsByCategory('income', month);
  const daily = await getDailySpending(month);
  const prevDaily = await getDailySpending(prev);
  const { start, end } = monthRange(month);
  const recurring = await db!.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_minor), 0) AS total FROM transactions
     WHERE type = 'expense' AND recurring_id IS NOT NULL AND date BETWEEN ? AND ?`,
    start, end,
  );
  const monthly = await getMonthlyTotals(currentMonth());
  const earliest = await db!.getFirstAsync<{ month: string | null }>('SELECT MIN(substr(date, 1, 7)) AS month FROM transactions');
  return {
    summary, prevSummary, spending, prevSpending, income, daily, prevDaily,
    recurringOut: recurring?.total ?? 0, monthly, earliestMonth: earliest?.month ?? null,
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
          'INSERT INTO accounts (id, name, opening_minor, color, created_at) VALUES (?, ?, ?, ?, ?)',
          a.id, a.name, a.opening_minor, a.color, a.created_at,
        );
      }
      for (const c of backup.categories) {
        await handle.runAsync(
          'INSERT INTO categories (id, name, kind, icon, color, budget_minor, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)',
          c.id, c.name, c.kind, c.icon, c.color, c.budget_minor, c.is_default,
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
    `${TX_SELECT} ${TX_FROM} WHERE t.recurring_id = ? ORDER BY t.date DESC, t.id DESC LIMIT 4`, id,
  );
  const sum = await db!.getFirstAsync<{ count: number; total: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(amount_minor), 0) AS total FROM transactions
     WHERE recurring_id = ? AND date BETWEEN ? AND ?`,
    id, `${year}-01-01`, `${year}-12-31`,
  );
  return { history, yearCount: sum?.count ?? 0, yearTotal: sum?.total ?? 0 };
}
