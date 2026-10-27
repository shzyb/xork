import { parseBackup } from '../backup';
import { buildDemoBackup } from '../demoData';

const demo = () => buildDemoBackup('USD', '2026-10-19');

describe('buildDemoBackup', () => {
  it('is a valid backup that restores', () => {
    expect(parseBackup(JSON.stringify(demo())).ok).toBe(true);
  });

  it('covers two years up to today and not beyond', () => {
    const dates = demo().transactions.map((t) => t.date).sort();
    expect(dates[0] <= '2024-11-01').toBe(true);
    expect(dates[dates.length - 1] <= '2026-10-19').toBe(true);
    expect(demo().transactions.length).toBeGreaterThan(1000);
  });

  it('gives the same data every time', () => {
    expect(demo().transactions).toEqual(demo().transactions);
  });

  it('keeps recurring items due after today and cash, bank and savings from going below zero', () => {
    const backup = demo();
    expect(backup.recurring.every((r) => r.next_date > '2026-10-19')).toBe(true);
    for (const a of backup.accounts.filter((x) => x.type !== 'credit')) {
      const net = backup.transactions.reduce((sum, t) => {
        if (t.account_id === a.id) sum += t.type === 'income' ? t.amount_minor : -t.amount_minor;
        if (t.to_account_id === a.id) sum += t.amount_minor;
        return sum;
      }, a.opening_minor);
      expect(net).toBeGreaterThanOrEqual(0);
    }
  });

  it('scales amounts up for currencies without decimals', () => {
    const total = (b: ReturnType<typeof demo>) => b.transactions.reduce((sum, t) => sum + t.amount_minor, 0);
    expect(total(buildDemoBackup('PKR', '2026-10-19'))).toBeGreaterThan(total(demo()) * 50);
  });
});
