import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import {
  avgFreeCashFlow, avgIncome, dsti, fmt, goalPlan, healthScore, lastMonthKeys, level, monthKey,
  monthlyMandatory, MONTHS_FULL, pct, streak, summarizeMonth, totals, upcomingBills,
} from './calc';
import { snapshot } from './store';
import type { AppState } from './types';

const monthName = (k: string) => {
  const [y, m] = k.split('-').map(Number);
  return `${MONTHS_FULL[m - 1]} ${y}`;
};

/** Markdown report with every number and the math behind it, ready to paste into Claude. */
export function buildAiReport(state: AppState, question?: string): string {
  const t = totals(state);
  const inc = avgIncome(state);
  const fcf = avgFreeCashFlow(state);
  const h = healthScore(state);
  const lv = level(t.netWorth);
  const cat = new Map(state.categories.map((c) => [c.id, c]));
  const L: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  L.push(`# Финансовый отчёт для ИИ-советника (${today})`);
  L.push('');
  L.push('> Инструкция для ИИ: ты мой личный финансовый директор (CFO) в Узбекистане (Ташкент). Ниже все мои цифры из приложения Moliya. ' +
    'Проанализируй их честно, покажи расчёты (входные данные -> формула -> результат) и ответь:');
  L.push('> 1. Реалистичны ли мои цели и сроки при текущем доходе? Если нет, что изменить (срок, сумма, доход)?');
  L.push('> 2. Что сделать в ближайшие 30 дней, чтобы ускорить рост капитала? Дай 3-5 конкретных шагов.');
  L.push('> 3. Какие риски ты видишь (платежи, долги, подушка безопасности)?');
  L.push('> 4. Куда направить свободные деньги: подушка, долги, цели или инвестиции (с учётом инфляции и ставок депозитов в Узбекистане)?');
  if (question?.trim()) L.push(`> Мой вопрос: ${question.trim()}`);
  L.push('');
  L.push('Валюта: UZS (сум). Курс USD/UZS в приложении: ' + fmt(state.settings.usdRate) + '. Инфляция для расчётов: ' + state.settings.inflation + '% в год.');
  L.push('');

  L.push('## 1. Итоги');
  L.push(`- Чистый капитал: **${fmt(t.netWorth)}** = деньги на счетах ${fmt(t.cash)} + накоплено в целях ${fmt(t.goalsSaved)} + инвестиции ${fmt(t.invest)} - долги ${fmt(t.debt)}`);
  L.push(`- Уровень: ${lv.index}. ${lv.name}${lv.next ? ` (до «${lv.next.name}» ${pct(lv.progress)})` : ''}`);
  L.push(`- Индекс финансового здоровья: **${h.total}/100**`);
  for (const p of h.parts) L.push(`  - ${p.label}: ${Math.round(p.score)}/20 (${p.hint})`);
  L.push(`- Доход за 6 мес.: мин ${fmt(inc.min)}, средний ${fmt(inc.avg)}, макс ${fmt(inc.max)}`);
  L.push(`- Обязательные платежи в месяц (счета + кредиты): ${fmt(monthlyMandatory(state))}`);
  L.push(`- Средний свободный денежный поток (последние месяцы): ${fmt(fcf)}`);
  L.push(`- DSTI (платежи по долгам / минимальный доход): ${pct(dsti(state))}`);
  L.push(`- Дней подряд в приложении: ${streak(state.checkins)}`);
  L.push('');

  L.push('## 2. Счета');
  if (!state.accounts.length) L.push('_нет данных_');
  else {
    L.push('| Счёт | Тип | Баланс |'); L.push('|---|---|---|');
    for (const a of state.accounts) L.push(`| ${a.name} | ${a.type} | ${fmt(a.balance)} |`);
  }
  L.push('');

  L.push('## 3. Помесячный журнал (6 мес.)');
  L.push('| Месяц | Доход | Обязательные | Необходимые | Желания | Отложено | Свободный поток | Норма сбережений |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const k of lastMonthKeys(6)) {
    const m = summarizeMonth(state, k);
    L.push(`| ${monthName(k)} | ${fmt(m.income, false)} | ${fmt(m.byGroup.mandatory, false)} | ${fmt(m.byGroup.essential, false)} | ${fmt(m.byGroup.discretionary, false)} | ${fmt(m.saved, false)} | ${fmt(m.freeCashFlow, false)} | ${pct(m.savingsRate)} |`);
  }
  L.push('');

  const cur = summarizeMonth(state, monthKey(new Date()));
  const prevKey = lastMonthKeys(2)[0];
  const prev = summarizeMonth(state, prevKey);
  L.push(`## 4. Расходы по категориям (текущий месяц vs ${monthName(prevKey)})`);
  const ids = Array.from(new Set([...Object.keys(cur.byCategory), ...Object.keys(prev.byCategory)]));
  ids.sort((a, b) => (cur.byCategory[b] ?? 0) - (cur.byCategory[a] ?? 0));
  if (!ids.length) L.push('_нет данных_');
  else {
    L.push('| Категория | Группа | Сейчас | Прошлый месяц |'); L.push('|---|---|---|---|');
    for (const id of ids) {
      const c = cat.get(id);
      L.push(`| ${c?.name ?? id} | ${c?.group ?? ''} | ${fmt(cur.byCategory[id] ?? 0, false)} | ${fmt(prev.byCategory[id] ?? 0, false)} |`);
    }
  }
  L.push('');

  L.push('## 5. Обязательные платежи');
  if (!state.bills.length) L.push('_нет данных_');
  else {
    L.push('| Платёж | Сумма | Периодичность | День | Автоплатёж | Следующий срок |'); L.push('|---|---|---|---|---|---|');
    const up = new Map(upcomingBills(state, 400).map((x) => [x.bill.id, x]));
    for (const b of state.bills) {
      const u = up.get(b.id);
      L.push(`| ${b.name} | ${fmt(b.amount, false)} | ${b.frequency} | ${b.dueDay} | ${b.autopay ? 'да' : 'нет'} | ${u ? u.due.toISOString().slice(0, 10) + (u.days < 0 ? ' (ПРОСРОЧЕН)' : ` (через ${u.days} дн.)`) : ''} |`);
    }
  }
  L.push('');

  L.push('## 6. Долги');
  if (!state.debts.length) L.push('Долгов нет.');
  else {
    L.push('| Долг | Кредитор | Остаток | Ставка % | Платёж/мес | День | Мес. до погашения (оценка) |'); L.push('|---|---|---|---|---|---|---|');
    for (const d of state.debts) L.push(`| ${d.name} | ${d.lender} | ${fmt(d.balance, false)} | ${d.rate} | ${fmt(d.monthlyPayment, false)} | ${d.dueDay} | ${monthsToPayoff(d.balance, d.rate, d.monthlyPayment)} |`);
  }
  L.push('');

  L.push('## 7. Цели');
  if (!state.goals.length) L.push('_нет целей_');
  else {
    L.push('| Цель | Цель (сум) | С учётом инфляции | Накоплено | Прогресс | Срок | Мес. осталось | Нужно в месяц | Хватает потока? |');
    L.push('|---|---|---|---|---|---|---|---|---|');
    for (const g of [...state.goals].sort((a, b) => a.priority - b.priority)) {
      const p = goalPlan(state, g);
      L.push(`| ${g.emoji} ${g.name} (приоритет ${g.priority}) | ${fmt(g.target, false)} | ${fmt(p.inflatedTarget, false)} | ${fmt(g.saved, false)} | ${pct(p.progress)} | ${g.deadline} | ${p.monthsLeft} | ${fmt(p.requiredMonthly, false)} | ${p.feasible === null ? 'мало данных' : p.feasible ? 'да' : 'НЕТ'} |`);
    }
    const need = state.goals.reduce((a, g) => a + goalPlan(state, g).requiredMonthly, 0);
    L.push('');
    L.push(`Расчёт: нужно в месяц = (цель с инфляцией - накоплено) / месяцев до срока. Сумма по всем целям: ${fmt(need)} при среднем свободном потоке ${fmt(fcf)} -> ${fcf >= need ? 'хватает' : `не хватает ${fmt(need - fcf)} в месяц`}.`);
  }
  L.push('');

  L.push('## 8. Инвестиции');
  if (!state.investments.length) L.push('_нет инвестиций_');
  else {
    L.push('| Актив | Тип | Вложено | Сейчас | Доходность | Дата |'); L.push('|---|---|---|---|---|---|');
    for (const i of state.investments) {
      const r = i.invested > 0 ? (i.currentValue - i.invested) / i.invested : 0;
      L.push(`| ${i.name} | ${i.type} | ${fmt(i.invested, false)} | ${fmt(i.currentValue, false)} | ${pct(r)} | ${i.date} |`);
    }
  }
  L.push('');

  L.push('## 9. Последние 40 операций');
  const recent = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  if (!recent.length) L.push('_нет операций_');
  else {
    L.push('| Дата | Тип | Сумма | Категория | Комментарий |'); L.push('|---|---|---|---|---|');
    for (const x of recent) L.push(`| ${x.date.slice(0, 10)} | ${x.kind === 'income' ? 'доход' : 'расход'} | ${fmt(x.amount, false)} | ${cat.get(x.categoryId)?.name ?? x.categoryId} | ${(x.note ?? '').replace(/\|/g, '/')} |`);
  }
  L.push('');
  L.push('_Сформировано приложением Moliya. Все данные хранятся только на телефоне._');
  return L.join('\n');
}

function monthsToPayoff(balance: number, ratePct: number, payment: number): string {
  if (payment <= 0) return '-';
  const r = ratePct / 100 / 12;
  if (r === 0) return String(Math.ceil(balance / payment));
  if (payment <= balance * r) return 'никогда (платёж < процентов)';
  return String(Math.ceil(-Math.log(1 - (r * balance) / payment) / Math.log(1 + r)));
}

async function writeAndShare(name: string, content: string, mime: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    return;
  }
  const uri = FileSystem.documentDirectory + name;
  await FileSystem.writeAsStringAsync(uri, content);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: name });
}

export async function shareAiReport(question?: string) {
  const md = buildAiReport(snapshot(), question);
  await writeAndShare(`moliya-report-${new Date().toISOString().slice(0, 10)}.md`, md, 'text/markdown');
}

export async function copyAiReport(question?: string) {
  await Clipboard.setStringAsync(buildAiReport(snapshot(), question));
}

export async function exportBackup() {
  const json = JSON.stringify({ app: 'moliya', version: 1, exportedAt: new Date().toISOString(), state: snapshot() }, null, 2);
  await writeAndShare(`moliya-backup-${new Date().toISOString().slice(0, 10)}.json`, json, 'application/json');
}

export async function pickBackup(): Promise<AppState | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return null;
  const text = Platform.OS === 'web' ? await (await fetch(r.assets[0].uri)).text() : await FileSystem.readAsStringAsync(r.assets[0].uri);
  const parsed = JSON.parse(text);
  if (parsed?.app !== 'moliya' || !parsed.state) throw new Error('Это не файл резервной копии Moliya');
  return parsed.state as AppState;
}
