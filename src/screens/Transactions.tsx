import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { fmt, monthKey, MONTHS, MONTHS_FULL, pct, summarizeMonth } from '../calc';
import { snapshot, useStore } from '../store';
import type { Transaction } from '../types';
import { TxSheet } from '../TxSheet';
import { Bar, Btn, C, Card, Empty, Row, Screen, T } from '../ui';

export function Transactions({ onSync, syncing }: { onSync: () => void; syncing: boolean }) {
  const state = useStore();
  const st = useMemo(() => snapshot(), [state]);
  const [offset, setOffset] = useState(0);
  const [edit, setEdit] = useState<Transaction | null>(null);
  const smsEnabled = st.settings.smsEnabled;

  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset);
  const key = monthKey(d);
  const sum = summarizeMonth(st, key);
  const cats = new Map(st.categories.map((c) => [c.id, c]));
  const accs = new Map(st.accounts.map((a) => [a.id, a]));

  const list = st.transactions.filter((t) => monthKey(t.date) === key).sort((a, b) => b.date.localeCompare(a.date));
  const days = new Map<string, Transaction[]>();
  for (const t of list) {
    const k = t.date.slice(0, 10);
    days.set(k, [...(days.get(k) ?? []), t]);
  }

  const top = Object.entries(sum.byCategory).filter(([id]) => cats.get(id)?.group !== 'saving').sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <Screen title="Операции" right={smsEnabled ? <Btn small kind="ghost" title={syncing ? '…' : '📩 SMS'} onPress={onSync} /> : undefined}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Pressable onPress={() => setOffset(offset - 1)} hitSlop={12}><T style={{ fontSize: 24, color: C.sub }}>‹</T></Pressable>
        <T style={{ fontSize: 18, fontWeight: '800' }}>{MONTHS_FULL[d.getMonth()]} {d.getFullYear()}</T>
        <Pressable onPress={() => offset < 0 && setOffset(offset + 1)} hitSlop={12}><T style={{ fontSize: 24, color: offset < 0 ? C.sub : C.line }}>›</T></Pressable>
      </Row>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View><T style={{ color: C.sub, fontSize: 12 }}>Доход</T><T style={{ color: C.green, fontWeight: '800', fontSize: 17 }}>{fmt(sum.income)}</T></View>
          <View style={{ alignItems: 'flex-end' }}><T style={{ color: C.sub, fontSize: 12 }}>Расходы</T><T style={{ color: C.red, fontWeight: '800', fontSize: 17 }}>{fmt(sum.expenses)}</T></View>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
          <T style={{ color: C.sub, fontSize: 13 }}>Свободный поток: <T style={{ color: sum.freeCashFlow >= 0 ? C.green : C.red, fontWeight: '700', fontSize: 13 }}>{fmt(sum.freeCashFlow)}</T></T>
          <T style={{ color: C.sub, fontSize: 13 }}>Отложено {pct(sum.savingsRate)}</T>
        </Row>
        <Row style={{ gap: 4, marginTop: 12, height: 10, borderRadius: 6, overflow: 'hidden' }}>
          {(['mandatory', 'essential', 'discretionary', 'saving'] as const).map((g) => {
            const total = sum.expenses + sum.saved || 1;
            const color = { mandatory: C.blue, essential: C.purple, discretionary: C.red, saving: C.gold }[g];
            return sum.byGroup[g] > 0 ? <View key={g} style={{ flex: sum.byGroup[g] / total, backgroundColor: color, height: 10 }} /> : null;
          })}
        </Row>
        <Row style={{ gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          {([['Обязательные', C.blue, 'mandatory'], ['Необходимые', C.purple, 'essential'], ['Желания', C.red, 'discretionary'], ['Цели', C.gold, 'saving']] as const).map(([l, c, g]) => (
            <T key={g} style={{ fontSize: 11, color: C.sub }}><T style={{ color: c, fontSize: 11 }}>●</T> {l} {fmt(sum.byGroup[g], false)}</T>
          ))}
        </Row>
      </Card>

      {top.length > 0 && (
        <Card>
          <T style={{ fontWeight: '800', marginBottom: 10 }}>Куда уходят деньги</T>
          {top.map(([id, v]) => (
            <View key={id} style={{ marginBottom: 10 }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                <T style={{ fontSize: 14 }}>{cats.get(id)?.emoji} {cats.get(id)?.name}</T>
                <T style={{ fontSize: 14, fontWeight: '700' }}>{fmt(v)}</T>
              </Row>
              <Bar value={v / top[0][1]} height={6} color={C.red} />
            </View>
          ))}
        </Card>
      )}

      {list.length === 0 ? (
        <Empty emoji="🧾" title="Пока пусто" text={smsEnabled ? 'Нажми «📩 SMS», чтобы подтянуть операции из банковских SMS, или добавь вручную кнопкой ＋.' : 'Добавь первую операцию кнопкой ＋ внизу. Включи чтение SMS в «Ещё → SMS», чтобы операции появлялись сами.'} />
      ) : Array.from(days.entries()).map(([day, items]) => {
        const dd = new Date(day);
        const net = items.reduce((a, t) => a + (t.kind === 'income' ? t.amount : -t.amount), 0);
        return (
          <View key={day} style={{ marginBottom: 6 }}>
            <Row style={{ justifyContent: 'space-between', marginTop: 8, marginBottom: 6 }}>
              <T style={{ color: C.sub, fontSize: 13, fontWeight: '700' }}>{dd.getDate()} {MONTHS[dd.getMonth()]}</T>
              <T style={{ color: C.sub, fontSize: 13 }}>{net >= 0 ? '+' : ''}{fmt(net, false)}</T>
            </Row>
            <Card style={{ paddingVertical: 4 }}>
              {items.map((t, i) => {
                const c = cats.get(t.categoryId);
                return (
                  <Pressable key={t.id} onPress={() => setEdit(t)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <T style={{ fontSize: 20 }}>{c?.emoji ?? '•'}</T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <T style={{ fontWeight: '600' }} numberOfLines={1}>{t.note || c?.name}</T>
                      <T style={{ color: C.sub, fontSize: 12 }} numberOfLines={1}>
                        {c?.name}{t.accountId && accs.get(t.accountId) ? ` · ${accs.get(t.accountId)!.name}` : ''}{t.source === 'sms' ? ' · SMS' : ''}
                      </T>
                    </View>
                    <T style={{ fontWeight: '800', color: t.kind === 'income' ? C.green : C.text }}>{t.kind === 'income' ? '+' : '−'}{fmt(t.amount, false)}</T>
                  </Pressable>
                );
              })}
            </Card>
          </View>
        );
      })}
      <TxSheet visible={!!edit} editing={edit} onClose={() => setEdit(null)} />
    </Screen>
  );
}
