import { BACKUP_VERSION, parseBackup } from '../backup';
import type { Backup } from '../backup';

const valid = (): Backup => ({
  app: 'hisaab',
  version: BACKUP_VERSION,
  exported_at: '2026-09-30T10:00:00.000Z',
  currency: 'PKR',
  accounts: [
    { id: 1, name: 'Cash', type: 'cash', opening_minor: 0, color: '#FF9F0A', limit_minor: null, due_day: null, created_at: 'x' },
    { id: 2, name: 'Bank', type: 'debit', opening_minor: 500000, color: '#3B82F6', limit_minor: null, due_day: null, created_at: 'x' },
  ],
  categories: [
    { id: 1, name: 'Groceries', kind: 'expense', icon: 'shopping-cart', color: '#34A853', budget_minor: 4500000, is_default: 0, sort_order: 0 },
    { id: 2, name: 'Other', kind: 'expense', icon: 'tag', color: '#64748B', budget_minor: null, is_default: 1, sort_order: 0 },
    { id: 3, name: 'Salary', kind: 'income', icon: 'briefcase', color: '#16A34A', budget_minor: null, is_default: 0, sort_order: 0 },
    { id: 4, name: 'Other income', kind: 'income', icon: 'sparkle', color: '#64748B', budget_minor: null, is_default: 1, sort_order: 0 },
  ],
  recurring: [
    { id: 1, name: 'Rent', type: 'expense', amount_minor: 8500000, account_id: 2, category_id: 1, freq: 'monthly', anchor_day: 1, next_date: '2026-10-01', active: 1 },
  ],
  transactions: [
    { id: 1, type: 'expense', amount_minor: 45000, account_id: 1, to_account_id: null, category_id: 1, note: 'Lunch', date: '2026-09-30', recurring_id: null, created_at: 'x' },
    { id: 2, type: 'income', amount_minor: 20000000, account_id: 2, to_account_id: null, category_id: 3, note: '', date: '2026-09-01', recurring_id: null, created_at: 'x' },
    { id: 3, type: 'transfer', amount_minor: 100000, account_id: 2, to_account_id: 1, category_id: null, note: '', date: '2026-09-02', recurring_id: null, created_at: 'x' },
    { id: 4, type: 'expense', amount_minor: 8500000, account_id: 2, to_account_id: null, category_id: 1, note: 'Rent', date: '2026-09-01', recurring_id: 1, created_at: 'x' },
  ],
});

const parse = (b: unknown) => parseBackup(JSON.stringify(b));
const change = (edit: (b: Backup) => void) => {
  const b = valid();
  edit(b);
  return parse(b);
};

describe('parseBackup', () => {
  it('accepts a good backup and returns it', () => {
    const result = parse(valid());
    expect(result).toEqual({ ok: true, backup: valid() });
  });

  it('treats accounts from older backups as cash and rejects an unknown type', () => {
    const old = valid() as unknown as { accounts: Record<string, unknown>[] };
    delete old.accounts[0].type;
    const result = parse(old);
    expect(result.ok && result.backup.accounts[0].type).toBe('cash');

    const bad = valid() as unknown as { accounts: Record<string, unknown>[] };
    bad.accounts[0].type = 'loan';
    expect(parse(bad).ok).toBe(false);
  });

  it('treats a missing limit and due day as empty, and rejects bad ones', () => {
    const old = valid() as unknown as { accounts: Record<string, unknown>[] };
    delete old.accounts[0].limit_minor;
    delete old.accounts[0].due_day;
    const result = parse(old);
    expect(result.ok && [result.backup.accounts[0].limit_minor, result.backup.accounts[0].due_day]).toEqual([null, null]);

    for (const [field, value] of [['limit_minor', 0], ['limit_minor', 1.5], ['due_day', 0], ['due_day', 32], ['due_day', '15']]) {
      const bad = valid() as unknown as { accounts: Record<string, unknown>[] };
      bad.accounts[0][field] = value;
      expect(parse(bad).ok).toBe(false);
    }

    const card = valid() as unknown as { accounts: Record<string, unknown>[] };
    Object.assign(card.accounts[0], { type: 'credit', limit_minor: 5000000, due_day: 15 });
    expect(parse(card).ok).toBe(true);
  });

  it('rejects text that is not JSON or not a Xork file', () => {
    const notBackup = { ok: false, error: "This isn't a Xork backup file." };
    expect(parseBackup('hello')).toEqual(notBackup);
    expect(parseBackup('[]')).toEqual(notBackup);
    expect(parse({ app: 'other' })).toEqual(notBackup);
  });

  it('rejects a newer or unknown version', () => {
    expect(change((b) => { b.version = 2; })).toEqual({ ok: false, error: 'This backup is from a newer version of Xork.' });
    expect(change((b) => { (b as unknown as { version: string }).version = 'one'; })).toEqual({ ok: false, error: 'This backup file is damaged.' });
  });

  it('rejects a currency we do not support', () => {
    expect(change((b) => { b.currency = 'XYZ'; })).toMatchObject({ ok: false, error: expect.stringContaining('currency') });
  });

  it('rejects missing lists', () => {
    const b = valid() as unknown as Record<string, unknown>;
    delete b.transactions;
    expect(parse(b)).toEqual({ ok: false, error: 'This backup file is damaged.' });
  });

  it('accepts a backup from before categories had an order, but not a damaged order', () => {
    expect(change((b) => { delete (b.categories[0] as Partial<typeof b.categories[0]>).sort_order; }).ok).toBe(true);
    expect(change((b) => { (b.categories[0] as unknown as { sort_order: string }).sort_order = 'first'; }).ok).toBe(false);
  });

  it('rejects damaged records', () => {
    expect(change((b) => { (b.accounts[0] as unknown as { name: number }).name = 5; }).ok).toBe(false);
    expect(change((b) => { b.categories[0].kind = 'other' as 'expense'; }).ok).toBe(false);
    expect(change((b) => { b.transactions[0].amount_minor = 1.5; }).ok).toBe(false);
    expect(change((b) => { b.transactions[0].date = '30/09/2026'; }).ok).toBe(false);
    expect(change((b) => { b.recurring[0].freq = 'daily' as 'weekly'; }).ok).toBe(false);
  });

  it('rejects duplicate ids and an empty account list', () => {
    expect(change((b) => { b.accounts[1].id = 1; })).toEqual({ ok: false, error: 'This backup lists the same account twice.' });
    expect(change((b) => { b.categories[1].id = 1; })).toEqual({ ok: false, error: 'This backup lists the same category twice.' });
    expect(change((b) => { b.accounts = []; b.transactions = []; b.recurring = []; })).toEqual({ ok: false, error: 'This backup has no accounts.' });
  });

  it('needs exactly one Other category per kind', () => {
    const missing = { ok: false, error: 'This backup is missing an Other category.' };
    expect(change((b) => { b.categories[3].is_default = 0; })).toEqual(missing);
    expect(change((b) => { b.categories[0].is_default = 1; })).toEqual(missing);
  });

  it('rejects transactions that point at things that do not exist', () => {
    const points = { ok: false, error: expect.stringContaining('points at a missing') };
    expect(change((b) => { b.transactions[0].account_id = 99; })).toMatchObject(points);
    expect(change((b) => { b.transactions[0].category_id = 99; })).toMatchObject(points);
    expect(change((b) => { b.transactions[0].category_id = 3; })).toMatchObject(points); // an income category on an expense
    expect(change((b) => { b.transactions[0].category_id = null; })).toMatchObject(points);
    expect(change((b) => { b.transactions[2].to_account_id = null; })).toMatchObject(points);
    expect(change((b) => { b.transactions[2].to_account_id = 2; })).toMatchObject(points); // a transfer to itself
    expect(change((b) => { b.transactions[3].recurring_id = 99; })).toMatchObject(points);
  });

  it('rejects recurring items that point at things that do not exist', () => {
    expect(change((b) => { b.recurring[0].account_id = 99; })).toMatchObject({ ok: false });
    expect(change((b) => { b.recurring[0].category_id = 3; })).toMatchObject({ ok: false });
  });
});
