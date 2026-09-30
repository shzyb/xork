import { addAccount, addCategory, addTransaction, buildFilter, completeWelcome, Db, deleteAccount, deleteCategory, deleteTransaction, getVersion, openDb, setCurrency, subscribe, updateAccount, updateCategory, updateTransaction } from '../db';
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

const FOOD = { name: 'Food', kind: 'expense' as const, icon: 'utensils', color: '#FF8A00', budget_minor: null };

describe.each([
  ['addAccount', () => addAccount({ name: 'Bank', opening_minor: 5000, color: '#3B82F6' }), 'INSERT INTO accounts'],
  ['updateAccount', () => updateAccount(3, { name: 'Bank', opening_minor: 5000, color: '#3B82F6' }), 'UPDATE accounts'],
  ['addCategory', () => addCategory(FOOD), 'INSERT INTO categories'],
  ['updateCategory', () => updateCategory(3, FOOD), 'UPDATE categories'],
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
      .mockResolvedValueOnce({ user_version: 2 })
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
      .mockResolvedValueOnce({ user_version: 2 })
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
