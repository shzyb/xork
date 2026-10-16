export type ThemeSetting = 'system' | 'light' | 'dark';

export const THEME_OPTIONS: { value: ThemeSetting; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export type AccountType = 'cash' | 'debit' | 'savings' | 'credit';

export const ACCOUNT_TYPES: { value: AccountType; label: string; emoji: string }[] = [
  { value: 'cash', emoji: '💵', label: 'Cash' },
  { value: 'debit', emoji: '🏦', label: 'Debit' },
  { value: 'savings', emoji: '💰', label: 'Savings' },
  { value: 'credit', emoji: '💳', label: 'Credit card' },
];

export type Account = {
  id: number;
  name: string;
  type: AccountType;
  opening_minor: number; // for a credit card this is minus the amount owed at the start
  color: string;
  limit_minor: number | null; // credit cards only
  due_day: number | null; // credit cards only: day of the month the payment is due, 1 to 31
  created_at: string;
};

export type CategoryKind = 'expense' | 'income';

export type Category = {
  id: number;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  budget_minor: number | null;
  is_default: number;
  sort_order: number;
};

export type TransactionType = 'expense' | 'income' | 'transfer';

export type Transaction = {
  id: number;
  type: TransactionType;
  amount_minor: number;
  account_id: number;
  to_account_id: number | null;
  category_id: number | null;
  note: string;
  date: string;
  recurring_id: number | null;
  created_at: string;
};

export type Frequency = 'weekly' | 'monthly' | 'yearly';

export type Recurring = {
  id: number;
  name: string;
  type: 'expense' | 'income';
  amount_minor: number;
  account_id: number;
  category_id: number;
  freq: Frequency;
  anchor_day: number;
  next_date: string;
  active: number;
};

export type TransactionRow = Transaction & {
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  account_name: string;
  to_account_name: string | null;
  recurring_name: string | null;
  recurring_freq: Frequency | null;
};

export type RecurringRow = Recurring & {
  account_name: string;
  category_name: string;
  category_icon: string;
  category_color: string;
};

export type TransactionFilter = {
  search: string;
  type: TransactionType | 'all';
  month: string | null;
  categoryId: number | null;
  accountId: number | null; // matches the account a transaction is from or, for a transfer, moved to
};

export type CategorySpend = {
  id: number;
  name: string;
  icon: string;
  color: string;
  budget_minor: number | null;
  total_minor: number;
  count: number;
};

export type MonthTotals = { month: string; in_minor: number; out_minor: number };

// What the top of Home shows.
export type HomeMetric = 'balance' | 'expense';

export type DaySpend = { day: number; total_minor: number };

// Home's net worth chart: the balance before this month, each day's income minus expenses, and the balance on this date last month.
export type NetWorthTrend = { startMinor: number; daily: DaySpend[]; prevPointMinor: number };

// Everything the Insights screen shows for one month. "Earlier" months are the ones before it, back to the first transaction.
export type InsightsData = {
  summary: { in_minor: number; out_minor: number };
  spending: CategorySpend[];
  income: CategorySpend[];
  recurringOut: number; // recurring expenses logged in the month
  monthly: MonthTotals[]; // the six months ending now, for the chart
  earlier: MonthTotals[]; // up to six earlier months, oldest first
  earlierByCategory: { id: number; month: string; total_minor: number }[]; // expenses per category in up to three earlier months
  earlierCategoryMonths: string[];
  recurring: RecurringRow[];
  recurringLogs: { recurring_id: number; amount_minor: number; date: string }[]; // the last year's recurring expenses, oldest first
  biggest: { amount_minor: number; label: string } | null; // the largest one-off expense of the month
  payday: string | null; // the date of the month's biggest income
  dayToDay: DaySpend[]; // expenses that aren't recurring, by day
  dailyNet: DaySpend[]; // income minus expenses, by day
  accounts: (Account & { balance_minor: number })[];
  earliestMonth: string | null; // the month of the oldest transaction, for disabling earlier month chips
};
