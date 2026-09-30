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

// How many days the running-total chart shows: up to today for the current month, otherwise the whole month.
export function chartDays(month: string, throughDay?: number): number {
  return throughDay ?? daysInMonth(month);
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

export type Segment = { text: string; bold?: boolean };
export type Note = { icon: 'trending-up' | 'trending-down' | 'gauge' | 'repeat' | 'triangle-alert'; color: string; segments: Segment[] };

const bold = (text: string): Segment => ({ text, bold: true });
const plain = (text: string): Segment => ({ text });

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
      color: '#EF4444',
      segments: [bold(rise.c.name), plain(` rose ${Math.round((rise.diff / rise.previous) * 100)}% on ${prevName}, ${formatMoney(rise.diff)} more.`)],
    });
  }
  if (cut) {
    notes.push({
      icon: 'trending-down',
      color: '#34A853',
      segments: [plain('You cut '), bold(cut.c.name), plain(` by ${formatMoney(-cut.diff)} compared with ${prevName}.`)],
    });
  }

  if (isCurrent && spent > 0) {
    const days = daysInMonth(input.month);
    const projected = Math.round(((spent / elapsedDays) * days) / 100) * 100;
    notes.push({
      icon: 'gauge',
      color: '#3B82F6',
      segments: [
        plain("At this pace you'll spend about "),
        bold(formatMoney(projected)),
        plain(` by the end of the month${prevFullSpent > 0 ? `, against ${formatMoney(prevFullSpent)} in ${prevName}` : ''}.`),
      ],
    });
  }

  if (spent > 0 && recurringOut > 0) {
    notes.push({
      icon: 'repeat',
      color: '#8B5CF6',
      segments: [
        plain('Recurring items made up '),
        bold(`${Math.round((recurringOut / spent) * 100)}%`),
        plain(` of your spending. The other ${formatMoney(spent - recurringOut)} was day-to-day.`),
      ],
    });
  }

  const over = spending.filter((c) => c.budget_minor !== null && c.total_minor > c.budget_minor);
  if (over.length === 1) {
    notes.push({
      icon: 'triangle-alert',
      color: '#FF8A00',
      segments: [bold(over[0].name), plain(` is over budget this month by ${formatMoney(over[0].total_minor - (over[0].budget_minor ?? 0))}.`)],
    });
  } else if (over.length > 1) {
    notes.push({
      icon: 'triangle-alert',
      color: '#FF8A00',
      segments: [bold(`${over.length} categories`), plain(' are over budget this month.')],
    });
  }
  return notes;
}
