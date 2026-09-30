// Schema and default data for a new database. Used only by the migrations in db.ts.

export const SCHEMA = `
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  opening_minor INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  budget_minor INTEGER,
  is_default INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  to_account_id INTEGER,
  category_id INTEGER,
  note TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  recurring_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX transactions_date ON transactions (date);
CREATE TABLE recurring (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  freq TEXT NOT NULL,
  anchor_day INTEGER NOT NULL,
  next_date TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// name, Lucide icon name, colour. The two "Other" categories are is_default: they can't be deleted.
export const EXPENSE_CATEGORIES = [
  ['Groceries', 'shopping-cart', '#34A853'],
  ['Dining out', 'utensils', '#FF8A00'],
  ['Transport', 'bus', '#3B82F6'],
  ['Bills', 'receipt', '#EAB308'],
  ['Rent', 'house', '#A0714F'],
  ['Mobile', 'smartphone', '#14B8A6'],
  ['Internet', 'wifi', '#0EA5E9'],
  ['Subscriptions', 'repeat', '#8B5CF6'],
  ['Shopping', 'shopping-bag', '#EC4899'],
  ['Health', 'heart-pulse', '#EF4444'],
  ['Family', 'users', '#64748B'],
  ['Education', 'book-open', '#16A34A'],
  ['Entertainment', 'clapperboard', '#0284C7'],
  ['Fuel', 'fuel', '#F97316'],
  ['Travel', 'plane', '#2563EB'],
  ['Personal', 'sparkles', '#D946EF'],
  ['Fitness', 'dumbbell', '#EA580C'],
  ['Charity', 'hand-heart', '#059669'],
  ['Home', 'sofa', '#B45309'],
  ['Maintenance', 'wrench', '#78716C'],
  ['Insurance', 'shield-check', '#4F46E5'],
  ['Loans', 'landmark', '#7C3AED'],
  ['EMI', 'credit-card', '#DB2777'],
  ['Other', 'tag', '#64748B'],
];

export const INCOME_CATEGORIES = [
  ['Salary', 'briefcase', '#16A34A'],
  ['Freelance', 'laptop', '#14B8A6'],
  ['Business', 'store', '#F59E0B'],
  ['Investments', 'trending-up', '#8B5CF6'],
  ['Rental income', 'key-round', '#A0714F'],
  ['Refunds', 'undo-2', '#0EA5E9'],
  ['Gifts', 'gift', '#EC4899'],
  ['Other income', 'sparkle', '#64748B'],
];
