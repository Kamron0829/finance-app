// Data model mirrors finance_state.md (Moliya): accounts, income, mandatory
// payments, debts, goals, investments, monthly log.

export type ExpenseGroup = 'mandatory' | 'essential' | 'discretionary' | 'saving';
export type TxKind = 'income' | 'expense';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  kind: TxKind;
  group?: ExpenseGroup; // only for expenses
}

export interface Account {
  id: string;
  name: string;
  type: 'card' | 'cash' | 'deposit' | 'usd';
  balance: number; // UZS
  cardLast4?: string; // used to match bank SMS and update balance
  note?: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO
  amount: number; // always positive, UZS
  kind: TxKind;
  categoryId: string;
  accountId?: string;
  note?: string;
  source: 'manual' | 'sms';
  smsId?: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  dueDay: number; // day of month
  dueMonth?: number; // 1-12 for non-monthly bills
  autopay: boolean;
  lastPaid?: string; // ISO
}

export interface Debt {
  id: string;
  name: string;
  lender: string;
  balance: number;
  rate: number; // % per year
  monthlyPayment: number;
  dueDay: number;
}

export interface Goal {
  id: string;
  name: string;
  emoji: string;
  target: number;
  saved: number;
  deadline: string; // YYYY-MM
  priority: number; // 1-5
  heldIn?: string;
  color: string;
  createdAt: string;
}

export interface Investment {
  id: string;
  name: string;
  type: 'share' | 'bond' | 'deposit' | 'usd' | 'gold' | 'business' | 'other';
  invested: number;
  currentValue: number;
  date: string;
  thesis?: string;
}

export interface PendingSms {
  smsId: string;
  sender: string;
  body: string;
  date: string;
  amount: number;
  kind: TxKind;
  merchant?: string;
  cardLast4?: string;
  balanceAfter?: number;
  suggestedCategoryId: string;
}

export interface Settings {
  name: string;
  usdRate: number;
  inflation: number; // % per year, for goal adjustment
  notificationsEnabled: boolean;
  notifyHour: number;
  smsEnabled: boolean;
  smsSenders: string[]; // substrings matched against sender, case-insensitive
  smsAutoAdd: boolean; // add confidently-parsed SMS without review
  lastSmsSync: number; // ms epoch
}

export interface AppState {
  settings: Settings;
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  bills: Bill[];
  debts: Debt[];
  goals: Goal[];
  investments: Investment[];
  pendingSms: PendingSms[];
  merchantMap: Record<string, string>; // merchant (lowercase) -> categoryId
  checkins: string[]; // YYYY-MM-DD dates the app was opened
  seenSmsIds: string[];
}
