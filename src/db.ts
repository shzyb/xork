import { openDatabaseAsync } from 'expo-sqlite';
import { monthRange } from './dates';
import { setAppCurrency } from './money';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, SCHEMA } from './seed';
import type { Account, Category, Transaction, TransactionFilter, TransactionRow } from './types';

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

async function migrateToV1(handle: Db) {
  await handle.withTransactionAsync(async () => {
    await handle.execAsync(SCHEMA);
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
  db = handle ?? (await openDatabaseAsync('hisaab.db'));
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
       a.name AS account_name, b.name AS to_account_name`;
const TX_FROM = `FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN accounts b ON b.id = t.to_account_id
  LEFT JOIN categories c ON c.id = t.category_id`;

export const NO_FILTER: TransactionFilter = { search: '', type: 'all', month: null };

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
