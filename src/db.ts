import { openDatabaseAsync } from 'expo-sqlite';
import { setAppCurrency } from './money';

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

// name, icon, colour. The two "Other" categories are is_default: they can't be deleted.
const EXPENSE_CATEGORIES = [
  ['Groceries', '🛒', '#34A853'],
  ['Dining out', '🍽️', '#FF8A00'],
  ['Transport', '🚌', '#3B82F6'],
  ['Bills', '🧾', '#EAB308'],
  ['Rent', '🏠', '#A0714F'],
  ['Mobile', '📱', '#14B8A6'],
  ['Internet', '🌐', '#0EA5E9'],
  ['Subscriptions', '🔁', '#8B5CF6'],
  ['Shopping', '🛍️', '#EC4899'],
  ['Health', '💊', '#EF4444'],
  ['Family', '👨‍👩‍👧', '#64748B'],
  ['Education', '📚', '#16A34A'],
  ['Entertainment', '🎬', '#0284C7'],
  ['Fuel', '⛽', '#F97316'],
  ['Travel', '✈️', '#2563EB'],
  ['Personal', '🧴', '#D946EF'],
  ['Fitness', '🏋️', '#EA580C'],
  ['Charity', '🤲', '#059669'],
  ['Home', '🛋️', '#B45309'],
  ['Maintenance', '🔧', '#78716C'],
  ['Insurance', '🛡️', '#4F46E5'],
  ['Loans', '🏦', '#7C3AED'],
  ['EMI', '💳', '#DB2777'],
  ['Other', '🏷️', '#64748B'],
];

const INCOME_CATEGORIES = [
  ['Salary', '💼', '#16A34A'],
  ['Freelance', '💻', '#14B8A6'],
  ['Business', '🏪', '#F59E0B'],
  ['Investments', '📈', '#8B5CF6'],
  ['Rental income', '🔑', '#A0714F'],
  ['Refunds', '↩️', '#0EA5E9'],
  ['Gifts', '🎁', '#EC4899'],
  ['Other income', '✨', '#64748B'],
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

// Opening balances plus income minus expenses. Transfers cancel out across accounts.
export async function getTotalBalance(): Promise<number> {
  const row = await db!.getFirstAsync<{ total: number }>(
    `SELECT (SELECT COALESCE(SUM(opening_minor), 0) FROM accounts)
          + (SELECT COALESCE(SUM(CASE type WHEN 'income' THEN amount_minor WHEN 'expense' THEN -amount_minor ELSE 0 END), 0)
             FROM transactions) AS total`,
  );
  return row?.total ?? 0;
}
