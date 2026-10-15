import { setAppCurrency } from '../money';
import { biggestPriceRise, budgetStatus, categoryUsual, creditStatus, dueText, forecast, keptPercent, netWorthSeries, runningTotal, runway, stillDue, usual, vsUsual, yearlyCost } from '../insights';
import type { Recurring } from '../types';

beforeEach(() => setAppCurrency('USD'));

const item = (id: number, over: Partial<Recurring>): Recurring => ({
  id, name: `Item ${id}`, type: 'expense', amount_minor: 1000, account_id: 1, category_id: 1,
  freq: 'monthly', anchor_day: 1, next_date: '2026-11-01', active: 1, ...over,
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

describe('netWorthSeries', () => {
  it('starts from the balance before the month and carries it forward on quiet days', () => {
    const daily = [{ day: 2, total_minor: -3000 }, { day: 4, total_minor: 10000 }];
    expect(netWorthSeries(50000, daily, 5)).toEqual([50000, 47000, 47000, 57000, 57000]);
  });

  it('can go below zero', () => {
    expect(netWorthSeries(-1000, [{ day: 1, total_minor: -500 }], 2)).toEqual([-1500, -1500]);
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

describe('usual', () => {
  it('is the middle of the earlier months, so one odd month does not move it', () => {
    expect(usual([3000, 1000, 2000])).toBe(2000);
    expect(usual([1000, 1100, 1200, 9000])).toBe(1150);
  });

  it('needs at least two months', () => {
    expect(usual([])).toBeNull();
    expect(usual([5000])).toBeNull();
  });
});

describe('categoryUsual', () => {
  const months = ['2026-07', '2026-08', '2026-09'];

  it('counts a month with nothing as zero', () => {
    const rows = [{ id: 1, month: '2026-07', total_minor: 100 }, { id: 1, month: '2026-09', total_minor: 300 }];
    expect(categoryUsual(rows, months).get(1)).toBe(100);
  });

  it('leaves out a category that is usually zero, and everything with under two months', () => {
    expect(categoryUsual([{ id: 2, month: '2026-08', total_minor: 500 }], months).has(2)).toBe(false);
    expect(categoryUsual([{ id: 1, month: '2026-09', total_minor: 300 }], ['2026-09']).size).toBe(0);
  });
});

describe('vsUsual', () => {
  it('reports a difference of a fifth or more either way', () => {
    expect(vsUsual(1300, 1000, false)).toBe(300);
    expect(vsUsual(700, 1000, false)).toBe(-300);
    expect(vsUsual(1100, 1000, false)).toBeNull();
  });

  it('only calls a running month above usual, and needs a usual', () => {
    expect(vsUsual(700, 1000, true)).toBeNull();
    expect(vsUsual(1300, 1000, true)).toBe(300);
    expect(vsUsual(1300, null, false)).toBeNull();
    expect(vsUsual(1300, 0, false)).toBeNull();
  });
});

describe('stillDue', () => {
  it('adds up bills and income still to come this month, skipping paused items', () => {
    const items = [
      item(1, { freq: 'weekly', amount_minor: 2000, next_date: '2026-10-20' }), // the 20th and the 27th
      item(2, { amount_minor: 50000, next_date: '2026-11-01' }), // next month
      item(3, { type: 'income', amount_minor: 300000, next_date: '2026-10-30' }),
      item(4, { amount_minor: 9999, next_date: '2026-10-25', active: 0 }),
    ];
    expect(stillDue(items, '2026-10-15', '2026-10')).toEqual({ bills: 4000, income: 300000 });
  });
});

describe('forecast', () => {
  it('scales only day-to-day spending up to the whole month', () => {
    const result = forecast({
      inSoFar: 18500000, outSoFar: 10200000, fixedPaid: 6200000, due: { bills: 1400000, income: 0 }, elapsedDays: 15, days: 31,
    });
    expect(result).toEqual({ income: 18500000, spend: 6200000 + 1400000 + 8266700 });
  });

  it('does not multiply rent paid on the 1st', () => {
    const result = forecast({ inSoFar: 0, outSoFar: 5000000, fixedPaid: 5000000, due: { bills: 0, income: 0 }, elapsedDays: 3, days: 31 });
    expect(result.spend).toBe(5000000);
  });

  it('counts recurring income still to come', () => {
    const result = forecast({ inSoFar: 0, outSoFar: 0, fixedPaid: 0, due: { bills: 0, income: 300000 }, elapsedDays: 5, days: 30 });
    expect(result.income).toBe(300000);
  });
});

describe('runway', () => {
  it('is what the accounts hold, less what cards owe, in months of usual spending', () => {
    const accounts = [
      { type: 'cash' as const, balance_minor: 1200000 },
      { type: 'debit' as const, balance_minor: 21000000 },
      { type: 'savings' as const, balance_minor: 30000000 },
      { type: 'credit' as const, balance_minor: -1800000 },
    ];
    expect(runway(accounts, 15000000)).toEqual({ have: 52200000, owed: 1800000, months: 3.4 });
  });

  it('never goes below zero, and a card in credit owes nothing', () => {
    const accounts = [{ type: 'cash' as const, balance_minor: 1000 }, { type: 'credit' as const, balance_minor: -50000 }];
    expect(runway(accounts, 10000).months).toBe(0);
    expect(runway([{ type: 'credit' as const, balance_minor: 500 }], 10000).owed).toBe(0);
  });
});

describe('yearlyCost', () => {
  it('turns each frequency into a year', () => {
    expect(yearlyCost([{ freq: 'monthly', amount_minor: 1000 }, { freq: 'yearly', amount_minor: 12000 }])).toBe(24000);
  });
});

describe('biggestPriceRise', () => {
  it('compares the amount now with the first payment in the logs', () => {
    const items = [item(1, { name: 'Netflix', amount_minor: 1200 }), item(2, { amount_minor: 500 })];
    const logs = [
      { recurring_id: 1, amount_minor: 1000, date: '2026-03-05' },
      { recurring_id: 2, amount_minor: 500, date: '2026-03-05' },
      { recurring_id: 1, amount_minor: 1200, date: '2026-06-05' },
    ];
    expect(biggestPriceRise(items, logs)).toEqual({ name: 'Netflix', percent: 20, since: '2026-03' });
  });

  it('ignores small rises, paused items and items with no payments', () => {
    const logs = [{ recurring_id: 1, amount_minor: 1000, date: '2026-03-05' }];
    expect(biggestPriceRise([item(1, { amount_minor: 1040 })], logs)).toBeNull();
    expect(biggestPriceRise([item(1, { amount_minor: 2000, active: 0 })], logs)).toBeNull();
    expect(biggestPriceRise([item(3, { amount_minor: 2000 })], logs)).toBeNull();
  });
});
