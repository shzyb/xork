import { daysInMonth, monthName, prettyDate } from './dates';
import { vsUsual } from './insights';
import { formatMoney } from './money';
import type { CategorySpend, DaySpend, MonthTotals, Recurring } from './types';

export type Note = {
  icon: 'triangle-alert' | 'gauge' | 'receipt' | 'trending-up' | 'calendar' | 'wallet' | 'piggy-bank';
  tone: 'good' | 'bad' | 'warn' | 'neutral';
  value: string; // the big number or percentage at the top of the card
  detail: string; // one sentence saying what it means
  categoryId?: number; // set when the note is about one category, so the card can open it
  budget?: number; // a suggested budget: the card opens the category's edit screen with it filled in
};

// Warnings come first, then what explains the month, then good news. Within each, the most money first.
type Ranked = Note & { tier: 0 | 1 | 2; amount: number };

// "Dining out", "Dining out and Fuel", "Dining out, Fuel and Rent", "Dining out, Fuel and 2 more".
function nameList(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

const monthsBetween = (from: string, to: string) =>
  (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7));

// The "Worth a look" cards: at most three, the most important first.
export function buildNotes(input: {
  month: string;
  isCurrent: boolean;
  todayDate: string;
  spent: number;
  usualSpent: number | null;
  spending: CategorySpend[];
  usualByCategory: Map<number, number>;
  biggest: { amount_minor: number; label: string } | null; // the largest one-off expense of the month
  recurring: Recurring[];
  payday: string | null; // the date of the month's biggest income
  dayToDay: DaySpend[]; // spending that isn't recurring, by day
  monthly: MonthTotals[]; // the last 6 months, oldest first
}): Note[] {
  const { month, isCurrent, todayDate, spent, usualSpent, spending, biggest } = input;
  const notes: Ranked[] = [];
  const name = monthName(month);

  const over = spending.filter((c) => c.budget_minor !== null && c.total_minor > c.budget_minor);
  const overBy = (c: CategorySpend) => c.total_minor - (c.budget_minor ?? 0);
  if (over.length === 1) {
    notes.push({
      tier: 0, amount: overBy(over[0]), icon: 'triangle-alert', tone: 'warn', value: formatMoney(overBy(over[0])),
      detail: `Over your ${over[0].name} budget in ${name}.`, categoryId: over[0].id,
    });
  } else if (over.length > 1) {
    notes.push({
      tier: 0, amount: over.reduce((sum, c) => sum + overBy(c), 0), icon: 'triangle-alert', tone: 'warn', value: String(over.length),
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
    const daysLeft = daysInMonth(month) - Number(todayDate.slice(8));
    notes.push({
      tier: 0, amount: nearly[0].total_minor, icon: 'gauge', tone: 'warn', value: `${Math.round((nearly[0].total_minor / budget) * 100)}%`,
      detail: `Of your ${nearly[0].name} budget is used. ${formatMoney(budget - nearly[0].total_minor)} left${daysLeft > 0 ? ` for ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}` : ''}.`,
      categoryId: nearly[0].id,
    });
  } else if (nearly.length > 1) {
    notes.push({
      tier: 0, amount: nearly.reduce((sum, c) => sum + c.total_minor, 0), icon: 'gauge', tone: 'warn', value: String(nearly.length),
      detail: `Categories have used at least 80% of their budget: ${nameList(nearly.map((c) => c.name))}.`,
    });
  }

  // A big month mostly explained by one purchase.
  const excess = usualSpent ? spent - usualSpent : 0;
  if (usualSpent && excess >= usualSpent * 0.1 && biggest && biggest.amount_minor >= excess * 0.5) {
    notes.push({
      tier: 1, amount: biggest.amount_minor, icon: 'receipt', tone: 'neutral', value: formatMoney(biggest.amount_minor),
      detail: `${biggest.label} was most of why ${name} ${isCurrent ? 'is' : 'was'} above your usual.`,
    });
  }

  // The category furthest above its usual that has no budget yet: suggest the usual as one.
  const above = spending
    .filter((c) => c.budget_minor === null)
    .map((c) => ({ c, diff: vsUsual(c.total_minor, input.usualByCategory.get(c.id), isCurrent) ?? 0 }))
    .filter((x) => x.diff > 0)
    .sort((a, b) => b.diff - a.diff)[0];
  if (above) {
    const budget = Math.round((input.usualByCategory.get(above.c.id) ?? 0) / 100) * 100; // whole units, to type easily
    notes.push({
      tier: 1, amount: above.diff, icon: 'trending-up', tone: 'bad', value: formatMoney(above.diff),
      detail: `More than usual on ${above.c.name}. Tap to set a ${formatMoney(budget)} budget.`,
      categoryId: above.c.id, budget,
    });
  }

  // The biggest yearly bill due in the next six months, spread over the months left to save for it.
  if (isCurrent) {
    const bill = input.recurring
      .map((r) => ({ r, months: monthsBetween(month, r.next_date.slice(0, 7)) }))
      .filter((x) => x.r.active && x.r.type === 'expense' && x.r.freq === 'yearly' && x.months >= 1 && x.months <= 6)
      .sort((a, b) => b.r.amount_minor - a.r.amount_minor)[0];
    if (bill) {
      const perMonth = Math.round(bill.r.amount_minor / bill.months);
      notes.push({
        tier: 1, amount: perMonth, icon: 'calendar', tone: 'neutral', value: `${formatMoney(perMonth)} a month`,
        detail: `${bill.r.name} of ${formatMoney(bill.r.amount_minor)} is due on ${prettyDate(bill.r.next_date)}. Put this aside ${bill.months === 1 ? 'this month' : 'each month until then'}.`,
      });
    }
  }

  // Spending that bunches up in the week after payday. Only for a finished month with that whole week in it.
  const payday = input.payday ? Number(input.payday.slice(8)) : 0;
  const dayToDayTotal = input.dayToDay.reduce((sum, d) => sum + d.total_minor, 0);
  if (!isCurrent && payday > 0 && payday + 6 <= daysInMonth(month) && input.dayToDay.length >= 5 && dayToDayTotal > 0) {
    const week = input.dayToDay.filter((d) => d.day >= payday && d.day <= payday + 6).reduce((sum, d) => sum + d.total_minor, 0);
    const share = Math.round((week / dayToDayTotal) * 100);
    if (share >= 40) {
      notes.push({
        tier: 1, amount: week, icon: 'wallet', tone: 'neutral', value: `${share}%`,
        detail: `Of your day-to-day spending was in the week after payday.`,
      });
    }
  }

  let streak = 0;
  let saved = 0;
  const { monthly } = input;
  for (let i = monthly.findIndex((m) => m.month === month); i >= 0 && monthly[i].in_minor > monthly[i].out_minor; i--) {
    streak++;
    saved += monthly[i].in_minor - monthly[i].out_minor;
  }
  if (streak >= 2) {
    notes.push({
      tier: 2, amount: saved, icon: 'piggy-bank', tone: 'good', value: formatMoney(saved),
      detail: `You've saved this amount over ${streak} months running.`,
    });
  }

  return notes
    .sort((a, b) => a.tier - b.tier || b.amount - a.amount)
    .slice(0, 3)
    .map(({ tier, amount, ...note }) => note);
}
