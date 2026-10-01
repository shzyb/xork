import { getRecurringActivity, logRecurringNow, setRecurringActive, skipRecurring, deleteAllData, exportAll, NO_FILTER, replaceAllData, addAccount, addCategory, addRecurring, deleteRecurring, logDueRecurring, updateRecurring, addTransaction, buildFilter, completeWelcome, Db, deleteAccount, deleteCategory, deleteTransaction, getVersion, openDb, setCurrency, subscribe, setTheme, updateAccount, updateCategory, updateTransaction } from '../db';
import { formatMoney } from '../money';

function fakeDb(overrides: Partial<Db> = {}): Db {
  return {
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({}),
    getFirstAsync: jest.fn().mockResolvedValue({ user_version: 4 }),
    getAllAsync: jest.fn().mockResolvedValue([]),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
    ...overrides,
  } as Db;
}

describe('change listeners', () => {
  it('a successful write bumps version and calls listeners', async () => {
    await openDb(fakeDb());
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await setCurrency('USD');

    expect(getVersion()).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('a failed write changes nothing and calls no listeners', async () => {
    await openDb(fakeDb({ runAsync: jest.fn().mockRejectedValue(new Error('disk full')) }));
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await expect(setCurrency('PKR')).rejects.toThrow('disk full');

    expect(getVersion()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    off();
  });

  it('listeners already see the new currency when they are called', async () => {
    await openDb(fakeDb());
    let seen = '';
    const off = subscribe(() => {
      seen = formatMoney(100);
    });

    await setCurrency('PKR');
    expect(seen).toBe('Rs 1');
    await setCurrency('USD');
    expect(seen).toBe('$1.00');
    off();
  });

  it('completeWelcome saves currency and onboarded in one transaction', async () => {
    const db = fakeDb();
    await openDb(db);

    await completeWelcome('AED');

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledWith(expect.any(String), 'currency', 'AED');
    expect(db.runAsync).toHaveBeenCalledWith(expect.any(String), 'onboarded', '1');
  });
});

const LUNCH = {
  type: 'expense' as const,
  amount_minor: 45000,
  account_id: 1,
  to_account_id: null,
  category_id: 2,
  note: 'Lunch',
  date: '2026-09-30',
};

describe('addTransaction', () => {
  it('inserts the row, bumps version and calls listeners', async () => {
    const db = fakeDb();
    await openDb(db);
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await addTransaction(LUNCH);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO transactions'),
      'expense', 45000, 1, null, 2, 'Lunch', '2026-09-30', expect.any(String),
    );
    expect(getVersion()).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('a failed insert changes nothing and calls no listeners', async () => {
    await openDb(fakeDb({ runAsync: jest.fn().mockRejectedValue(new Error('disk full')) }));
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await expect(addTransaction(LUNCH)).rejects.toThrow('disk full');

    expect(getVersion()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    off();
  });
});

describe.each([
  ['updateTransaction', () => updateTransaction(7, LUNCH), 'UPDATE transactions', ['expense', 45000, 1, null, 2, 'Lunch', '2026-09-30', 7]],
  ['deleteTransaction', () => deleteTransaction(7), 'DELETE FROM transactions', [7]],
])('%s', (_name, run, sql, params) => {
  it('runs the statement, bumps version and calls listeners', async () => {
    const db = fakeDb();
    await openDb(db);
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await run();

    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining(sql), ...params);
    expect(getVersion()).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('a failed statement changes nothing and calls no listeners', async () => {
    await openDb(fakeDb({ runAsync: jest.fn().mockRejectedValue(new Error('disk full')) }));
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await expect(run()).rejects.toThrow('disk full');

    expect(getVersion()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    off();
  });
});

const FOOD = { name: 'Food', kind: 'expense' as const, icon: 'utensils', color: '#FF8A00', budget_minor: null };

describe.each([
  ['addAccount', () => addAccount({ name: 'Bank', type: 'debit', opening_minor: 5000, color: '#3B82F6', limit_minor: null, due_day: null }), 'INSERT INTO accounts'],
  ['updateAccount', () => updateAccount(3, { name: 'Bank', type: 'debit', opening_minor: 5000, color: '#3B82F6', limit_minor: null, due_day: null }), 'UPDATE accounts'],
  ['addCategory', () => addCategory(FOOD), 'INSERT INTO categories'],
  ['updateCategory', () => updateCategory(3, FOOD), 'UPDATE categories'],
  ['setTheme', () => setTheme('dark'), 'INSERT OR REPLACE INTO settings'],
])('%s', (_name, run, sql) => {
  it('bumps version and calls listeners', async () => {
    const db = fakeDb();
    await openDb(db);
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await run();

    expect((db.runAsync as jest.Mock).mock.calls[0][0]).toContain(sql);
    expect(getVersion()).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('a failed write changes nothing and calls no listeners', async () => {
    await openDb(fakeDb({ runAsync: jest.fn().mockRejectedValue(new Error('disk full')) }));
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await expect(run()).rejects.toThrow('disk full');

    expect(getVersion()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    off();
  });
});

describe('deleteAccount', () => {
  it('deletes its transactions, recurring items and the account in one SQL transaction', async () => {
    const db = fakeDb();
    await openDb(db);
    const listener = jest.fn();
    const off = subscribe(listener);

    await deleteAccount(4);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    const sql = (db.runAsync as jest.Mock).mock.calls.map((call) => call[0] as string);
    expect(sql).toEqual([
      expect.stringContaining('DELETE FROM transactions WHERE account_id = ? OR to_account_id = ?'),
      expect.stringContaining('DELETE FROM recurring'),
      expect.stringContaining('DELETE FROM accounts'),
    ]);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('a failure part-way changes nothing and calls no listeners', async () => {
    const runAsync = jest.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('disk full'));
    await openDb(fakeDb({ runAsync }));
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await expect(deleteAccount(4)).rejects.toThrow('disk full');

    expect(getVersion()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    off();
  });
});

describe('deleteCategory', () => {
  it('moves transactions and recurring items to Other, then deletes, in one SQL transaction', async () => {
    const getFirstAsync = jest
      .fn()
      .mockResolvedValueOnce({ user_version: 4 })
      .mockResolvedValueOnce(null) // currency setting during openDb
      .mockResolvedValueOnce({ kind: 'expense', is_default: 0 })
      .mockResolvedValueOnce({ id: 24 });
    const db = fakeDb({ getFirstAsync });
    await openDb(db);
    const listener = jest.fn();
    const off = subscribe(listener);

    await deleteCategory(9);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenNthCalledWith(1, expect.stringContaining('UPDATE transactions SET category_id'), 24, 9);
    expect(db.runAsync).toHaveBeenNthCalledWith(2, expect.stringContaining('UPDATE recurring SET category_id'), 24, 9);
    expect(db.runAsync).toHaveBeenNthCalledWith(3, expect.stringContaining('DELETE FROM categories'), 9);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('refuses to delete an Other category and changes nothing', async () => {
    const getFirstAsync = jest
      .fn()
      .mockResolvedValueOnce({ user_version: 4 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ kind: 'expense', is_default: 1 });
    const db = fakeDb({ getFirstAsync });
    await openDb(db);
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await expect(deleteCategory(24)).rejects.toThrow('cannot be deleted');

    expect(db.runAsync).not.toHaveBeenCalled();
    expect(getVersion()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    off();
  });
});

const RENT = {
  name: 'Rent', type: 'expense' as const, amount_minor: 8500000, account_id: 1, category_id: 5,
  freq: 'monthly' as const, anchor_day: 31, next_date: '2026-10-31', active: 1,
};

describe('logDueRecurring', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 3, 30, 12)); // 30 April 2026, local time
  });
  afterEach(() => jest.useRealTimers());

  const due = (next_date: string) => ({ id: 7, ...RENT, next_date });
  const dbWith = (rows: unknown[], count: number) =>
    fakeDb({
      getFirstAsync: jest.fn().mockResolvedValueOnce({ user_version: 4 }).mockResolvedValueOnce(null).mockResolvedValue({ count }),
      getAllAsync: jest.fn().mockResolvedValue(rows),
    });

  it('does nothing, and does not notify, when nothing is due', async () => {
    const db = dbWith([], 0);
    await openDb(db);
    const listener = jest.fn();
    const off = subscribe(listener);

    await logDueRecurring();

    expect(db.withTransactionAsync).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    off();
  });

  it('logs one transaction per missed date and moves next_date past today, in one SQL transaction', async () => {
    // Rent is due on the 31st: missed 31 Jan, 28 Feb (clamped), 31 Mar. Next is 30 April, which is today, so it is logged too.
    const db = dbWith([due('2026-01-31')], 1);
    await openDb(db);
    const listener = jest.fn();
    const off = subscribe(listener);

    await logDueRecurring();

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    const calls = (db.runAsync as jest.Mock).mock.calls;
    const inserted = calls.filter((c) => (c[0] as string).includes('INSERT INTO transactions'));
    expect(inserted.map((c) => c[6])).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(inserted[0].slice(1, 8)).toEqual(['expense', 8500000, 1, 5, 'Rent', '2026-01-31', 7]);
    expect(calls[calls.length - 1]).toEqual([expect.stringContaining('UPDATE recurring SET next_date'), '2026-05-31', 7]);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('a failure part-way changes nothing and calls no listeners', async () => {
    const db = dbWith([due('2026-03-31')], 1);
    (db.runAsync as jest.Mock).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('disk full'));
    await openDb(db);
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await expect(logDueRecurring()).rejects.toThrow('disk full');

    expect(getVersion()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    off();
  });
});

describe('recurring detail actions', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 3, 30, 12)); // 30 April 2026, local time
  });
  afterEach(() => jest.useRealTimers());

  const item = (next_date: string, active = 1) => ({ id: 7, ...RENT, next_date, active });
  const dbWith = (found: unknown) =>
    fakeDb({ getFirstAsync: jest.fn().mockResolvedValueOnce({ user_version: 4 }).mockResolvedValueOnce(null).mockResolvedValue(found) });
  const statements = (db: Db) => (db.runAsync as jest.Mock).mock.calls;

  it('logRecurringNow logs today for a future payment and moves to the one after, in one SQL transaction', async () => {
    const db = dbWith(item('2026-05-31'));
    await openDb(db);
    const listener = jest.fn();
    const off = subscribe(listener);

    await logRecurringNow(7);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    const [insert, update] = statements(db);
    expect(insert[0]).toContain('INSERT INTO transactions');
    expect(insert.slice(1, 8)).toEqual(['expense', 8500000, 1, 5, 'Rent', '2026-04-30', 7]);
    expect(update).toEqual([expect.stringContaining('UPDATE recurring SET next_date'), '2026-06-30', 7]);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('logRecurringNow logs a payment that is already due on its own date', async () => {
    const db = dbWith(item('2026-04-15'));
    await openDb(db);

    await logRecurringNow(7);

    const [insert, update] = statements(db);
    expect(insert[6]).toBe('2026-04-15');
    expect(update[1]).toBe('2026-05-31');
  });

  it('skipRecurring moves to the next date without logging anything', async () => {
    const db = dbWith(item('2026-05-31'));
    await openDb(db);

    await skipRecurring(7);

    expect(statements(db)).toEqual([[expect.stringContaining('UPDATE recurring SET next_date'), '2026-06-30', 7]]);
  });

  it('pausing keeps the next date, and resuming moves it to today or later', async () => {
    const paused = dbWith(item('2026-05-31'));
    await openDb(paused);
    await setRecurringActive(7, false);
    expect(statements(paused)).toEqual([[expect.stringContaining('UPDATE recurring SET active'), 0, '2026-05-31', 7]]);

    const resumed = dbWith(item('2026-01-31', 0));
    await openDb(resumed);
    await setRecurringActive(7, true);
    expect(statements(resumed)).toEqual([[expect.stringContaining('UPDATE recurring SET active'), 1, '2026-04-30', 7]]);
  });

  it('an item that no longer exists changes nothing and calls no listeners', async () => {
    await openDb(dbWith(null));
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await expect(skipRecurring(7)).rejects.toThrow('no longer exists');

    expect(getVersion()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    off();
  });

  it('getRecurringActivity returns the history and this year’s total', async () => {
    const getFirstAsync = jest
      .fn()
      .mockResolvedValueOnce({ user_version: 4 })
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ count: 4, total: 34000000 });
    const db = fakeDb({ getFirstAsync, getAllAsync: jest.fn().mockResolvedValue([{ id: 1 }]) });
    await openDb(db);

    const activity = await getRecurringActivity(7);

    expect(activity).toEqual({ history: [{ id: 1 }], yearCount: 4, yearTotal: 34000000 });
    expect((db.getFirstAsync as jest.Mock).mock.calls.pop().slice(1)).toEqual([7, '2026-01-01', '2026-12-31']);
  });
});

describe('recurring writes', () => {
  it.each([
    ['addRecurring', () => addRecurring(RENT), 'INSERT INTO recurring'],
    ['updateRecurring', () => updateRecurring(7, RENT), 'UPDATE recurring SET name'],
    ['deleteRecurring', () => deleteRecurring(7), 'DELETE FROM recurring'],
  ])('%s runs in one SQL transaction and bumps version once', async (_name, run, sql) => {
    const db = fakeDb();
    await openDb(db);
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await run();

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    const statements = (db.runAsync as jest.Mock).mock.calls.map((c) => c[0] as string);
    expect(statements.some((s) => s.includes(sql))).toBe(true);
    expect(getVersion()).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('a failed write changes nothing and calls no listeners', async () => {
    await openDb(fakeDb({ runAsync: jest.fn().mockRejectedValue(new Error('disk full')) }));
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await expect(addRecurring(RENT)).rejects.toThrow('disk full');

    expect(getVersion()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    off();
  });
});

const BACKUP = {
  app: 'hisaab' as const, version: 1, exported_at: 'x', currency: 'PKR',
  accounts: [{ id: 1, name: 'Cash', type: 'cash' as const, opening_minor: 0, color: '#FF9F0A', limit_minor: null, due_day: null, created_at: 'x' }],
  categories: [
    { id: 1, name: 'Groceries', kind: 'expense' as const, icon: 'tag', color: '#000', budget_minor: null, is_default: 0 },
    { id: 2, name: 'Other', kind: 'expense' as const, icon: 'tag', color: '#000', budget_minor: null, is_default: 1 },
  ],
  recurring: [],
  transactions: [
    { id: 1, type: 'expense' as const, amount_minor: 45000, account_id: 1, to_account_id: null, category_id: 1, note: 'Lunch', date: '2026-09-30', recurring_id: null, created_at: 'x' },
  ],
};

describe('replaceAllData', () => {
  it('clears everything and restores the backup in one SQL transaction, then notifies once', async () => {
    const db = fakeDb();
    await openDb(db);
    const listener = jest.fn();
    const off = subscribe(listener);

    await replaceAllData(BACKUP);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    const statements = (db.runAsync as jest.Mock).mock.calls.map((c) => c[0] as string);
    expect(statements.slice(0, 5).every((s) => s.startsWith('DELETE FROM'))).toBe(true);
    expect(statements.filter((s) => s.includes('INSERT INTO accounts'))).toHaveLength(1);
    expect(statements.filter((s) => s.includes('INSERT INTO categories'))).toHaveLength(2);
    expect(statements.filter((s) => s.includes('INSERT INTO transactions'))).toHaveLength(1);
    expect(db.runAsync).toHaveBeenCalledWith(expect.any(String), 'currency', 'PKR');
    expect(db.runAsync).toHaveBeenCalledWith(expect.any(String), 'onboarded', '1');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(formatMoney(100)).toBe('Rs 1');
    off();
  });

  it('a failure part-way changes nothing and does not touch the currency', async () => {
    const runAsync = jest.fn().mockResolvedValue({});
    await openDb(fakeDb({ runAsync }));
    await setCurrency('USD');
    runAsync.mockReset().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('disk full'));
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await expect(replaceAllData(BACKUP)).rejects.toThrow('disk full');

    expect(getVersion()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    expect(formatMoney(100)).toBe('$1.00');
    off();
  });
});

describe('deleteAllData', () => {
  it('clears every table and re-seeds the defaults in one SQL transaction, then notifies once', async () => {
    const db = fakeDb();
    await openDb(db);
    const listener = jest.fn();
    const off = subscribe(listener);

    await deleteAllData();

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    const statements = (db.runAsync as jest.Mock).mock.calls.map((c) => c[0] as string);
    expect(statements.slice(0, 5)).toEqual([
      'DELETE FROM transactions', 'DELETE FROM recurring', 'DELETE FROM categories', 'DELETE FROM accounts', 'DELETE FROM settings',
    ]);
    expect(statements.filter((s) => s.includes('INSERT INTO categories'))).toHaveLength(32);
    expect(statements.filter((s) => s.includes('INSERT INTO accounts'))).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('a failure changes nothing and calls no listeners', async () => {
    await openDb(fakeDb({ runAsync: jest.fn().mockRejectedValue(new Error('disk full')) }));
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await expect(deleteAllData()).rejects.toThrow('disk full');

    expect(getVersion()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    off();
  });
});

describe('exportAll', () => {
  it('returns every table with the currency and a version marker', async () => {
    const rows = [{ id: 1 }];
    const getFirstAsync = jest.fn().mockResolvedValueOnce({ user_version: 4 }).mockResolvedValueOnce(null).mockResolvedValue({ value: 'AED' });
    await openDb(fakeDb({ getFirstAsync, getAllAsync: jest.fn().mockResolvedValue(rows) }));

    const backup = await exportAll();

    expect(backup).toMatchObject({ app: 'hisaab', version: 1, currency: 'AED', accounts: rows, categories: rows, transactions: rows, recurring: rows });
  });
});

describe('buildFilter', () => {
  it('has no WHERE when nothing is filtered', () => {
    expect(buildFilter({ ...NO_FILTER, search: '  ' })).toEqual({ where: '', params: [] });
  });

  it('filters by type and by the first and last day of the month', () => {
    const { where, params } = buildFilter({ ...NO_FILTER, type: 'expense', month: '2028-02' });
    expect(where).toBe('WHERE t.type = ? AND t.date BETWEEN ? AND ?');
    expect(params).toEqual(['expense', '2028-02-01', '2028-02-29']);
  });

  it('filters by category, and by account including the receiving side of a transfer', () => {
    const { where, params } = buildFilter({ ...NO_FILTER, categoryId: 4, accountId: 2 });
    expect(where).toBe('WHERE t.category_id = ? AND (t.account_id = ? OR t.to_account_id = ?)');
    expect(params).toEqual([4, 2, 2]);
  });

  it('searches note, category and account names, escaping % and _', () => {
    const { where, params } = buildFilter({ ...NO_FILTER, search: ' 50%_off ' });
    expect(where).toContain('t.note LIKE ?');
    expect(where).toContain('c.name LIKE ?');
    expect(where).toContain('a.name LIKE ?');
    expect(where).toContain('b.name LIKE ?');
    expect(params).toEqual(Array(4).fill('%50\\%\\_off%'));
  });
});

describe('migration', () => {
  it('a new database gets the schema, the seed and the icon step', async () => {
    const db = fakeDb({ getFirstAsync: jest.fn().mockResolvedValue({ user_version: 0 }) });
    await openDb(db);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(4);
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 1');
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 2');
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 3');
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 4');
    // 32 categories + 1 Cash account, then 32 icon updates
    expect((db.runAsync as jest.Mock).mock.calls.length).toBe(65);
  });

  it('a version 1 database gets the icon update and the account type, and keeps its data', async () => {
    const db = fakeDb({ getFirstAsync: jest.fn().mockResolvedValue({ user_version: 1 }) });
    await openDb(db);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(3);
    expect(db.execAsync).not.toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE accounts ADD COLUMN type'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE accounts ADD COLUMN limit_minor'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE accounts ADD COLUMN due_day'));
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 3');
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 4');
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('UPDATE categories SET icon'), 'shopping-cart', 'Groceries', 'expense');
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 2');
  });

  it('does nothing when already migrated', async () => {
    const db = fakeDb({ getFirstAsync: jest.fn().mockResolvedValue({ user_version: 4 }) });
    await openDb(db);
    expect(db.withTransactionAsync).not.toHaveBeenCalled();
  });
});

describe('credit card limit', () => {
  // A card with a 10,000.00 limit and 9,000.00 owed.
  const card = { name: 'Visa', type: 'credit', limit_minor: 1000000, balance_minor: -900000 };
  const spend = (amount_minor: number, account_id = 1) => ({
    type: 'expense' as const, amount_minor, account_id, to_account_id: null, category_id: 1, note: '', date: '2026-10-01',
  });

  // Opens a database, then queues what the limit check will read: the old transaction (when editing) and the card.
  async function open(rows: unknown[]) {
    const getFirstAsync = jest.fn().mockResolvedValue({ user_version: 4 });
    const db = fakeDb({ getFirstAsync });
    await openDb(db);
    rows.forEach((row) => getFirstAsync.mockResolvedValueOnce(row));
    return db;
  }

  it('refuses an expense that goes past the limit, writes nothing and notifies nobody', async () => {
    const db = await open([card]);
    (db.runAsync as jest.Mock).mockClear();
    const listener = jest.fn();
    const off = subscribe(listener);
    const before = getVersion();

    await expect(addTransaction(spend(150000))).rejects.toThrow('1,000.00 left on Visa');

    expect(db.runAsync).not.toHaveBeenCalled();
    expect(getVersion()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    off();
  });

  it('allows an expense that stays within the limit', async () => {
    const db = await open([card]);
    await addTransaction(spend(100000));
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO transactions'), 'expense', 100000, 1, null, 1, '', '2026-10-01', expect.any(String));
  });

  it('says the card is at its limit when nothing is left', async () => {
    await open([{ ...card, balance_minor: -1000000 }]);
    await expect(addTransaction(spend(100))).rejects.toThrow('Visa is at its limit');
  });

  it('allows a payment into the card and a refund', async () => {
    const bank = { name: 'Bank', type: 'debit', limit_minor: null, balance_minor: 500000 };
    const db = await open([bank, { ...card, balance_minor: -1000000 }]);
    await addTransaction({ type: 'transfer', amount_minor: 50000, account_id: 2, to_account_id: 1, category_id: null, note: '', date: '2026-10-01' });
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO transactions'), 'transfer', 50000, 2, 1, null, '', '2026-10-01', expect.any(String));
  });

  it('refuses a transfer out of a full card', async () => {
    await open([{ ...card, balance_minor: -1000000 }]);
    await expect(
      addTransaction({ type: 'transfer', amount_minor: 100, account_id: 1, to_account_id: 2, category_id: null, note: '', date: '2026-10-01' }),
    ).rejects.toThrow('Visa is at its limit');
  });

  it('lets a card that is already over its limit edit a transaction without raising what is owed', async () => {
    const old = { type: 'expense', amount_minor: 200000, account_id: 1, to_account_id: null };
    const db = await open([old, { ...card, balance_minor: -1100000 }]);
    await updateTransaction(5, spend(200000));
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('UPDATE transactions'), 'expense', 200000, 1, null, 1, '', '2026-10-01', 5);
  });

  it('refuses an edit that raises what is owed past the limit', async () => {
    const old = { type: 'expense', amount_minor: 200000, account_id: 1, to_account_id: null };
    await open([old, { ...card, balance_minor: -900000 }]);
    await expect(updateTransaction(5, spend(400000))).rejects.toThrow('left on Visa');
  });
});
