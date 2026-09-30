export type Account = {
  id: number;
  name: string;
  opening_minor: number;
  color: string;
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
};
