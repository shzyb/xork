import { BACKUP_VERSION } from './backup';
import type { Backup } from './backup';
import { daysInMonth, fromDay, monthRange, nextOccurrence, shiftMonth, toDay } from './dates';
import { currencyOf } from './money';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './seed';
import type { Account, Category, Recurring, Transaction } from './types';

// Development only: about 2 years of made-up data to look at Insights with. The same input always gives the same data.
// Amounts are written as whole units (like dollars) and multiplied by 100 for currencies that show no decimals.

const BUDGETS: Record<string, number> = { Groceries: 600, 'Dining out': 250, Transport: 150, Shopping: 300, Entertainment: 100 };

const NOTES: Record<string, string[]> = {
  Groceries: ['', 'Weekly shop', 'Vegetables', 'Fruit'],
  'Dining out': ['', 'Lunch', 'Dinner', 'Coffee'],
  Transport: ['', 'Taxi', 'Bus pass'],
  Shopping: ['', 'Clothes', 'Shoes', 'Gift'],
  Health: ['', 'Pharmacy', 'Doctor'],
  Travel: ['Flights', 'Hotel', 'Weekend away'],
};

export function buildDemoBackup(currency: string, todayStr: string): Backup {
  const scale = currencyOf(currency).decimals === 0 ? 100 : 1;
  const money = (units: number) => Math.round(units * scale) * 100;

  let seed = 42;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const chance = (p: number) => random() < p;
  const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
  const pick = (items: string[]) => items[Math.floor(random() * items.length)];

  const month = todayStr.slice(0, 7);
  const start = monthRange(shiftMonth(month, -24)).start;
  const raiseOn = monthRange(shiftMonth(month, -9)).start;
  const created_at = `${start}T12:00:00.000Z`;

  const categories: Category[] = [];
  for (const [kind, list] of [['expense', EXPENSE_CATEGORIES], ['income', INCOME_CATEGORIES]] as const) {
    list.forEach(([name, icon, color], i) => {
      categories.push({
        id: categories.length + 1, name, kind, icon, color,
        budget_minor: BUDGETS[name] ? money(BUDGETS[name]) : null,
        is_default: name === 'Other' || name === 'Other income' ? 1 : 0,
        sort_order: i,
      });
    });
  }
  const cat = (name: string) => categories.find((c) => c.name === name)!.id;

  const [CASH, BANK, SAVINGS, CARD] = [1, 2, 3, 4];
  const accounts: Account[] = [
    { id: CASH, name: 'Cash', type: 'cash', opening_minor: money(200), color: '#FF9F0A', limit_minor: null, due_day: null, created_at },
    { id: BANK, name: 'Bank', type: 'debit', opening_minor: money(5000), color: '#3B82F6', limit_minor: null, due_day: null, created_at },
    { id: SAVINGS, name: 'Savings', type: 'savings', opening_minor: money(8000), color: '#16A34A', limit_minor: null, due_day: null, created_at },
    { id: CARD, name: 'Visa card', type: 'credit', opening_minor: 0, color: '#8B5CF6', limit_minor: money(3000), due_day: 20, created_at },
  ];
  const balance: Record<number, number> = {};
  for (const a of accounts) balance[a.id] = a.opening_minor;

  const monthly = (id: number, name: string, units: number, anchor_day: number): Recurring => ({
    id, name, type: 'expense', amount_minor: money(units), account_id: BANK, category_id: cat(name === 'Netflix' ? 'Subscriptions' : name),
    freq: 'monthly', anchor_day, next_date: start, active: 1,
  });
  const recurring = [monthly(1, 'Rent', 900, 1), monthly(2, 'Internet', 40, 5), monthly(3, 'Mobile', 15, 8), monthly(4, 'Netflix', 12, 12)];
  const lastLogged: Record<number, string> = {};

  const transactions: Transaction[] = [];
  const add = (date: string, type: Transaction['type'], amount: number, account_id: number, more: Partial<Transaction> = {}) => {
    transactions.push({
      id: transactions.length + 1, type, amount_minor: amount, account_id, to_account_id: null, category_id: null,
      note: '', date, recurring_id: null, created_at: `${date}T12:00:00.000Z`, ...more,
    });
    balance[account_id] += type === 'income' ? amount : -amount;
    if (more.to_account_id) balance[more.to_account_id] += amount;
  };

  // Cash while it lasts, the card while it stays under 70% of its limit, otherwise the bank.
  const spend = (date: string, name: string, lo: number, hi: number, onCard = false) => {
    const amount = money(between(lo, hi));
    const card = onCard && amount - balance[CARD] <= accounts[3].limit_minor! * 0.7;
    const account = card ? CARD : balance[CASH] >= amount ? CASH : BANK;
    add(date, 'expense', amount, account, { category_id: cat(name), note: pick(NOTES[name] ?? ['']) });
  };

  for (let d = fromDay(start); toDay(d) <= todayStr; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const day = toDay(d);
    const dom = d.getDate();
    const on = (anchor: number) => dom === Math.min(anchor, daysInMonth(day.slice(0, 7)));
    const festive = day.slice(5, 7) === '12' ? 2 : 1;

    for (const r of recurring) {
      if (!on(r.anchor_day)) continue;
      add(day, 'expense', r.amount_minor, r.account_id, { category_id: r.category_id, note: r.name, recurring_id: r.id });
      lastLogged[r.id] = day;
    }
    if (on(3)) add(day, 'transfer', money(300), BANK, { to_account_id: CASH, note: 'Cash for the month' });
    if (on(10)) spend(day, 'Bills', 60, 140);
    if (on(15) && chance(0.5)) add(day, 'income', money(between(20, 120)), SAVINGS, { category_id: cat('Investments'), note: 'Dividends' });
    if (on(18) && balance[CARD] < 0) add(day, 'transfer', -balance[CARD], BANK, { to_account_id: CARD, note: 'Card payment' });
    if (on(25)) add(day, 'income', money(day >= raiseOn ? 4000 : 3600), BANK, { category_id: cat('Salary'), note: 'Salary' });
    if (on(26)) add(day, 'transfer', money(400), BANK, { to_account_id: SAVINGS, note: 'Monthly saving' });

    if (chance(0.017)) add(day, 'income', money(between(200, 900)), BANK, { category_id: cat('Freelance'), note: 'Client project' });
    if (chance(0.005)) add(day, 'income', money(between(50, 200)), CASH, { category_id: cat('Gifts'), note: 'Gift' });

    if (chance(0.4)) spend(day, 'Groceries', 15, 90);
    if (chance(0.3)) spend(day, 'Dining out', 8, 45);
    if (chance(0.35)) spend(day, 'Transport', 3, 20);
    if (chance(0.1)) spend(day, 'Fuel', 30, 60);
    if (chance(0.07 * festive)) spend(day, 'Shopping', 20, 220, true);
    if (chance(0.04)) spend(day, 'Health', 20, 120);
    if (chance(0.06)) spend(day, 'Entertainment', 10, 40, true);
    if (chance(0.03)) spend(day, 'Personal', 10, 60);
    if (chance(0.004)) spend(day, 'Travel', 300, 900, true);
  }

  for (const r of recurring) r.next_date = nextOccurrence('monthly', r.anchor_day, lastLogged[r.id]);

  return { app: 'hisaab', version: BACKUP_VERSION, exported_at: new Date().toISOString(), currency, accounts, categories, transactions, recurring };
}
