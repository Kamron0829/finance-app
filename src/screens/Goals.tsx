import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { avgFreeCashFlow, fmt, fmtShort, goalPlan, pct } from '../calc';
import { snapshot, uid, useStore } from '../store';
import type { Goal } from '../types';
import { Bar, Btn, C, Card, Empty, FormSheet, GOAL_COLORS, Ring, Row, Screen, T, type Field } from '../ui';

const EMOJIS = [
  { value: '🚗', label: '🚗 Машина' }, { value: '🏠', label: '🏠 Недвижимость' }, { value: '🛡️', label: '🛡️ Подушка' },
  { value: '💼', label: '💼 Бизнес' }, { value: '✈️', label: '✈️ Путешествие' }, { value: '🎓', label: '🎓 Учёба' },
  { value: '💍', label: '💍 Свадьба' }, { value: '📈', label: '📈 Капитал' }, { value: '🎯', label: '🎯 Другое' },
];

const goalFields = (accounts: { id: string; name: string }[]): Field[] => [
  { key: 'emoji', label: 'Тип', type: 'select', options: EMOJIS },
  { key: 'name', label: 'Название', type: 'text', placeholder: 'Mercedes C-Class' },
  { key: 'target', label: 'Сколько нужно (сум)', type: 'amount', placeholder: '600 000 000' },
  { key: 'saved', label: 'Уже накоплено', type: 'amount', placeholder: '0' },
  { key: 'deadline', label: 'Срок (ГГГГ-ММ)', type: 'text', placeholder: '2028-06' },
  { key: 'priority', label: 'Приоритет', type: 'select', options: ['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v === '1' ? '1 (главная)' : v })) },
  { key: 'heldIn', label: 'Где хранятся деньги', type: 'text', placeholder: 'Депозит, USD, карта…' },
];

export function Goals() {
  const state = useStore();
  const st = useMemo(() => snapshot(), [state]);
  const upsert = useStore((x) => x.upsertGoal);
  const remove = useStore((x) => x.removeGoal);
  const contribute = useStore((x) => x.contributeToGoal);
  const [edit, setEdit] = useState<Partial<Goal> | null>(null);
  const [topup, setTopup] = useState<Goal | null>(null);

  const fcf = avgFreeCashFlow(st);
  const goals = [...st.goals].sort((a, b) => a.priority - b.priority);
  const totalNeed = goals.reduce((a, g) => a + goalPlan(st, g).requiredMonthly, 0);
  const defaultDeadline = `${new Date().getFullYear() + 2}-12`;

  return (
    <Screen title="Цели" subtitle="Машина, недвижимость, свобода" right={<Btn small title="＋ Цель" onPress={() => setEdit({ emoji: '🚗', priority: 1, saved: 0, deadline: defaultDeadline })} />}>
      {goals.length > 0 && (
        <Card style={{ backgroundColor: totalNeed <= fcf ? '#10291F' : '#2A1515', borderColor: totalNeed <= fcf ? '#1F5A4C' : '#5A1F2A' }}>
          <T style={{ fontWeight: '800' }}>{totalNeed <= fcf ? '✅ Твой денежный поток тянет все цели' : '⚠️ На все цели сейчас не хватает'}</T>
          <T style={{ color: C.sub, marginTop: 6, lineHeight: 20 }}>
            Нужно откладывать {fmt(totalNeed)} в месяц. Средний свободный поток: {fmt(fcf)}.
            {totalNeed > fcf ? ` Не хватает ${fmt(totalNeed - fcf)}: подними доход, сдвинь сроки или начни с цели №1.` : ''}
          </T>
        </Card>
      )}

      {goals.length === 0 && (
        <Empty emoji="🎯" title="Какая у тебя мечта?" text="Добавь цель: машину, квартиру или подушку безопасности. Я посчитаю, сколько нужно откладывать каждый месяц с учётом инфляции и успеваешь ли ты к сроку."
          action={<Btn title="Добавить цель" onPress={() => setEdit({ emoji: '🚗', priority: 1, saved: 0, deadline: defaultDeadline })} />} />
      )}

      {goals.map((g) => {
        const p = goalPlan(st, g);
        return (
          <Card key={g.id} onPress={() => setEdit(g)}>
            <Row style={{ gap: 16 }}>
              <Ring value={p.progress} size={110} stroke={12} colors={[g.color, C.gold]}>
                <T style={{ fontSize: 24 }}>{g.emoji}</T>
                <T style={{ fontWeight: '900', fontSize: 18, color: g.color }}>{pct(p.progress)}</T>
              </Ring>
              <View style={{ flex: 1 }}>
                <T style={{ fontSize: 18, fontWeight: '800' }} numberOfLines={1}>{g.name}</T>
                <T style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>Приоритет {g.priority} · до {g.deadline}</T>
                <T style={{ fontWeight: '800', fontSize: 16, marginTop: 8 }}>{fmtShort(g.saved)} <T style={{ color: C.sub, fontSize: 14 }}>из {fmtShort(g.target)}</T></T>
                <View style={{ marginTop: 8 }}><Bar value={p.progress} color={g.color} height={6} /></View>
              </View>
            </Row>
            <View style={{ marginTop: 14, gap: 4 }}>
              <Line k="Осталось месяцев" v={String(p.monthsLeft)} />
              <Line k={`С учётом инфляции ${st.settings.inflation}%`} v={fmt(p.inflatedTarget)} />
              <Line k="Нужно откладывать в месяц" v={fmt(p.requiredMonthly)} strong />
              {p.etaMonths !== null && <Line k="При текущем темпе успеешь за" v={`${p.etaMonths} мес.`} />}
              {p.feasible !== null && (
                <T style={{ marginTop: 6, color: p.feasible ? C.green : C.gold, fontSize: 13 }}>
                  {p.feasible ? '✅ Свободного потока хватает на эту цель' : '⚠️ Свободного потока не хватает: подними доход или сдвинь срок'}
                </T>
              )}
            </View>
            <Btn title="＋ Пополнить" kind="gold" small onPress={() => setTopup(g)} style={{ marginTop: 12 }} />
          </Card>
        );
      })}

      <FormSheet
        visible={!!edit}
        title={edit?.id ? 'Цель' : 'Новая цель'}
        fields={goalFields(st.accounts)}
        initial={{ ...edit, priority: String(edit?.priority ?? 1) }}
        onClose={() => setEdit(null)}
        onDelete={edit?.id ? () => { remove(edit.id!); setEdit(null); } : undefined}
        onSave={(v) => {
          const dl = /^\d{4}-\d{2}$/.test(String(v.deadline)) ? v.deadline : defaultDeadline;
          upsert({
            id: edit?.id ?? uid(), name: v.name, emoji: v.emoji ?? '🎯', target: v.target, saved: v.saved, deadline: dl,
            priority: Number(v.priority) || 3, heldIn: v.heldIn, createdAt: (edit as Goal)?.createdAt ?? new Date().toISOString(),
            color: (edit as Goal)?.color ?? GOAL_COLORS[st.goals.length % GOAL_COLORS.length],
          });
          setEdit(null);
        }}
      />
      <FormSheet
        visible={!!topup}
        title={`Пополнить: ${topup?.emoji} ${topup?.name}`}
        saveLabel="Пополнить"
        fields={[
          { key: 'amount', label: 'Сумма', type: 'amount', placeholder: '1 000 000' },
          ...(st.accounts.length ? [{ key: 'accountId', label: 'Списать со счёта', type: 'select' as const, options: [{ value: '', label: 'Не списывать' }, ...st.accounts.map((a) => ({ value: a.id, label: a.name }))] }] : []),
        ]}
        initial={{ amount: '', accountId: '' }}
        onClose={() => setTopup(null)}
        onSave={(v) => { if (topup && v.amount > 0) contribute(topup.id, v.amount, v.accountId || undefined); setTopup(null); }}
      />
    </Screen>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T style={{ color: C.sub, fontSize: 13 }}>{k}</T>
      <T style={{ fontSize: 13, fontWeight: strong ? '800' : '600', color: strong ? C.gold : C.text }}>{v}</T>
    </Row>
  );
}
