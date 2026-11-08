import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { nextDueDate } from './calc';
import type {
  Account, AppState, Bill, Category, Debt, Goal, Investment, PendingSms, Settings, Transaction,
} from './types';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'inc_salary', name: 'Зарплата', emoji: '💼', kind: 'income' },
  { id: 'inc_business', name: 'Бизнес / агентство', emoji: '🚀', kind: 'income' },
  { id: 'inc_platform', name: 'Платформа', emoji: '🌐', kind: 'income' },
  { id: 'inc_transfer', name: 'Переводы', emoji: '💸', kind: 'income' },
  { id: 'inc_other', name: 'Другое', emoji: '➕', kind: 'income' },

  { id: 'exp_housing', name: 'Жильё и коммуналка', emoji: '🏠', kind: 'expense', group: 'mandatory' },
  { id: 'exp_loans', name: 'Кредиты', emoji: '🏦', kind: 'expense', group: 'mandatory' },
  { id: 'exp_taxes', name: 'Налоги', emoji: '🧾', kind: 'expense', group: 'mandatory' },
  { id: 'exp_education', name: 'Учёба', emoji: '🎓', kind: 'expense', group: 'mandatory' },
  { id: 'exp_mobile', name: 'Связь и интернет', emoji: '📱', kind: 'expense', group: 'mandatory' },
  { id: 'exp_food', name: 'Продукты', emoji: '🛒', kind: 'expense', group: 'essential' },
  { id: 'exp_transport', name: 'Транспорт / такси', emoji: '🚕', kind: 'expense', group: 'essential' },
  { id: 'exp_fuel', name: 'Топливо / метан', emoji: '⛽', kind: 'expense', group: 'essential' },
  { id: 'exp_health', name: 'Здоровье', emoji: '💊', kind: 'expense', group: 'essential' },
  { id: 'exp_cafe', name: 'Кафе и рестораны', emoji: '🍔', kind: 'expense', group: 'discretionary' },
  { id: 'exp_shopping', name: 'Покупки', emoji: '🛍️', kind: 'expense', group: 'discretionary' },
  { id: 'exp_fun', name: 'Развлечения', emoji: '🎮', kind: 'expense', group: 'discretionary' },
  { id: 'exp_subs', name: 'Подписки', emoji: '🔁', kind: 'expense', group: 'discretionary' },
  { id: 'exp_transfer', name: 'Переводы', emoji: '↗️', kind: 'expense', group: 'discretionary' },
  { id: 'exp_other', name: 'Прочее', emoji: '📦', kind: 'expense', group: 'discretionary' },
  { id: 'exp_saving', name: 'В цели / накопления', emoji: '🎯', kind: 'expense', group: 'saving' },
  { id: 'exp_invest', name: 'Инвестиции', emoji: '📈', kind: 'expense', group: 'saving' },
];

export const DEFAULT_SENDERS = [
  'HUMO', 'UZCARD', 'CLICK', 'PAYME', 'UZUM', 'KAPITAL', 'NBU', 'HAMKOR', 'AGROBANK', 'IPOTEKA',
  'INFINBANK', 'TBC', 'ANORBANK', 'ASAKA', 'XALQ', 'AAB', 'DAVR', 'OCTOBANK', 'ORIENT', 'TENGE',
  'KDB', 'TRASTBANK', 'ZIRAAT', 'SQB', 'MKBANK', 'APELSIN', 'PAYNET', '900', '1000',
];

const defaultSettings: Settings = {
  name: 'Kamron',
  usdRate: 12000,
  inflation: 8,
  notificationsEnabled: true,
  notifyHour: 9,
  smsEnabled: false,
  smsSenders: DEFAULT_SENDERS,
  smsAutoAdd: false,
  lastSmsSync: 0,
};

const initialState: AppState = {
  settings: defaultSettings,
  categories: DEFAULT_CATEGORIES,
  accounts: [],
  transactions: [],
  bills: [],
  debts: [],
  goals: [],
  investments: [],
  pendingSms: [],
  merchantMap: {},
  checkins: [],
  seenSmsIds: [],
};

type Upsert<T> = (item: T) => void;

interface Actions {
  updateSettings: (p: Partial<Settings>) => void;
  upsertAccount: Upsert<Account>;
  removeAccount: (id: string) => void;
  addTransaction: (t: Omit<Transaction, 'id'> & { id?: string }) => void;
  updateTransaction: Upsert<Transaction>;
  removeTransaction: (id: string) => void;
  upsertBill: Upsert<Bill>;
  removeBill: (id: string) => void;
  markBillPaid: (id: string, accountId?: string) => void;
  upsertDebt: Upsert<Debt>;
  removeDebt: (id: string) => void;
  upsertGoal: Upsert<Goal>;
  removeGoal: (id: string) => void;
  contributeToGoal: (id: string, amount: number, accountId?: string) => void;
  upsertInvestment: Upsert<Investment>;
  removeInvestment: (id: string) => void;
  addPendingSms: (items: PendingSms[], seenIds: string[], lastSync: number) => void;
  resolvePendingSms: (smsId: string, accept: boolean, categoryId?: string) => void;
  checkin: () => void;
  replaceAll: (s: AppState) => void;
  resetAll: () => void;
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

function applyToAccount(accounts: Account[], accountId: string | undefined, delta: number): Account[] {
  if (!accountId) return accounts;
  return accounts.map((a) => (a.id === accountId ? { ...a, balance: a.balance + delta } : a));
}

export const useStore = create<AppState & Actions>()(
  persist(
    (set, get) => ({
      ...initialState,

      updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

      upsertAccount: (a) => set((s) => ({ accounts: upsert(s.accounts, a) })),
      removeAccount: (id) => set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) })),

      addTransaction: (t) =>
        set((s) => {
          const tx: Transaction = { ...t, id: t.id ?? uid() };
          const delta = tx.kind === 'income' ? tx.amount : -tx.amount;
          return {
            transactions: [tx, ...s.transactions],
            accounts: applyToAccount(s.accounts, tx.accountId, delta),
          };
        }),
      updateTransaction: (t) =>
        set((s) => {
          const old = s.transactions.find((x) => x.id === t.id);
          let accounts = s.accounts;
          if (old) accounts = applyToAccount(accounts, old.accountId, old.kind === 'income' ? -old.amount : old.amount);
          accounts = applyToAccount(accounts, t.accountId, t.kind === 'income' ? t.amount : -t.amount);
          return { transactions: upsert(s.transactions, t), accounts };
        }),
      removeTransaction: (id) =>
        set((s) => {
          const old = s.transactions.find((x) => x.id === id);
          const accounts = old
            ? applyToAccount(s.accounts, old.accountId, old.kind === 'income' ? -old.amount : old.amount)
            : s.accounts;
          return { transactions: s.transactions.filter((x) => x.id !== id), accounts };
        }),

      upsertBill: (b) => set((s) => ({ bills: upsert(s.bills, b) })),
      removeBill: (id) => set((s) => ({ bills: s.bills.filter((b) => b.id !== id) })),
      markBillPaid: (id, accountId) => {
        const bill = get().bills.find((b) => b.id === id);
        if (!bill) return;
        const now = new Date().toISOString();
        get().addTransaction({
          date: now, amount: bill.amount, kind: 'expense', categoryId: guessBillCategory(bill.name),
          accountId, note: bill.name, source: 'manual',
        });
        const cycle = nextDueDate(bill).toISOString();
        set((s) => ({ bills: s.bills.map((b) => (b.id === id ? { ...b, lastPaid: cycle } : b)) }));
      },

      upsertDebt: (d) => set((s) => ({ debts: upsert(s.debts, d) })),
      removeDebt: (id) => set((s) => ({ debts: s.debts.filter((d) => d.id !== id) })),

      upsertGoal: (g) => set((s) => ({ goals: upsert(s.goals, g) })),
      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
      contributeToGoal: (id, amount, accountId) => {
        const goal = get().goals.find((g) => g.id === id);
        if (!goal) return;
        get().addTransaction({
          date: new Date().toISOString(), amount, kind: 'expense', categoryId: 'exp_saving',
          accountId, note: `${goal.emoji} ${goal.name}`, source: 'manual',
        });
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, saved: g.saved + amount } : g)) }));
      },

      upsertInvestment: (i) => set((s) => ({ investments: upsert(s.investments, i) })),
      removeInvestment: (id) => set((s) => ({ investments: s.investments.filter((i) => i.id !== id) })),

      addPendingSms: (items, seenIds, lastSync) =>
        set((s) => ({
          pendingSms: [...items, ...s.pendingSms].sort((a, b) => b.date.localeCompare(a.date)),
          seenSmsIds: [...seenIds, ...s.seenSmsIds].slice(0, 5000),
          settings: { ...s.settings, lastSmsSync: lastSync },
        })),
      resolvePendingSms: (smsId, accept, categoryId) => {
        const p = get().pendingSms.find((x) => x.smsId === smsId);
        if (!p) return;
        if (accept) {
          const catId = categoryId ?? p.suggestedCategoryId;
          const acc = p.cardLast4 ? get().accounts.find((a) => a.cardLast4 === p.cardLast4) : undefined;
          get().addTransaction({
            date: p.date, amount: p.amount, kind: p.kind, categoryId: catId, accountId: acc?.id,
            note: p.merchant ?? p.sender, source: 'sms', smsId: p.smsId,
          });
          // Bank SMS often carries the balance after the operation: trust it over our running total.
          if (acc && p.balanceAfter !== undefined) {
            set((s) => ({ accounts: s.accounts.map((a) => (a.id === acc.id ? { ...a, balance: p.balanceAfter! } : a)) }));
          }
          if (p.merchant) {
            const key = p.merchant.toLowerCase();
            set((s) => ({ merchantMap: { ...s.merchantMap, [key]: catId } }));
          }
        }
        set((s) => ({ pendingSms: s.pendingSms.filter((x) => x.smsId !== smsId) }));
      },

      checkin: () =>
        set((s) => {
          const k = todayKey();
          return s.checkins.includes(k) ? s : { checkins: [k, ...s.checkins].slice(0, 400) };
        }),

      replaceAll: (state) => set(() => ({ ...initialState, ...state, settings: { ...defaultSettings, ...state.settings } })),
      resetAll: () => set(() => initialState),
    }),
    {
      name: 'moliya-state-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        // Keep new default categories that older saved data doesn't know about.
        const cats = p.categories ?? current.categories;
        const missing = DEFAULT_CATEGORIES.filter((c) => !cats.some((x) => x.id === c.id));
        return {
          ...current, ...p,
          categories: [...cats, ...missing],
          settings: { ...current.settings, ...(p.settings ?? {}) },
        };
      },
    },
  ),
);

export function snapshot(): AppState {
  const s = useStore.getState();
  return {
    settings: s.settings, categories: s.categories, accounts: s.accounts, transactions: s.transactions,
    bills: s.bills, debts: s.debts, goals: s.goals, investments: s.investments, pendingSms: s.pendingSms,
    merchantMap: s.merchantMap, checkins: s.checkins, seenSmsIds: s.seenSmsIds,
  };
}

function guessBillCategory(name: string): string {
  const n = name.toLowerCase();
  if (/кредит|рассроч|займ|loan|ипотек/.test(n)) return 'exp_loans';
  if (/налог|soliq|tax/.test(n)) return 'exp_taxes';
  if (/учеб|контракт|универ|kontrakt/.test(n)) return 'exp_education';
  if (/связ|интернет|мобил|uzmobile|beeline|ucell|mobiuz|humans/.test(n)) return 'exp_mobile';
  if (/подписк|spotify|netflix|youtube|icloud|chatgpt|claude/.test(n)) return 'exp_subs';
  return 'exp_housing';
}
