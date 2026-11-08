import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { dsti, fmt, healthScore, monthlyMandatory, MONTHS, nextDueDate, daysUntil, pct, totals } from '../calc';
import { snapshot, uid, useStore } from '../store';
import type { Account, Bill, Debt, Investment } from '../types';
import { Bar, Btn, C, Card, Empty, FormSheet, Row, Screen, T, type Field } from '../ui';

type Back = { onBack: () => void };

// ---------------- Menu ----------------
export function More({ go }: { go: (p: string) => void }) {
  const st = useStore();
  const items: [string, string, string, string][] = [
    ['report', '🤖', 'Отчёт для ИИ', 'Файл с расчётами для Claude'],
    ['sms', '📩', 'SMS от банков', st.settings.smsEnabled ? `${st.pendingSms.length} ждут подтверждения` : 'Включить автоучёт'],
    ['bills', '🗓️', 'Обязательные платежи', `${st.bills.length} шт. · напоминания`],
    ['debts', '🏦', 'Долги и кредиты', st.debts.length ? `${st.debts.length} шт.` : 'Нет долгов'],
    ['accounts', '💳', 'Счета и карты', `${st.accounts.length} шт.`],
    ['investments', '📈', 'Инвестиции', `${st.investments.length} шт.`],
    ['health', '❤️', 'Финансовое здоровье', 'Разбор индекса'],
    ['settings', '⚙️', 'Настройки и резервная копия', 'Уведомления, курс, бэкап'],
  ];
  return (
    <Screen title="Ещё">
      {items.map(([id, e, t, sub]) => (
        <Card key={id} onPress={() => go(id)} style={{ paddingVertical: 14 }}>
          <Row>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <T style={{ fontSize: 22 }}>{e}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '700', fontSize: 16 }}>{t}</T>
              <T style={{ color: C.sub, fontSize: 13 }}>{sub}</T>
            </View>
            <T style={{ color: C.dim, fontSize: 22 }}>›</T>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}

// ---------------- Bills ----------------
const FREQ = [
  { value: 'monthly', label: 'Ежемесячно' }, { value: 'quarterly', label: 'Раз в квартал' },
  { value: 'semiannual', label: 'Раз в полгода' }, { value: 'annual', label: 'Раз в год' },
];
const billFields: Field[] = [
  { key: 'name', label: 'Название', type: 'text', placeholder: 'Аренда, интернет, контракт…' },
  { key: 'amount', label: 'Сумма', type: 'amount', placeholder: '500 000' },
  { key: 'frequency', label: 'Как часто', type: 'select', options: FREQ },
  { key: 'dueDay', label: 'День оплаты (1-31)', type: 'number', placeholder: '10' },
  { key: 'dueMonth', label: 'Месяц (для неежемесячных, 1-12)', type: 'number', placeholder: '4' },
  { key: 'autopay', label: 'Автоплатёж', type: 'switch' },
];

export function Bills({ onBack }: Back) {
  const st = useStore();
  const [edit, setEdit] = useState<Partial<Bill> | null>(null);
  const [pay, setPay] = useState<Bill | null>(null);
  const bills = [...st.bills].map((b) => ({ b, due: nextDueDate(b) })).sort((x, y) => x.due.getTime() - y.due.getTime());
  return (
    <Screen title="Платежи" subtitle={`В месяц: ${fmt(monthlyMandatory(snapshot()))} (вместе с кредитами)`} onBack={onBack}
      right={<Btn small title="＋" onPress={() => setEdit({ frequency: 'monthly', dueDay: 10, autopay: false })} />}>
      {bills.length === 0 && <Empty emoji="🗓️" title="Нет платежей" text="Добавь аренду, коммуналку, связь, контракт за учёбу, налоги. Напомню за 3 дня и в день оплаты." />}
      {bills.map(({ b, due }) => {
        const d = daysUntil(due);
        return (
          <Card key={b.id} onPress={() => setEdit(b)} style={d < 0 ? { borderColor: C.red } : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '700', fontSize: 16 }}>{b.name}{b.autopay ? ' · авто' : ''}</T>
                <T style={{ color: d < 0 ? C.red : d <= 3 ? C.gold : C.sub, fontSize: 13 }}>
                  {d < 0 ? `Просрочен на ${-d} дн.` : d === 0 ? 'Сегодня' : `${due.getDate()} ${MONTHS[due.getMonth()]} · через ${d} дн.`}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T style={{ fontWeight: '800' }}>{fmt(b.amount)}</T>
                <Pressable onPress={() => setPay(b)} hitSlop={8}><T style={{ color: C.green, fontSize: 13, marginTop: 4 }}>Оплачено ✓</T></Pressable>
              </View>
            </Row>
          </Card>
        );
      })}
      <FormSheet visible={!!edit} title={edit?.id ? 'Платёж' : 'Новый платёж'} fields={billFields}
        initial={{ ...edit, dueMonth: edit?.dueMonth ?? '' }}
        onClose={() => setEdit(null)}
        onDelete={edit?.id ? () => { st.removeBill(edit.id!); setEdit(null); } : undefined}
        onSave={(v) => {
          st.upsertBill({
            id: edit?.id ?? uid(), name: v.name, amount: v.amount, frequency: v.frequency ?? 'monthly',
            dueDay: Math.min(31, Math.max(1, Math.round(v.dueDay))), dueMonth: v.dueMonth ? Math.min(12, Math.max(1, Math.round(v.dueMonth))) : undefined,
            autopay: !!v.autopay, lastPaid: (edit as Bill)?.lastPaid,
          });
          setEdit(null);
        }} />
      <FormSheet visible={!!pay} title={`Оплачено: ${pay?.name}`} saveLabel="Записать оплату"
        fields={st.accounts.length ? [{ key: 'accountId', label: 'С какого счёта', type: 'select', options: [{ value: '', label: 'Не указывать' }, ...st.accounts.map((a) => ({ value: a.id, label: a.name }))] }] : []}
        initial={{ accountId: '' }} onClose={() => setPay(null)}
        onSave={(v) => { if (pay) st.markBillPaid(pay.id, v.accountId || undefined); setPay(null); }} />
    </Screen>
  );
}

// ---------------- Debts ----------------
const debtFields: Field[] = [
  { key: 'name', label: 'Название', type: 'text', placeholder: 'Рассрочка за телефон' },
  { key: 'lender', label: 'Кредитор', type: 'text', placeholder: 'Банк / человек' },
  { key: 'balance', label: 'Остаток долга', type: 'amount' },
  { key: 'rate', label: 'Ставка, % годовых', type: 'number', placeholder: '28' },
  { key: 'monthlyPayment', label: 'Платёж в месяц', type: 'amount' },
  { key: 'dueDay', label: 'День платежа', type: 'number', placeholder: '15' },
];

export function Debts({ onBack }: Back) {
  const st = useStore();
  const [edit, setEdit] = useState<Partial<Debt> | null>(null);
  const d = dsti(snapshot());
  const total = st.debts.reduce((a, x) => a + x.balance, 0);
  const order = [...st.debts].sort((a, b) => b.rate - a.rate);
  return (
    <Screen title="Долги" onBack={onBack} right={<Btn small title="＋" onPress={() => setEdit({ rate: 0, dueDay: 15 })} />}>
      {st.debts.length > 0 && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View><T style={{ color: C.sub, fontSize: 12 }}>Всего долгов</T><T style={{ fontWeight: '800', fontSize: 20, color: C.red }}>{fmt(total)}</T></View>
            <View style={{ alignItems: 'flex-end' }}><T style={{ color: C.sub, fontSize: 12 }}>DSTI</T><T style={{ fontWeight: '800', fontSize: 20, color: d > 0.5 ? C.red : d > 0.35 ? C.gold : C.green }}>{pct(d)}</T></View>
          </Row>
          <T style={{ color: C.sub, fontSize: 13, marginTop: 8, lineHeight: 19 }}>
            DSTI = платежи по долгам / минимальный месячный доход. До 35% нормально, выше 50% опасно.
            {order.length > 1 ? ` Гаси первым самый дорогой: ${order[0].name} (${order[0].rate}%).` : ''}
          </T>
        </Card>
      )}
      {st.debts.length === 0 && <Empty emoji="🕊️" title="Долгов нет" text="Отлично! Если есть кредит или рассрочка, добавь сюда, чтобы видеть план погашения." />}
      {order.map((x) => (
        <Card key={x.id} onPress={() => setEdit(x)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '700', fontSize: 16 }}>{x.name}</T>
              <T style={{ color: C.sub, fontSize: 13 }}>{x.lender} · {x.rate}% · {fmt(x.monthlyPayment)}/мес</T>
            </View>
            <T style={{ fontWeight: '800', color: C.red }}>{fmt(x.balance)}</T>
          </Row>
        </Card>
      ))}
      <FormSheet visible={!!edit} title={edit?.id ? 'Долг' : 'Новый долг'} fields={debtFields} initial={edit ?? {}}
        onClose={() => setEdit(null)} onDelete={edit?.id ? () => { st.removeDebt(edit.id!); setEdit(null); } : undefined}
        onSave={(v) => { st.upsertDebt({ id: edit?.id ?? uid(), name: v.name, lender: v.lender ?? '', balance: v.balance, rate: v.rate, monthlyPayment: v.monthlyPayment, dueDay: Math.round(v.dueDay) }); setEdit(null); }} />
    </Screen>
  );
}

// ---------------- Accounts ----------------
const ACC_TYPES = [{ value: 'card', label: '💳 Карта' }, { value: 'cash', label: '💵 Наличные' }, { value: 'deposit', label: '🏦 Депозит' }, { value: 'usd', label: '💲 USD (в сумах)' }];
const accFields: Field[] = [
  { key: 'name', label: 'Название', type: 'text', placeholder: 'Humo Kapitalbank' },
  { key: 'type', label: 'Тип', type: 'select', options: ACC_TYPES },
  { key: 'balance', label: 'Баланс сейчас (сум)', type: 'amount' },
  { key: 'cardLast4', label: 'Последние 4 цифры карты (для SMS)', type: 'text', placeholder: '1234' },
  { key: 'note', label: 'Заметка (ставка, срок)', type: 'text' },
];

export function Accounts({ onBack }: Back) {
  const st = useStore();
  const [edit, setEdit] = useState<Partial<Account> | null>(null);
  const emoji = { card: '💳', cash: '💵', deposit: '🏦', usd: '💲' } as const;
  return (
    <Screen title="Счета" subtitle={`Всего: ${fmt(totals(snapshot()).cash)}`} onBack={onBack} right={<Btn small title="＋" onPress={() => setEdit({ type: 'card', balance: 0 })} />}>
      {st.accounts.length === 0 && <Empty emoji="💳" title="Добавь счета" text="Карты, наличные, депозиты. Если указать последние 4 цифры карты, баланс будет обновляться по SMS банка." />}
      {st.accounts.map((a) => (
        <Card key={a.id} onPress={() => setEdit(a)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '700', fontSize: 16 }}>{emoji[a.type]} {a.name}</T>
              <T style={{ color: C.sub, fontSize: 13 }}>{a.cardLast4 ? `•••• ${a.cardLast4}` : ''}{a.note ? ` ${a.note}` : ''}</T>
            </View>
            <T style={{ fontWeight: '800' }}>{fmt(a.balance)}</T>
          </Row>
        </Card>
      ))}
      <FormSheet visible={!!edit} title={edit?.id ? 'Счёт' : 'Новый счёт'} fields={accFields} initial={edit ?? {}}
        onClose={() => setEdit(null)} onDelete={edit?.id ? () => { st.removeAccount(edit.id!); setEdit(null); } : undefined}
        onSave={(v) => { st.upsertAccount({ id: edit?.id ?? uid(), name: v.name, type: v.type ?? 'card', balance: v.balance, cardLast4: String(v.cardLast4 ?? '').replace(/\D/g, '').slice(-4) || undefined, note: v.note }); setEdit(null); }} />
    </Screen>
  );
}

// ---------------- Investments ----------------
const INV_TYPES = [
  { value: 'deposit', label: 'Депозит' }, { value: 'bond', label: 'Облигации' }, { value: 'share', label: 'Акции UZSE' },
  { value: 'usd', label: 'USD' }, { value: 'gold', label: 'Золото' }, { value: 'business', label: 'Бизнес' }, { value: 'other', label: 'Другое' },
];
const invFields: Field[] = [
  { key: 'name', label: 'Название', type: 'text' },
  { key: 'type', label: 'Тип', type: 'select', options: INV_TYPES },
  { key: 'invested', label: 'Вложено', type: 'amount' },
  { key: 'currentValue', label: 'Стоит сейчас', type: 'amount' },
  { key: 'date', label: 'Дата покупки (ГГГГ-ММ-ДД)', type: 'text' },
  { key: 'thesis', label: 'Зачем купил / когда продам', type: 'text' },
];

export function Investments({ onBack }: Back) {
  const st = useStore();
  const [edit, setEdit] = useState<Partial<Investment> | null>(null);
  const inv = st.investments.reduce((a, i) => a + i.invested, 0);
  const cur = st.investments.reduce((a, i) => a + i.currentValue, 0);
  return (
    <Screen title="Инвестиции" onBack={onBack} right={<Btn small title="＋" onPress={() => setEdit({ type: 'deposit', date: new Date().toISOString().slice(0, 10) })} />}>
      {st.investments.length > 0 && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View><T style={{ color: C.sub, fontSize: 12 }}>Портфель</T><T style={{ fontWeight: '800', fontSize: 20 }}>{fmt(cur)}</T></View>
            <View style={{ alignItems: 'flex-end' }}><T style={{ color: C.sub, fontSize: 12 }}>Доходность</T><T style={{ fontWeight: '800', fontSize: 20, color: cur >= inv ? C.green : C.red }}>{inv ? pct((cur - inv) / inv) : '0%'}</T></View>
          </Row>
        </Card>
      )}
      {st.investments.length === 0 && <Empty emoji="📈" title="Пока нет инвестиций" text="Порядок: подушка → гашение дорогих долгов → депозиты/облигации → акции и бизнес. Добавляй сюда всё, что работает на тебя." />}
      {st.investments.map((i) => {
        const r = i.invested ? (i.currentValue - i.invested) / i.invested : 0;
        return (
          <Card key={i.id} onPress={() => setEdit(i)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '700', fontSize: 16 }}>{i.name}</T>
                <T style={{ color: C.sub, fontSize: 13 }}>{INV_TYPES.find((t) => t.value === i.type)?.label} · вложено {fmt(i.invested)}</T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T style={{ fontWeight: '800' }}>{fmt(i.currentValue)}</T>
                <T style={{ color: r >= 0 ? C.green : C.red, fontSize: 13 }}>{r >= 0 ? '+' : ''}{pct(r)}</T>
              </View>
            </Row>
          </Card>
        );
      })}
      <FormSheet visible={!!edit} title={edit?.id ? 'Инвестиция' : 'Новая инвестиция'} fields={invFields} initial={edit ?? {}}
        onClose={() => setEdit(null)} onDelete={edit?.id ? () => { st.removeInvestment(edit.id!); setEdit(null); } : undefined}
        onSave={(v) => { st.upsertInvestment({ id: edit?.id ?? uid(), name: v.name, type: v.type ?? 'other', invested: v.invested, currentValue: v.currentValue, date: v.date ?? '', thesis: v.thesis }); setEdit(null); }} />
    </Screen>
  );
}

// ---------------- Health detail ----------------
export function Health({ onBack }: Back) {
  const state = useStore();
  const h = useMemo(() => healthScore(snapshot()), [state]);
  const tips: Record<string, string> = {
    'Сбережения': 'Сразу при получении дохода переводи 20% в цели. Сначала заплати себе.',
    'Подушка': 'Создай цель «Подушка безопасности» на 6 месяцев обязательных расходов и держи её на депозите с возможностью снятия.',
    'Долги': 'Гаси самый дорогой долг первым (метод лавины). Не бери новые кредиты на потребление.',
    'Платежи': 'Отмечай оплату в разделе «Платежи», включи автоплатёж там, где можно.',
    'Цели': 'Пополняй цели каждый месяц, даже небольшими суммами. Регулярность важнее размера.',
  };
  return (
    <Screen title="Здоровье" subtitle={`Индекс ${h.total} из 100`} onBack={onBack}>
      {h.parts.map((p) => (
        <Card key={p.label}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <T style={{ fontWeight: '800', fontSize: 16 }}>{p.label}</T>
            <T style={{ fontWeight: '800', color: p.score >= 14 ? C.green : p.score >= 8 ? C.gold : C.red }}>{Math.round(p.score)}/20</T>
          </Row>
          <Bar value={p.score / 20} color={p.score >= 14 ? C.green : p.score >= 8 ? C.gold : C.red} />
          <T style={{ color: C.sub, marginTop: 8, fontSize: 13 }}>{p.hint}</T>
          {p.score < 18 && <T style={{ marginTop: 6, fontSize: 13, lineHeight: 19 }}>👉 {tips[p.label]}</T>}
        </Card>
      ))}
    </Screen>
  );
}
