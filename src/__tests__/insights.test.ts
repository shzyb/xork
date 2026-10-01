import { setAppCurrency } from '../money';
import { budgetStatus, buildNotes, creditStatus, delta, dueText, keptPercent, runningTotal, spendComparison } from '../insights';
import type { CategorySpend } from '../types';

beforeEach(() => setAppCurrency('USD'));

const cat = (id: number, name: string, total_minor: number, budget_minor: number | null = null): CategorySpend => ({
  id, name, icon: 'tag', color: '#000', budget_minor, total_minor,
});

describe('runningTotal', () => {
  it('adds up by day and carries the total over days with no spending', () => {
    const daily = [{ day: 1, total_minor: 100 }, { day: 3, total_minor: 50 }];
    expect(runningTotal(daily, 5)).toEqual([100, 100, 150, 150, 150]);
  });

  it('ignores days after the chart length (a longer month cut to a shorter one)', () => {
    expect(runningTotal([{ day: 2, total_minor: 10 }, { day: 31, total_minor: 999 }], 3)).toEqual([0, 10, 10]);
  });

  it('is flat zero with no spending', () => {
    expect(runningTotal([], 3)).toEqual([0, 0, 0]);
  });
});

describe('delta', () => {
  it('shows the percent change', () => {
    expect(delta(118, 100)).toEqual({ kind: 'up', percent: 18 });
    expect(delta(60, 100)).toEqual({ kind: 'down', percent: 40 });
  });

  it('calls tiny changes the same, and new spending new', () => {
    expect(delta(101, 100)).toEqual({ kind: 'same', percent: 0 });
    expect(delta(500, 0)).toEqual({ kind: 'new', percent: 0 });
  });

  it('shows nothing when there is no spending in either month', () => {
    expect(delta(0, 0)).toBeNull();
  });
});

describe('keptPercent', () => {
  it('is the share of income left over, or null with no income', () => {
    expect(keptPercent(200000, 150000)).toBe(25);
    expect(keptPercent(100000, 130000)).toBe(-30);
    expect(keptPercent(0, 5000)).toBeNull();
  });
});

describe('budgetStatus', () => {
  it('is ok, warns above 85% and is over past the budget', () => {
    expect(budgetStatus(50000, 100000)).toMatchObject({ state: 'ok', text: '$500.00 left of $1,000.00' });
    expect(budgetStatus(90000, 100000)).toMatchObject({ state: 'warn', percent: 90 });
    expect(budgetStatus(120000, 100000)).toMatchObject({ state: 'over', text: '$200.00 over a $1,000.00 budget' });
  });
});

describe('spendComparison', () => {
  it('says more or less than last month, naming the same point for the current month', () => {
    expect(spendComparison(120000, 100000, true, '2026-08')).toEqual({ more: true, text: '$200.00 more than this point in August' });
    expect(spendComparison(80000, 100000, false, '2026-08')).toEqual({ more: false, text: '$200.00 less than August' });
  });

  it('is null when last month has nothing', () => {
    expect(spendComparison(100, 0, true, '2026-08')).toBeNull();
  });
});

describe('buildNotes', () => {
  const base = {
    month: '2026-09', prevMonth: '2026-08', isCurrent: false, elapsedDays: 30, spent: 100000,
    prevFullSpent: 90000, recurringOut: 0, spending: [] as CategorySpend[], prevSpending: [] as CategorySpend[],
  };
  const text = (notes: ReturnType<typeof buildNotes>) => notes.map((n) => n.segments.map((s) => s.text).join(''));

  it('reports the biggest rise and the biggest cut against last month', () => {
    const notes = buildNotes({
      ...base,
      spending: [cat(1, 'Groceries', 40000), cat(2, 'Dining out', 10000), cat(3, 'Fuel', 5000)],
      prevSpending: [cat(1, 'Groceries', 30000), cat(2, 'Dining out', 20000), cat(3, 'Fuel', 5000)],
    });
    expect(text(notes)).toEqual([
      'Groceries rose 33% on August, $100.00 more.',
      'You cut Dining out by $100.00 compared with August.',
    ]);
  });

  it('ignores small changes', () => {
    const notes = buildNotes({
      ...base,
      spending: [cat(1, 'Groceries', 31000)],
      prevSpending: [cat(1, 'Groceries', 30000)],
    });
    expect(notes).toEqual([]);
  });

  it('projects the month-end spending only for the current month', () => {
    const current = buildNotes({ ...base, isCurrent: true, elapsedDays: 10, spent: 30000 });
    expect(text(current)).toEqual(["At this pace you'll spend about $900.00 by the end of the month, against $900.00 in August."]);
    expect(buildNotes({ ...base, spent: 30000 })).toEqual([]);
  });

  it('shows the recurring share', () => {
    const notes = buildNotes({ ...base, spent: 100000, recurringOut: 25000 });
    expect(text(notes)).toEqual(['Recurring items made up 25% of your spending. The other $750.00 was day-to-day.']);
  });

  it('flags one or several categories over budget', () => {
    const one = buildNotes({ ...base, spending: [cat(1, 'Dining out', 30000, 20000)] });
    expect(text(one)).toEqual(['Dining out is over budget this month by $100.00.']);
    const two = buildNotes({ ...base, spending: [cat(1, 'Dining out', 30000, 20000), cat(2, 'Fuel', 9000, 5000)] });
    expect(text(two)).toEqual(['2 categories are over budget this month.']);
  });
});

describe('creditStatus', () => {
  it('is fine below 80%', () => {
    expect(creditStatus(79000, 100000)).toEqual({ percent: 79, state: 'ok', left: 21000 });
  });
  it('warns from 80% and goes red from 95%', () => {
    expect(creditStatus(80000, 100000).state).toBe('warn');
    expect(creditStatus(94000, 100000).state).toBe('warn');
    expect(creditStatus(95000, 100000).state).toBe('high');
    expect(creditStatus(99000, 100000).state).toBe('high');
  });
  it('is full at the limit, and nothing is left when over it', () => {
    expect(creditStatus(100000, 100000)).toEqual({ percent: 100, state: 'full', left: 0 });
    expect(creditStatus(120000, 100000).left).toBe(0);
  });
  it('treats a card that is in credit as 0% used', () => {
    expect(creditStatus(-5000, 100000)).toEqual({ percent: 0, state: 'ok', left: 105000 });
  });
});

describe('dueText', () => {
  it('counts down in the last week and names the day otherwise', () => {
    expect(dueText(15, '2026-10-15')).toBe('due today');
    expect(dueText(15, '2026-10-14')).toBe('due tomorrow');
    expect(dueText(15, '2026-10-10')).toBe('due in 5 days');
    expect(dueText(15, '2026-10-01')).toBe('due on the 15th');
  });
  it('rolls over to next month once the day has passed', () => {
    expect(dueText(2, '2026-10-30')).toBe('due in 3 days');
    expect(dueText(15, '2026-10-16')).toBe('due on the 15th');
  });
  it('uses the last day of a short month', () => {
    expect(dueText(31, '2026-02-27')).toBe('due tomorrow');
    expect(dueText(31, '2026-02-01')).toBe('due on the 31st');
  });
  it('writes the right ordinal', () => {
    expect(dueText(1, '2026-10-20')).toBe('due on the 1st');
    expect(dueText(2, '2026-10-20')).toBe('due on the 2nd');
    expect(dueText(23, '2026-10-01')).toBe('due on the 23rd');
    expect(dueText(11, '2026-10-01')).toBe('due on the 11th');
  });
});
