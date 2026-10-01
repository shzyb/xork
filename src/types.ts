export type ThemeSetting = 'system' | 'light' | 'dark';

export const THEME_OPTIONS: { value: ThemeSetting; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export type AccountType = 'cash' | 'debit' | 'savings' | 'credit';

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'debit', label: 'Debit' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit card' },
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
};

export type MonthTotals = { month: string; in_minor: number; out_minor: number };

export type DaySpend = { day: number; total_minor: number };

// One credit card on Insights. Owed, limit and due day are right now; spent and paid are for the chosen month.
export type CardInsight = {
  id: number;
  name: string;
  color: string;
  limit_minor: number | null;
  due_day: number | null;
  owed_minor: number;
  spent_minor: number;
  paid_minor: number;
};

// Everything the Insights screen shows for one month. "prev" is the month before it.
export type InsightsData = {
  summary: { in_minor: number; out_minor: number };
  prevSummary: { in_minor: number; out_minor: number };
  spending: CategorySpend[];
  prevSpending: CategorySpend[]; // same point in the month when `month` is the current one
  income: CategorySpend[];
  daily: DaySpend[];
  prevDaily: DaySpend[];
  recurringOut: number;
  biggest: { amount_minor: number; label: string } | null; // the largest expense of the month
  spendDays: number; // days with a non-recurring expense
  monthly: MonthTotals[];
  cards: CardInsight[];
  earliestMonth: string | null; // the month of the oldest transaction, for disabling earlier month chips
};
