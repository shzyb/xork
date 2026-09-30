import { openDatabaseAsync } from 'expo-sqlite';
import { monthRange } from './dates';
import { setAppCurrency } from './money';
import type { Account, Category, Transaction, TransactionRow } from './types';

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

const SCHEMA = `
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  opening_minor INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  budget_minor INTEGER,
  is_default INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  to_account_id INTEGER,
  category_id INTEGER,
  note TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  recurring_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX transactions_date ON transactions (date);
CREATE TABLE recurring (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  freq TEXT NOT NULL,
  anchor_day INTEGER NOT NULL,
  next_date TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// name, Lucide icon name, colour. The two "Other" categories are is_default: they can't be deleted.
const EXPENSE_CATEGORIES = [
  ['Groceries', 'shopping-cart', '#34A853'],
  ['Dining out', 'utensils', '#FF8A00'],
  ['Transport', 'bus', '#3B82F6'],
  ['Bills', 'receipt', '#EAB308'],
  ['Rent', 'house', '#A0714F'],
  ['Mobile', 'smartphone', '#14B8A6'],
  ['Internet', 'wifi', '#0EA5E9'],
  ['Subscriptions', 'repeat', '#8B5CF6'],
  ['Shopping', 'shopping-bag', '#EC4899'],
  ['Health', 'heart-pulse', '#EF4444'],
  ['Family', 'users', '#64748B'],
  ['Education', 'book-open', '#16A34A'],
  ['Entertainment', 'clapperboard', '#0284C7'],
  ['Fuel', 'fuel', '#F97316'],
  ['Travel', 'plane', '#2563EB'],
  ['Personal', 'sparkles', '#D946EF'],
  ['Fitness', 'dumbbell', '#EA580C'],
  ['Charity', 'hand-heart', '#059669'],
  ['Home', 'sofa', '#B45309'],
  ['Maintenance', 'wrench', '#78716C'],
  ['Insurance', 'shield-check', '#4F46E5'],
  ['Loans', 'landmark', '#7C3AED'],
  ['EMI', 'credit-card', '#DB2777'],
  ['Other', 'tag', '#64748B'],
];

const INCOME_CATEGORIES = [
  ['Salary', 'briefcase', '#16A34A'],
  ['Freelance', 'laptop', '#14B8A6'],
  ['Business', 'store', '#F59E0B'],
  ['Investments', 'trending-up', '#8B5CF6'],
  ['Rental income', 'key-round', '#A0714F'],
  ['Refunds', 'undo-2', '#0EA5E9'],
  ['Gifts', 'gift', '#EC4899'],
  ['Other income', 'sparkle', '#64748B'],
];

// Migrations only add things. Each step runs once, guarded by PRAGMA user_version.
async function migrate(handle: Db) {
  const row = await handle.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) >= 1) return;
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

export async function getRecent(limit: number): Promise<TransactionRow[]> {
  return db!.getAllAsync(
    `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
            a.name AS account_name, b.name AS to_account_name
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN accounts b ON b.id = t.to_account_id
     LEFT JOIN categories c ON c.id = t.category_id
     ORDER BY t.date DESC, t.id DESC LIMIT ?`,
    limit,
  );
}
