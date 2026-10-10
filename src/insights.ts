import { daysInMonth, monthName } from './dates';
import { formatMoney } from './money';
import type { CategorySpend, DaySpend, MonthTotals } from './types';

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
  icon: 'trending-up' | 'trending-down' | 'gauge' | 'repeat' | 'triangle-alert' | 'piggy-bank';
  tone: 'good' | 'bad' | 'warn' | 'neutral';
  value: string; // the big number or percentage at the top of the card
  detail: string; // one sentence saying what it means
  categoryId?: number; // set when the note is about one category, so the card can open it
};

// "Dining out", "Dining out and Fuel", "Dining out, Fuel and Rent", "Dining out, Fuel and 2 more".
function nameList(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

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
  monthly: MonthTotals[]; // the last 6 months, oldest first
}): Note[] {
  const { prevMonth, isCurrent, elapsedDays, spent, prevFullSpent, recurringOut, spending, prevSpending, monthly } = input;
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
      value: `${Math.round((rise.diff / rise.previous) * 100)}%`,
      detail: `More spent on ${rise.c.name} than in ${prevName}, ${formatMoney(rise.diff)} more.`,
      categoryId: rise.c.id,
    });
  }
  if (cut) {
    notes.push({
      icon: 'trending-down',
      tone: 'good',
      value: `${Math.round((-cut.diff / cut.previous) * 100)}%`,
      detail: `Less spent on ${cut.c.name} than in ${prevName}, ${formatMoney(-cut.diff)} less.`,
      categoryId: cut.c.id,
    });
  }

  if (isCurrent && spent > 0) {
    const days = daysInMonth(input.month);
    const projected = Math.round(((spent / elapsedDays) * days) / 100) * 100;
    const vsPrev = projected - prevFullSpent;
    notes.push({
      icon: 'gauge',
      tone: 'neutral',
      value: formatMoney(projected),
      detail: `You're on track to spend this by the end of the month${prevFullSpent > 0 && vsPrev !== 0 ? `, ${formatMoney(Math.abs(vsPrev))} ${vsPrev > 0 ? 'more' : 'less'} than ${prevName}` : ''}.`,
    });
  }

  if (spent > 0 && recurringOut > 0) {
    notes.push({
      icon: 'repeat',
      tone: 'neutral',
      value: `${Math.round((recurringOut / spent) * 100)}%`,
      detail: `Of your spending was recurring. The other ${formatMoney(spent - recurringOut)} was day-to-day.`,
    });
  }

  const over = spending.filter((c) => c.budget_minor !== null && c.total_minor > c.budget_minor);
  if (over.length === 1) {
    notes.push({
      icon: 'triangle-alert',
      tone: 'warn',
      value: formatMoney(over[0].total_minor - (over[0].budget_minor ?? 0)),
      detail: `Over your ${over[0].name} budget in ${monthName(input.month)}.`,
      categoryId: over[0].id,
    });
  } else if (over.length > 1) {
    notes.push({
      icon: 'triangle-alert',
      tone: 'warn',
      value: String(over.length),
      detail: `Categories are over budget: ${nameList(over.map((c) => c.name))}.`,
    });
  }

  const nearly = isCurrent
    ? spending
        .filter((c) => c.budget_minor !== null && c.total_minor <= c.budget_minor && c.total_minor >= c.budget_minor * 0.8)
        .sort((a, b) => b.total_minor / (b.budget_minor ?? 1) - a.total_minor / (a.budget_minor ?? 1))
    : [];
  if (nearly.length === 1) {
    const budget = nearly[0].budget_minor ?? 0;
    const daysLeft = daysInMonth(input.month) - elapsedDays;
    notes.push({
      icon: 'gauge',
      tone: 'warn',
      value: `${Math.round((nearly[0].total_minor / budget) * 100)}%`,
      detail: `Of your ${nearly[0].name} budget is used. ${formatMoney(budget - nearly[0].total_minor)} left${daysLeft > 0 ? ` for ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}` : ''}.`,
      categoryId: nearly[0].id,
    });
  } else if (nearly.length > 1) {
    notes.push({
      icon: 'gauge',
      tone: 'warn',
      value: String(nearly.length),
      detail: `Categories have used at least 80% of their budget: ${nameList(nearly.map((c) => c.name))}.`,
    });
  }

  let streak = 0;
  let saved = 0;
  for (let i = monthly.findIndex((m) => m.month === input.month); i >= 0 && monthly[i].in_minor > monthly[i].out_minor; i--) {
    streak++;
    saved += monthly[i].in_minor - monthly[i].out_minor;
  }
  if (streak >= 2) {
    notes.push({
      icon: 'piggy-bank',
      tone: 'good',
      value: formatMoney(saved),
      detail: `You've saved this amount over ${streak} months running.`,
    });
  }
  return notes;
}
