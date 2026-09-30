import { addTransaction, buildFilter, completeWelcome, Db, deleteTransaction, getVersion, openDb, setCurrency, subscribe, updateTransaction } from '../db';
import { formatMoney } from '../money';

function fakeDb(overrides: Partial<Db> = {}): Db {
  return {
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({}),
    getFirstAsync: jest.fn().mockResolvedValue({ user_version: 2 }),
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

describe('buildFilter', () => {
  it('has no WHERE when nothing is filtered', () => {
    expect(buildFilter({ search: '  ', type: 'all', month: null })).toEqual({ where: '', params: [] });
  });

  it('filters by type and by the first and last day of the month', () => {
    const { where, params } = buildFilter({ search: '', type: 'expense', month: '2028-02' });
    expect(where).toBe('WHERE t.type = ? AND t.date BETWEEN ? AND ?');
    expect(params).toEqual(['expense', '2028-02-01', '2028-02-29']);
  });

  it('searches note, category and account names, escaping % and _', () => {
    const { where, params } = buildFilter({ search: ' 50%_off ', type: 'all', month: null });
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

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(2);
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 1');
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 2');
    // 32 categories + 1 Cash account, then 32 icon updates
    expect((db.runAsync as jest.Mock).mock.calls.length).toBe(65);
  });

  it('a version 1 database only gets the icon update, and keeps its data', async () => {
    const db = fakeDb({ getFirstAsync: jest.fn().mockResolvedValue({ user_version: 1 }) });
    await openDb(db);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.execAsync).not.toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE'));
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('UPDATE categories SET icon'), 'shopping-cart', 'Groceries', 'expense');
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 2');
  });

  it('does nothing when already migrated', async () => {
    const db = fakeDb({ getFirstAsync: jest.fn().mockResolvedValue({ user_version: 2 }) });
    await openDb(db);
    expect(db.withTransactionAsync).not.toHaveBeenCalled();
  });
});
