import { completeWelcome, Db, getVersion, openDb, setCurrency, subscribe } from '../db';
import { formatMoney } from '../money';

function fakeDb(overrides: Partial<Db> = {}): Db {
  return {
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({}),
    getFirstAsync: jest.fn().mockResolvedValue({ user_version: 1 }),
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

describe('migration', () => {
  it('creates schema and seeds once, then sets user_version', async () => {
    const db = fakeDb({ getFirstAsync: jest.fn().mockResolvedValue({ user_version: 0 }) });
    await openDb(db);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 1');
    // 24 expense + 8 income categories + 1 Cash account
    expect((db.runAsync as jest.Mock).mock.calls.length).toBe(33);
  });

  it('does nothing when already migrated', async () => {
    const db = fakeDb();
    await openDb(db);
    expect(db.withTransactionAsync).not.toHaveBeenCalled();
  });
});
