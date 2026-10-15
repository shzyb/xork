import { monthRange, occurrencesBetween } from './dates';
import { formatMoney, monthlyMinor } from './money';
import type { AccountType, DaySpend, Frequency, Recurring } from './types';

// Cumulative spending by day, in minor units. `length` days long; days with no spending carry the total forward.
export function runningTotal(daily: DaySpend[], length: number): number[] {
  const perDay: number[] = new Array(length).fill(0);
  for (const d of daily) {
    if (d.day >= 1 && d.day <= length) perDay[d.day - 1] += d.total_minor;
  }
  let sum = 0;
  return perDay.map((v) => (sum += v));
}

// Total balance at the end of each day, from `start` (the balance before day 1). `daily` is each day's income minus expenses.
export function netWorthSeries(start: number, daily: DaySpend[], length: number): number[] {
  return runningTotal(daily, length).map((v) => start + v);
}

export function keptPercent(inMinor: number, outMinor: number): number | null {
  return inMinor > 0 ? Math.round(((inMinor - outMinor) / inMinor) * 100) : null;
}

export type Budget = { percent: number; state: 'ok' | 'warn' | 'over'; text: string };

export function budgetStatus(spent: number, budget: number): Budget {
  const percent = (spent / budget) * 100;
  if (spent > budget) {
    return { percent, state: 'over', text: `${formatMoney(spent - budget)} over a ${formatMoney(budget)} budget` };
  }
  return { percent, state: percent > 85 ? 'warn' : 'ok', text: `${formatMoney(budget - spent)} left of ${formatMoney(budget)}` };
}

// How much of a credit limit is used. Warns from 80%, turns red from 95%, and is full at 100%.
export type CreditStatus = { percent: number; state: 'ok' | 'warn' | 'high' | 'full'; left: number };

export function creditStatus(owed: number, limit: number): CreditStatus {
  const percent = Math.max(0, Math.round((owed / limit) * 100));
  const state = owed >= limit ? 'full' : percent >= 95 ? 'high' : percent >= 80 ? 'warn' : 'ok';
  return { percent, state, left: Math.max(0, limit - owed) };
}

// "Due on the 15th", or "due tomorrow" / "due in 5 days" when it is close. A day past the month's end counts as its last day.
export function dueText(dueDay: number, todayDate: string): string {
  const year = Number(todayDate.slice(0, 4));
  const month = Number(todayDate.slice(5, 7));
  const day = Number(todayDate.slice(8));
  const thisMonthLast = new Date(year, month, 0).getDate();
  const nextMonthLast = new Date(year, month + 1, 0).getDate();
  const thisDue = Math.min(dueDay, thisMonthLast);
  const daysAway = thisDue >= day ? thisDue - day : thisMonthLast - day + Math.min(dueDay, nextMonthLast);
  const last = dueDay % 10;
  const nth = dueDay >= 11 && dueDay <= 13 ? 'th' : last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th';
  if (daysAway === 0) return 'due today';
  if (daysAway === 1) return 'due tomorrow';
  if (daysAway <= 7) return `due in ${daysAway} days`;
  return `due on the ${dueDay}${nth}`;
}

// What is normal for you: the middle of the earlier months' values, so one unusual month doesn't move it.
// Null with fewer than 2 months to go on.
export function usual(values: number[]): number | null {
  if (values.length < 2) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// Each category's usual spending over `months`, counting 0 for a month it had nothing.
export function categoryUsual(rows: { id: number; month: string; total_minor: number }[], months: string[]): Map<number, number> {
  const result = new Map<number, number>();
  for (const id of new Set(rows.map((r) => r.id))) {
    const value = usual(months.map((m) => rows.find((r) => r.id === id && r.month === m)?.total_minor ?? 0));
    if (value) result.set(id, value);
  }
  return result;
}

// How far an amount is from your usual, when it is a fifth or more away. A month that is still running can only be
// above usual so far: the rest of it hasn't happened yet.
export function vsUsual(amount: number, usualAmount: number | null | undefined, running: boolean): number | null {
  if (!usualAmount) return null;
  const diff = amount - usualAmount;
  if (Math.abs(diff) < usualAmount * 0.2 || (running && diff < 0)) return null;
  return diff;
}

// Recurring payments still to come from `from` to the end of `month`: bills and income.
export function stillDue(items: Recurring[], from: string, month: string): { bills: number; income: number } {
  const due = { bills: 0, income: 0 };
  for (const { item } of occurrencesBetween(items, from, monthRange(month).end)) {
    if (item.type === 'expense') due.bills += item.amount_minor;
    else due.income += item.amount_minor;
  }
  return due;
}

// Where a running month is heading. Recurring bills count once at their real amount; only day-to-day spending is
// scaled up to the whole month, so rent paid on the 1st isn't multiplied by 30. Income counts only what is known to come.
export function forecast(input: {
  inSoFar: number;
  outSoFar: number;
  fixedPaid: number; // recurring expenses already logged this month
  due: { bills: number; income: number };
  elapsedDays: number;
  days: number;
}): { income: number; spend: number } {
  const { inSoFar, outSoFar, fixedPaid, due, elapsedDays, days } = input;
  const flexible = Math.round((((outSoFar - fixedPaid) / elapsedDays) * days) / 100) * 100;
  return { income: inSoFar + due.income, spend: fixedPaid + due.bills + flexible };
}

// How many months the money in your accounts would last at your usual spending. What cards owe counts against it.
export function runway(accounts: { type: AccountType; balance_minor: number }[], usualSpend: number) {
  const have = accounts.filter((a) => a.type !== 'credit').reduce((sum, a) => sum + a.balance_minor, 0);
  const owed = accounts.filter((a) => a.type === 'credit').reduce((sum, a) => sum + Math.max(0, -a.balance_minor), 0);
  return { have, owed, months: Math.max(0, Math.round(((have - owed) / usualSpend) * 10) / 10) };
}

export function yearlyCost(items: { freq: Frequency; amount_minor: number }[]): number {
  return items.reduce((sum, r) => sum + monthlyMinor(r.amount_minor, r.freq) * 12, 0);
}

// The recurring expense whose amount rose the most since its first payment in `logs` (oldest first). Null under 5%.
export function biggestPriceRise(
  items: Recurring[],
  logs: { recurring_id: number; amount_minor: number; date: string }[],
): { name: string; percent: number; since: string } | null {
  let best: { name: string; percent: number; since: string } | null = null;
  for (const item of items) {
    const first = logs.find((l) => l.recurring_id === item.id);
    if (!item.active || item.type !== 'expense' || !first || first.amount_minor <= 0) continue;
    const percent = Math.round(((item.amount_minor - first.amount_minor) / first.amount_minor) * 100);
    if (percent >= 5 && (!best || percent > best.percent)) best = { name: item.name, percent, since: first.date.slice(0, 7) };
  }
  return best;
}
