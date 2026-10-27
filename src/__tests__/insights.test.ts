import { setAppCurrency } from '../money';
import { budgetStatus, creditStatus, dayParts, dueText, netWorthSeries, runningTotal } from '../insights';

beforeEach(() => setAppCurrency('USD'));

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

describe('netWorthSeries', () => {
  it('starts from the balance before the month and carries it forward on quiet days', () => {
    const daily = [{ day: 2, total_minor: -3000 }, { day: 4, total_minor: 10000 }];
    expect(netWorthSeries(50000, daily, 5)).toEqual([50000, 47000, 47000, 57000, 57000]);
  });

  it('can go below zero', () => {
    expect(netWorthSeries(-1000, [{ day: 1, total_minor: -500 }], 2)).toEqual([-1500, -1500]);
  });
});

describe('budgetStatus', () => {
  it('is ok, warns above 85% and is over past the budget', () => {
    expect(budgetStatus(50000, 100000)).toMatchObject({ state: 'ok', text: '$500.00 left of $1,000.00' });
    expect(budgetStatus(90000, 100000)).toMatchObject({ state: 'warn', percent: 90 });
    expect(budgetStatus(120000, 100000)).toMatchObject({ state: 'over', text: '$200.00 over a $1,000.00 budget' });
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

describe('dayParts', () => {
  const rows = [
    { day: 1, category_id: 1, total_minor: 500 },
    { day: 1, category_id: 2, total_minor: 900 },
    { day: 3, category_id: 1, total_minor: 100 },
    ...[3, 4, 5, 6, 7].map((id) => ({ day: 4, category_id: id, total_minor: id * 10 })),
  ];

  it('lists each day biggest first and leaves quiet days empty', () => {
    const parts = dayParts(rows, 3);
    expect(parts[0]).toEqual([{ category_id: 2, total_minor: 900 }, { category_id: 1, total_minor: 500 }]);
    expect(parts[1]).toEqual([]);
    expect(parts[2]).toEqual([{ category_id: 1, total_minor: 100 }]);
  });

  it('keeps the 4 biggest and groups the rest as one part with no category', () => {
    const parts = dayParts(rows, 4)[3];
    expect(parts.map((p) => p.category_id)).toEqual([7, 6, 5, 4, null]);
    expect(parts[4].total_minor).toBe(30);
  });
});
