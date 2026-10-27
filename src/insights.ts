import { formatMoney } from './money';
import type { DaySpend, InsightsData } from './types';

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

export type DayPart = { category_id: number | null; total_minor: number };

// Each day of a month split by category for the daily chart: the 4 biggest that day, biggest first, and everything
// smaller together as one part with no category. Days with no spending are empty.
export function dayParts(byDay: InsightsData['byDay'], days: number): DayPart[][] {
  return Array.from({ length: days }, (_, i) => {
    const sorted = byDay.filter((r) => r.day === i + 1).sort((a, b) => b.total_minor - a.total_minor);
    const parts: DayPart[] = sorted.slice(0, 4).map((r) => ({ category_id: r.category_id, total_minor: r.total_minor }));
    const rest = sorted.slice(4).reduce((sum, r) => sum + r.total_minor, 0);
    return rest > 0 ? [...parts, { category_id: null, total_minor: rest }] : parts;
  });
}
