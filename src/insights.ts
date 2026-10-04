import { daysInMonth, monthName } from './dates';
import { formatMoney } from './money';
import type { CategorySpend, DaySpend } from './types';

// Cumulative spending by day, in minor units. `length` days long; days with no spending carry the total forward.
export function runningTotal(daily: DaySpend[], length: number): number[] {
  const perDay: number[] = new Array(length).fill(0);
  for (const d of daily) {
    if (d.day >= 1 && d.day <= length) perDay[d.day - 1] += d.total_minor;
  }
  let sum = 0;
  return perDay.map((v) => (sum += v));
}

export type Delta = { kind: 'new' | 'same' | 'up' | 'down'; percent: number } | null;

// Compares this month's amount with last month's, for the small badge next to a category.
export function delta(current: number, previous: number): Delta {
  if (previous <= 0) return current > 0 ? { kind: 'new', percent: 0 } : null;
  const percent = ((current - previous) / previous) * 100;
  if (Math.abs(percent) < 2) return { kind: 'same', percent: 0 };
  return { kind: percent > 0 ? 'up' : 'down', percent: Math.abs(Math.round(percent)) };
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

// "Rs 4,200 less than this point in August". Null when last month has nothing to compare with.
export function spendComparison(spent: number, prevSamePoint: number, isCurrent: boolean, prevMonth: string) {
  if (prevSamePoint <= 0) return null;
  const diff = spent - prevSamePoint;
  const more = diff > 0;
  return {
    more,
    text: `${formatMoney(Math.abs(diff))} ${more ? 'more' : 'less'} than ${isCurrent ? 'this point in ' : ''}${monthName(prevMonth)}`,
  };
}

export type Note = {
  icon: 'trending-up' | 'trending-down' | 'gauge' | 'repeat' | 'triangle-alert';
  tone: 'good' | 'bad' | 'warn' | 'neutral';
  title: string;
  detail: string;
  categoryId?: number; // set when the note is about one category, so the card can open it
};

// The short "What stood out" notes. `prevSpending` is compared at the same point in the month.
export function buildNotes(input: {
  month: string;
  prevMonth: string;
  isCurrent: boolean;
  elapsedDays: number;
  spent: number;
  prevFullSpent: number;
  recurringOut: number;
  spending: CategorySpend[];
  prevSpending: CategorySpend[];
}): Note[] {
  const { prevMonth, isCurrent, elapsedDays, spent, prevFullSpent, recurringOut, spending, prevSpending } = input;
  const notes: Note[] = [];
  const prevName = monthName(prevMonth);

  const changes = spending
    .map((c) => ({ c, previous: prevSpending.find((p) => p.id === c.id)?.total_minor ?? 0 }))
    .filter((x) => x.previous > 0)
    .map((x) => ({ ...x, diff: x.c.total_minor - x.previous }))
    .filter((x) => Math.abs(x.diff) / x.previous >= 0.15 && Math.abs(x.diff) >= spent * 0.02);
  const rise = changes.filter((x) => x.diff > 0).sort((a, b) => b.diff - a.diff)[0];
  const cut = changes.filter((x) => x.diff < 0).sort((a, b) => a.diff - b.diff)[0];
  if (rise) {
    notes.push({
      icon: 'trending-up',
      tone: 'bad',
      title: `${rise.c.name} is up ${Math.round((rise.diff / rise.previous) * 100)}%`,
      detail: `${formatMoney(rise.diff)} more than ${prevName}.`,
      categoryId: rise.c.id,
    });
  }
  if (cut) {
    notes.push({
      icon: 'trending-down',
      tone: 'good',
      title: `${cut.c.name} is down ${Math.round((-cut.diff / cut.previous) * 100)}%`,
      detail: `${formatMoney(-cut.diff)} less than ${prevName}.`,
      categoryId: cut.c.id,
    });
  }

  if (isCurrent && spent > 0) {
    const days = daysInMonth(input.month);
    const projected = Math.round(((spent / elapsedDays) * days) / 100) * 100;
    notes.push({
      icon: 'gauge',
      tone: 'neutral',
      title: `On pace for ${formatMoney(projected)}`,
      detail: `By the end of the month${prevFullSpent > 0 ? `, against ${formatMoney(prevFullSpent)} in ${prevName}` : ''}.`,
    });
  }

  if (spent > 0 && recurringOut > 0) {
    notes.push({
      icon: 'repeat',
      tone: 'neutral',
      title: `${Math.round((recurringOut / spent) * 100)}% was recurring`,
      detail: `The other ${formatMoney(spent - recurringOut)} was day-to-day.`,
    });
  }

  const over = spending.filter((c) => c.budget_minor !== null && c.total_minor > c.budget_minor);
  if (over.length === 1) {
    notes.push({
      icon: 'triangle-alert',
      tone: 'warn',
      title: `${over[0].name} is over budget`,
      detail: `By ${formatMoney(over[0].total_minor - (over[0].budget_minor ?? 0))} this month.`,
      categoryId: over[0].id,
    });
  } else if (over.length > 1) {
    notes.push({
      icon: 'triangle-alert',
      tone: 'warn',
      title: `${over.length} categories over budget`,
      detail: 'Each is past its monthly budget.',
    });
  }
  return notes;
}
