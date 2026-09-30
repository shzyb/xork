import { CURRENCIES } from './money';
import type { Account, Category, Recurring, Transaction } from './types';

export const BACKUP_VERSION = 1;

// The whole app as one JSON file. Ids are kept so transactions still point at their accounts and categories.
export type Backup = {
  app: 'hisaab'; // the file's internal marker; it stays 'hisaab' so backups made before the rename still import
  version: number;
  exported_at: string;
  currency: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurring: Recurring[];
};

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNullableInt = (v: unknown) => v === null || isInt(v);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const fail = (error: string): ParseResult => ({ ok: false, error });

// Checks a file picked by the user before anything is written. Returns one plain sentence on the first problem.
export function parseBackup(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fail("This isn't a Xork backup file.");
  }
  if (!isRecord(data) || data.app !== 'hisaab') return fail("This isn't a Xork backup file.");
  if (isInt(data.version) && data.version > BACKUP_VERSION) return fail('This backup is from a newer version of Xork.');
  if (data.version !== BACKUP_VERSION) return fail('This backup file is damaged.');
  if (!isStr(data.currency) || !CURRENCIES.some((c) => c.code === data.currency)) {
    return fail('This backup uses a currency Xork does not support.');
  }
  const { accounts, categories, transactions, recurring } = data;
  if (![accounts, categories, transactions, recurring].every(Array.isArray)) return fail('This backup file is damaged.');

  const accountIds = new Set<number>();
  for (const a of accounts as unknown[]) {
    if (!isRecord(a) || !isInt(a.id) || !isStr(a.name) || !isInt(a.opening_minor) || !isStr(a.color) || !isStr(a.created_at)) {
      return fail('An account in this backup is damaged.');
    }
    if (accountIds.has(a.id)) return fail('This backup lists the same account twice.');
    accountIds.add(a.id);
  }
  if (accountIds.size === 0) return fail('This backup has no accounts.');

  const categoryKinds = new Map<number, unknown>();
  const defaults = { expense: 0, income: 0 };
  for (const c of categories as unknown[]) {
    if (
      !isRecord(c) || !isInt(c.id) || !isStr(c.name) || !isStr(c.icon) || !isStr(c.color) ||
      (c.kind !== 'expense' && c.kind !== 'income') || !isNullableInt(c.budget_minor) || (c.is_default !== 0 && c.is_default !== 1)
    ) {
      return fail('A category in this backup is damaged.');
    }
    if (categoryKinds.has(c.id)) return fail('This backup lists the same category twice.');
    categoryKinds.set(c.id, c.kind);
    if (c.is_default === 1) defaults[c.kind] += 1;
  }
  if (defaults.expense !== 1 || defaults.income !== 1) return fail('This backup is missing an Other category.');

  const recurringIds = new Set<number>();
  for (const r of recurring as unknown[]) {
    if (
      !isRecord(r) || !isInt(r.id) || !isStr(r.name) || (r.type !== 'expense' && r.type !== 'income') || !isInt(r.amount_minor) ||
      !isInt(r.account_id) || !isInt(r.category_id) || !['weekly', 'monthly', 'yearly'].includes(r.freq as string) ||
      !isInt(r.anchor_day) || !isStr(r.next_date) || !DAY.test(r.next_date) || (r.active !== 0 && r.active !== 1)
    ) {
      return fail('A recurring item in this backup is damaged.');
    }
    if (!accountIds.has(r.account_id) || categoryKinds.get(r.category_id) !== r.type) {
      return fail('A recurring item in this backup points at a missing account or category.');
    }
    recurringIds.add(r.id);
  }

  for (const t of transactions as unknown[]) {
    if (
      !isRecord(t) || !isInt(t.id) || !['expense', 'income', 'transfer'].includes(t.type as string) || !isInt(t.amount_minor) ||
      !isInt(t.account_id) || !isNullableInt(t.to_account_id) || !isNullableInt(t.category_id) || !isStr(t.note) ||
      !isStr(t.date) || !DAY.test(t.date) || !isNullableInt(t.recurring_id) || !isStr(t.created_at)
    ) {
      return fail('A transaction in this backup is damaged.');
    }
    const missing =
      !accountIds.has(t.account_id) ||
      (t.type === 'transfer'
        ? t.to_account_id === null || !accountIds.has(t.to_account_id) || t.to_account_id === t.account_id
        : t.category_id === null || categoryKinds.get(t.category_id) !== t.type) ||
      (t.recurring_id !== null && !recurringIds.has(t.recurring_id));
    if (missing) return fail('A transaction in this backup points at a missing account, category or recurring item.');
  }

  return { ok: true, backup: data as unknown as Backup };
}
