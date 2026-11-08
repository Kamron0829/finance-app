import type { AppState, Bill, ExpenseGroup, Goal, Transaction } from './types';
import { todayKey } from './store';

// ---------- formatting ----------
export function fmt(n: number, withCurrency = true): string {
  const sign = n < 0 ? '-' : '';
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${s}${withCurrency ? ' сум' : ''}`;
}
export function fmtShort(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(a >= 1e10 ? 0 : 1)} млрд`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)} млн`;
  if (a >= 1e3) return `${sign}${Math.round(a / 1e3)} тыс`;
  return `${sign}${Math.round(a)}`;
}
export const pct = (x: number) => `${Math.round(x * 100)}%`;

export const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const MONTHS_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export const monthKey = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
};

/** Parse a user-typed amount like "12 500 000" or "1.5м" / "300к". */
export function parseAmount(s: string): number {
  const t = s.trim().toLowerCase().replace(/\s/g, '').replace(',', '.');
  const m = t.match(/^([\d.]+)(к|k|м|m|млн)?$/);
  if (!m) return NaN;
  let v = parseFloat(m[1]);
  if (m[2] === 'к' || m[2] === 'k') v *= 1e3;
  if (m[2] === 'м' || m[2] === 'm' || m[2] === 'млн') v *= 1e6;
  return Math.round(v);
}

// ---------- monthly summary ----------
export interface MonthSummary {
  key: string;
  income: number;
  byGroup: Record<ExpenseGroup, number>;
  expenses: number; // all spending excluding saving
  saved: number;
  freeCashFlow: number; // income - mandatory - essential - discretionary
  savingsRate: number; // saved / income
  byCategory: Record<string, number>;
}

export function summarizeMonth(state: AppState, key: string): MonthSummary {
  const catGroup = new Map(state.categories.map((c) => [c.id, c.group]));
  const byGroup: Record<ExpenseGroup, number> = { mandatory: 0, essential: 0, discretionary: 0, saving: 0 };
  const byCategory: Record<string, number> = {};
  let income = 0;
  for (const t of state.transactions) {
    if (monthKey(t.date) !== key) continue;
    if (t.kind === 'income') { income += t.amount; continue; }
    const g = catGroup.get(t.categoryId) ?? 'discretionary';
    byGroup[g] += t.amount;
    byCategory[t.categoryId] = (byCategory[t.categoryId] ?? 0) + t.amount;
  }
  const expenses = byGroup.mandatory + byGroup.essential + byGroup.discretionary;
  return {
    key, income, byGroup, expenses, saved: byGroup.saving,
    freeCashFlow: income - expenses,
    savingsRate: income > 0 ? byGroup.saving / income : 0,
    byCategory,
  };
}

export function lastMonthKeys(n: number, from = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(from.getFullYear(), from.getMonth() - i, 1)));
  return out;
}

/** Average free cash flow over the last full months that have any data (falls back to current). */
export function avgFreeCashFlow(state: AppState, months = 3): number {
  const keys = lastMonthKeys(months + 1).slice(0, months);
  const sums = keys.map((k) => summarizeMonth(state, k)).filter((m) => m.income > 0 || m.expenses > 0);
  if (sums.length === 0) {
    const cur = summarizeMonth(state, monthKey(new Date()));
    return cur.income > 0 ? cur.freeCashFlow : 0;
  }
  return sums.reduce((a, m) => a + m.freeCashFlow, 0) / sums.length;
}

export function avgIncome(state: AppState, months = 6) {
  const keys = lastMonthKeys(months);
  const vals = keys.map((k) => summarizeMonth(state, k).income).filter((v) => v > 0);
  if (!vals.length) return { min: 0, avg: 0, max: 0 };
  return { min: Math.min(...vals), avg: vals.reduce((a, b) => a + b, 0) / vals.length, max: Math.max(...vals) };
}

// ---------- totals ----------
export function totals(state: AppState) {
  const cash = state.accounts.reduce((a, x) => a + x.balance, 0);
  const goalsSaved = state.goals.reduce((a, g) => a + g.saved, 0);
  const invest = state.investments.reduce((a, i) => a + i.currentValue, 0);
  const debt = state.debts.reduce((a, d) => a + d.balance, 0);
  return { cash, goalsSaved, invest, debt, netWorth: cash + goalsSaved + invest - debt };
}

export function monthlyMandatory(state: AppState): number {
  const perMonth = { monthly: 1, quarterly: 1 / 3, semiannual: 1 / 6, annual: 1 / 12 } as const;
  const bills = state.bills.reduce((a, b) => a + b.amount * perMonth[b.frequency], 0);
  const debts = state.debts.reduce((a, d) => a + d.monthlyPayment, 0);
  return bills + debts;
}

export function dsti(state: AppState): number {
  const inc = avgIncome(state).min || avgIncome(state).avg;
  const pay = state.debts.reduce((a, d) => a + d.monthlyPayment, 0);
  return inc > 0 ? pay / inc : pay > 0 ? 1 : 0;
}

// ---------- goals ----------
export function monthsUntil(ym: string, from = new Date()): number {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return 0;
  return Math.max(0, (y - from.getFullYear()) * 12 + (m - 1 - from.getMonth()));
}

export interface GoalPlan {
  progress: number;
  remaining: number;
  monthsLeft: number;
  inflatedTarget: number;
  requiredMonthly: number;
  feasible: boolean | null; // null = not enough data
  etaMonths: number | null; // at current avg contribution
}

export function goalPlan(state: AppState, g: Goal): GoalPlan {
  const monthsLeft = monthsUntil(g.deadline);
  const inflatedTarget = g.target * Math.pow(1 + state.settings.inflation / 100, monthsLeft / 12);
  const remaining = Math.max(0, inflatedTarget - g.saved);
  const requiredMonthly = monthsLeft > 0 ? remaining / monthsLeft : remaining;
  const fcf = avgFreeCashFlow(state);
  const feasible = fcf === 0 && state.transactions.length === 0 ? null : requiredMonthly <= Math.max(0, fcf);
  // Average monthly contribution into this goal since it was created.
  const contribs = state.transactions.filter((t) => t.categoryId === 'exp_saving' && t.note?.includes(g.name));
  const since = Math.max(1, monthsBetween(new Date(g.createdAt), new Date()));
  const avgContrib = contribs.reduce((a, t) => a + t.amount, 0) / since;
  return {
    progress: g.target > 0 ? Math.min(1, g.saved / g.target) : 0,
    remaining, monthsLeft, inflatedTarget, requiredMonthly, feasible,
    etaMonths: avgContrib > 0 ? Math.ceil(remaining / avgContrib) : null,
  };
}

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
}

// ---------- bills ----------
export function nextDueDate(b: Bill, from = new Date()): Date {
  const step = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[b.frequency];
  const anchor = b.frequency === 'monthly' ? 0 : ((b.dueMonth ?? 1) - 1) % step;
  const occ: Date[] = [];
  for (let y = from.getFullYear() - 1; y <= from.getFullYear() + 2; y++) {
    for (let m = anchor; m < 12; m += step) {
      const last = new Date(y, m + 1, 0).getDate();
      occ.push(new Date(y, m, Math.min(b.dueDay, last), 12));
    }
  }
  // lastPaid holds the due date of the last cycle that was paid.
  const paidDue = b.lastPaid ? startOfDay(new Date(b.lastPaid)) : null;
  const today = startOfDay(from);
  const next = occ.find((d) => (paidDue ? startOfDay(d) > paidDue : d >= today));
  return next ?? occ[occ.length - 1];
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function daysUntil(d: Date, from = new Date()) {
  return Math.round((startOfDay(d).getTime() - startOfDay(from).getTime()) / 86400000);
}

export function upcomingBills(state: AppState, days = 14) {
  return state.bills
    .map((b) => ({ bill: b, due: nextDueDate(b), days: daysUntil(nextDueDate(b)) }))
    .filter((x) => x.days <= days)
    .sort((a, b) => a.days - b.days);
}

// ---------- gamification ----------
export function streak(checkins: string[]): number {
  const set = new Set(checkins);
  let n = 0;
  const d = new Date();
  if (!set.has(todayKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export interface HealthPart { label: string; score: number; hint: string }

/** 0-100 financial health score from five pillars, 20 points each. */
export function healthScore(state: AppState): { total: number; parts: HealthPart[] } {
  const cur = summarizeMonth(state, monthKey(new Date()));
  const prev = summarizeMonth(state, lastMonthKeys(2)[0]);
  const m = cur.income > 0 ? cur : prev;
  const mandatory = monthlyMandatory(state) || m.byGroup.mandatory + m.byGroup.essential;
  const emergency = state.goals.find((g) => /подушк|резерв|emergency/i.test(g.name));
  const cushion = (emergency?.saved ?? 0) + state.accounts.filter((a) => a.type === 'deposit').reduce((a, x) => a + x.balance, 0);
  const cushionMonths = mandatory > 0 ? cushion / mandatory : 0;
  const d = dsti(state);
  const overdue = upcomingBills(state, 0).filter((x) => x.days < 0).length;
  const goalsProg = state.goals.length
    ? state.goals.reduce((a, g) => a + goalPlan(state, g).progress, 0) / state.goals.length : 0;

  const parts: HealthPart[] = [
    { label: 'Сбережения', score: clamp(m.savingsRate / 0.2) * 20, hint: `Откладываешь ${pct(m.savingsRate)} дохода (цель 20%+)` },
    { label: 'Подушка', score: clamp(cushionMonths / 6) * 20, hint: `${cushionMonths.toFixed(1)} мес. обязательных расходов (цель 6)` },
    { label: 'Долги', score: state.debts.length === 0 ? 20 : clamp((0.5 - d) / 0.5) * 20, hint: state.debts.length ? `DSTI ${pct(d)} (норма до 35%)` : 'Долгов нет' },
    { label: 'Платежи', score: overdue === 0 ? 20 : Math.max(0, 20 - overdue * 7), hint: overdue ? `Просрочено: ${overdue}` : 'Все платежи вовремя' },
    { label: 'Цели', score: clamp(goalsProg) * 20, hint: state.goals.length ? `Средний прогресс ${pct(goalsProg)}` : 'Добавь первую цель' },
  ];
  return { total: Math.round(parts.reduce((a, p) => a + p.score, 0)), parts };
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));

/** Wealth levels by net worth (UZS). */
export const LEVELS = [
  { min: -Infinity, name: 'Старт', emoji: '🌱' },
  { min: 10e6, name: 'Первые 10 млн', emoji: '🪴' },
  { min: 50e6, name: 'Фундамент', emoji: '🧱' },
  { min: 100e6, name: 'Сотня', emoji: '💯' },
  { min: 250e6, name: 'Инвестор', emoji: '📈' },
  { min: 500e6, name: 'Полмиллиарда', emoji: '🏗️' },
  { min: 1e9, name: 'Миллиардер (сум)', emoji: '💎' },
  { min: 2.5e9, name: 'Капиталист', emoji: '🏛️' },
  { min: 5e9, name: 'Магнат', emoji: '👑' },
  { min: 12e9, name: 'Долларовый миллионер', emoji: '🚀' },
];

export function level(netWorth: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && netWorth >= LEVELS[i + 1].min) i++;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1];
  const from = Number.isFinite(cur.min) ? cur.min : 0;
  const progress = next ? clamp((netWorth - from) / (next.min - from)) : 1;
  return { index: i + 1, ...cur, next, progress };
}

export interface Achievement { id: string; emoji: string; title: string; done: boolean }

export function achievements(state: AppState): Achievement[] {
  const t = totals(state);
  const s = streak(state.checkins);
  const m = summarizeMonth(state, monthKey(new Date()));
  return [
    { id: 'first_tx', emoji: '✍️', title: 'Первая запись', done: state.transactions.length > 0 },
    { id: 'first_goal', emoji: '🎯', title: 'Поставил цель', done: state.goals.length > 0 },
    { id: 'streak7', emoji: '🔥', title: '7 дней подряд', done: s >= 7 },
    { id: 'streak30', emoji: '⚡', title: '30 дней подряд', done: s >= 30 },
    { id: 'save20', emoji: '🐷', title: 'Отложил 20% за месяц', done: m.savingsRate >= 0.2 },
    { id: 'debtfree', emoji: '🕊️', title: 'Без долгов', done: state.debts.length === 0 && state.transactions.length > 10 },
    { id: 'goal50', emoji: '🏁', title: 'Цель на 50%', done: state.goals.some((g) => g.saved >= g.target / 2) },
    { id: 'goal100', emoji: '🏆', title: 'Цель достигнута', done: state.goals.some((g) => g.target > 0 && g.saved >= g.target) },
    { id: 'invest', emoji: '📈', title: 'Первая инвестиция', done: state.investments.length > 0 },
    { id: 'nw100', emoji: '💯', title: 'Капитал 100 млн', done: t.netWorth >= 100e6 },
    { id: 'nw1b', emoji: '💎', title: 'Капитал 1 млрд', done: t.netWorth >= 1e9 },
  ];
}

export function recentTransactions(state: AppState, n = 5): Transaction[] {
  return [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
}
