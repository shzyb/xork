import { setAppCurrency } from '../money';
import { buildNotes } from '../notes';
import type { CategorySpend, DaySpend, MonthTotals, Recurring } from '../types';

beforeEach(() => setAppCurrency('USD'));

const cat = (id: number, name: string, total_minor: number, budget_minor: number | null = null): CategorySpend => ({
  id, name, icon: 'tag', color: '#000', budget_minor, total_minor, count: 1,
});

const base = {
  month: '2026-09',
  isCurrent: false,
  todayDate: '2026-10-15',
  spent: 100000,
  usualSpent: null as number | null,
  spending: [] as CategorySpend[],
  usualByCategory: new Map<number, number>(),
  biggest: null as { amount_minor: number; label: string } | null,
  recurring: [] as Recurring[],
  payday: null as string | null,
  dayToDay: [] as DaySpend[],
  monthly: [] as MonthTotals[],
};
const text = (notes: ReturnType<typeof buildNotes>) => notes.map((n) => `${n.value}. ${n.detail}`);

describe('buildNotes', () => {
  it('is empty when nothing stands out', () => {
    expect(buildNotes(base)).toEqual([]);
  });

  it('flags one or several categories over budget', () => {
    const one = buildNotes({ ...base, spending: [cat(1, 'Dining out', 30000, 20000)] });
    expect(text(one)).toEqual(['$100.00. Over your Dining out budget in September.']);
    const two = buildNotes({ ...base, spending: [cat(1, 'Dining out', 30000, 20000), cat(2, 'Fuel', 9000, 5000)] });
    expect(text(two)).toEqual(['2. Categories are over budget: Dining out and Fuel.']);
  });

  it('warns when a category has used 80% of its budget this month, not in a finished one', () => {
    const spending = [cat(1, 'Dining out', 9000, 10000), cat(2, 'Fuel', 5000, 10000)];
    const notes = buildNotes({ ...base, isCurrent: true, todayDate: '2026-09-20', spending });
    expect(text(notes)).toEqual(['90%. Of your Dining out budget is used. $10.00 left for 10 days.']);
    expect(buildNotes({ ...base, spending })).toEqual([]);
  });

  it('names the one purchase behind a month above usual', () => {
    const notes = buildNotes({ ...base, spent: 150000, usualSpent: 100000, biggest: { amount_minor: 40000, label: 'Laptop' } });
    expect(text(notes)).toEqual(['$400.00. Laptop was most of why September was above your usual.']);
    expect(buildNotes({ ...base, spent: 150000, usualSpent: 100000, biggest: { amount_minor: 20000, label: 'Shoes' } })).toEqual([]);
  });

  it('suggests the usual as a budget for a category above it that has none', () => {
    const usualByCategory = new Map([[1, 8000], [2, 1000]]);
    const notes = buildNotes({ ...base, usualByCategory, spending: [cat(1, 'Dining out', 14200), cat(2, 'Fuel', 5000, 4000)] });
    expect(text(notes)).toEqual([
      '$10.00. Over your Fuel budget in September.',
      '$62.00. More than usual on Dining out. Tap to set a $80.00 budget.',
    ]);
    expect(notes[1]).toMatchObject({ categoryId: 1, budget: 8000 });
  });

  it('spreads a yearly bill over the months left before it is due', () => {
    const bill: Recurring = {
      id: 1, name: 'Car insurance', type: 'expense', amount_minor: 2500000, account_id: 1, category_id: 1,
      freq: 'yearly', anchor_day: 12, next_date: '2026-12-12', active: 1,
    };
    const current = { ...base, month: '2026-10', isCurrent: true };
    const notes = buildNotes({ ...current, recurring: [bill] });
    expect(notes[0].value).toBe('$12,500.00 a month');
    expect(notes[0].detail).toMatch(/^Car insurance of \$25,000\.00 is due on .*12 Dec.*\. Put this aside each month until then\.$/);
    expect(buildNotes({ ...current, recurring: [{ ...bill, next_date: '2026-10-28' }] })).toEqual([]); // already in this month's bills
    expect(buildNotes({ ...current, recurring: [{ ...bill, next_date: '2027-06-12' }] })).toEqual([]); // too far off
  });

  it('notices day-to-day spending bunched in the week after payday', () => {
    const d = (day: number, total_minor: number) => ({ day, total_minor });
    const dayToDay = [d(10, 3000), d(12, 3000), d(15, 2000), d(20, 1000), d(25, 1000)];
    expect(text(buildNotes({ ...base, payday: '2026-09-10', dayToDay }))).toEqual(['80%. Of your day-to-day spending was in the week after payday.']);
    expect(buildNotes({ ...base, payday: '2026-09-28', dayToDay })).toEqual([]); // the week runs past the month
    expect(buildNotes({ ...base, isCurrent: true, payday: '2026-09-10', dayToDay })).toEqual([]);
  });

  it('counts months of saving in a row up to the chosen month', () => {
    const m = (month: string, in_minor: number, out_minor: number): MonthTotals => ({ month, in_minor, out_minor });
    const monthly = [m('2026-06', 100, 200), m('2026-07', 300, 100), m('2026-08', 300, 100), m('2026-09', 300, 100), m('2026-10', 100, 200)];
    expect(text(buildNotes({ ...base, monthly }))).toEqual(["$6.00. You've saved this amount over 3 months running."]);
    expect(buildNotes({ ...base, month: '2026-10', monthly })).toEqual([]);
  });

  it('shows at most three: warnings first, then the most money, good news last', () => {
    const m = (month: string): MonthTotals => ({ month, in_minor: 300, out_minor: 100 });
    const notes = buildNotes({
      ...base,
      spent: 150000,
      usualSpent: 100000,
      biggest: { amount_minor: 40000, label: 'Laptop' },
      usualByCategory: new Map([[1, 8000]]),
      spending: [cat(1, 'Dining out', 50000), cat(2, 'Fuel', 5000, 4000)],
      monthly: [m('2026-08'), m('2026-09')],
    });
    // Dining out is $420 above usual, more than the $400 laptop; the saving streak doesn't make the cut.
    expect(notes.map((n) => n.icon)).toEqual(['triangle-alert', 'trending-up', 'receipt']);
  });
});
