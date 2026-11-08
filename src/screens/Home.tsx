import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import {
  achievements, fmt, fmtShort, goalPlan, healthScore, lastMonthKeys, level, monthKey, MONTHS, pct, streak,
  summarizeMonth, totals, upcomingBills,
} from '../calc';
import { MOTIVATION } from '../notifications';
import { snapshot, useStore } from '../store';
import { Bar, Btn, C, Card, CountUp, GradientCard, Ring, Row, Screen, SectionTitle, T } from '../ui';

export type Nav = (page: string) => void;

export function Home({ go }: { go: Nav }) {
  const state = useStore();
  const st = useMemo(() => snapshot(), [state]);
  const t = totals(st);
  const lv = level(t.netWorth);
  const h = healthScore(st);
  const cur = summarizeMonth(st, monthKey(new Date()));
  const s = streak(st.checkins);
  const bills = upcomingBills(st, 14);
  const ach = achievements(st);
  const quote = MOTIVATION[Math.floor(Date.now() / 86400000) % MOTIVATION.length];
  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <View>
          <T style={{ color: C.sub }}>{hello},</T>
          <T style={{ fontSize: 26, fontWeight: '800' }}>{st.settings.name} 👋</T>
        </View>
        <View style={{ backgroundColor: s > 0 ? '#3A2A0E' : C.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: s > 0 ? C.gold2 : C.line }}>
          <T style={{ fontWeight: '800', color: s > 0 ? C.gold : C.sub }}>🔥 {s} {plural(s, 'день', 'дня', 'дней')}</T>
        </View>
      </Row>

      <GradientCard colors={['#0F3B33', '#0E2433', '#1A1730']}>
        <T style={{ color: '#A6F4DC', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>Чистый капитал</T>
        <CountUp value={t.netWorth} style={{ fontSize: 34, fontWeight: '900', marginTop: 4 }} />
        <Row style={{ marginTop: 10, gap: 16, flexWrap: 'wrap' }}>
          <Mini label="Счета" value={t.cash} />
          <Mini label="В целях" value={t.goalsSaved} />
          <Mini label="Инвест." value={t.invest} />
          {t.debt > 0 && <Mini label="Долги" value={-t.debt} red />}
        </Row>
        <View style={{ marginTop: 16 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <T style={{ fontWeight: '700' }}>{lv.emoji} Уровень {lv.index}: {lv.name}</T>
            {lv.next && <T style={{ color: C.gold, fontWeight: '700' }}>{pct(lv.progress)}</T>}
          </Row>
          <Bar value={lv.progress} color={C.gold} track="rgba(255,255,255,0.08)" />
          {lv.next && <T style={{ color: C.sub, fontSize: 12, marginTop: 6 }}>До уровня «{lv.next.emoji} {lv.next.name}» осталось {fmtShort(lv.next.min - t.netWorth)} сум</T>}
        </View>
      </GradientCard>

      {st.pendingSms.length > 0 && (
        <Card onPress={() => go('sms')} style={{ borderColor: C.gold2, backgroundColor: '#2A210E' }}>
          <T style={{ fontWeight: '800', color: C.gold }}>📩 {st.pendingSms.length} новых SMS от банков</T>
          <T style={{ color: C.sub, marginTop: 4 }}>Нажми, чтобы подтвердить операции одним касанием</T>
        </Card>
      )}

      <Card onPress={() => go('health')}>
        <Row style={{ gap: 16 }}>
          <Ring value={h.total / 100} size={104} stroke={11} colors={h.total >= 70 ? [C.green, C.green2] : h.total >= 40 ? [C.gold, C.gold2] : [C.red, C.gold2]}>
            <T style={{ fontSize: 28, fontWeight: '900' }}>{h.total}</T>
            <T style={{ fontSize: 11, color: C.sub }}>из 100</T>
          </Ring>
          <View style={{ flex: 1, gap: 7 }}>
            <T style={{ fontWeight: '800', marginBottom: 2 }}>Финансовое здоровье</T>
            {h.parts.map((p) => (
              <View key={p.label}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T style={{ fontSize: 12, color: C.sub }}>{p.label}</T>
                  <T style={{ fontSize: 12, color: C.sub }}>{Math.round(p.score)}/20</T>
                </Row>
                <Bar value={p.score / 20} height={5} color={p.score >= 14 ? C.green : p.score >= 8 ? C.gold : C.red} />
              </View>
            ))}
          </View>
        </Row>
      </Card>

      <SectionTitle right={<Pressable onPress={() => go('tx')}><T style={{ color: C.green, fontSize: 13 }}>Все операции ›</T></Pressable>}>Этот месяц</SectionTitle>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Stat label="Доход" value={cur.income} color={C.green} />
          <Stat label="Расходы" value={cur.expenses} color={C.red} />
          <Stat label="Отложено" value={cur.saved} color={C.gold} />
        </Row>
        <View style={{ marginTop: 14 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <T style={{ fontSize: 13, color: C.sub }}>Норма сбережений</T>
            <T style={{ fontSize: 13, fontWeight: '800', color: cur.savingsRate >= 0.2 ? C.green : C.gold }}>{pct(cur.savingsRate)} / 20%+</T>
          </Row>
          <Bar value={cur.savingsRate / 0.3} color={cur.savingsRate >= 0.2 ? C.green : C.gold} />
        </View>
        <MonthsChart />
      </Card>

      <SectionTitle right={<Pressable onPress={() => go('goals')}><T style={{ color: C.green, fontSize: 13 }}>Все цели ›</T></Pressable>}>Цели</SectionTitle>
      {st.goals.length === 0 ? (
        <Card onPress={() => go('goals')}>
          <T style={{ fontWeight: '700' }}>🎯 Поставь первую цель</T>
          <T style={{ color: C.sub, marginTop: 4 }}>Машина, недвижимость, подушка безопасности: приложение посчитает, сколько откладывать в месяц.</T>
        </Card>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {[...st.goals].sort((a, b) => a.priority - b.priority).map((g) => {
            const p = goalPlan(st, g);
            return (
              <Card key={g.id} onPress={() => go('goals')} style={{ width: 160, alignItems: 'center', marginBottom: 0 }}>
                <Ring value={p.progress} size={96} stroke={10} colors={[g.color, C.gold]}>
                  <T style={{ fontSize: 26 }}>{g.emoji}</T>
                </Ring>
                <T style={{ fontWeight: '800', marginTop: 8 }} numberOfLines={1}>{g.name}</T>
                <T style={{ color: g.color, fontWeight: '900', fontSize: 20 }}>{pct(p.progress)}</T>
                <T style={{ color: C.sub, fontSize: 12 }}>{fmtShort(g.saved)} / {fmtShort(g.target)}</T>
              </Card>
            );
          })}
        </ScrollView>
      )}

      <SectionTitle right={<Pressable onPress={() => go('bills')}><T style={{ color: C.green, fontSize: 13 }}>Все ›</T></Pressable>}>Платежи на 14 дней</SectionTitle>
      {bills.length === 0 ? (
        <Card><T style={{ color: C.sub }}>{st.bills.length ? '✅ В ближайшие 2 недели платежей нет' : 'Добавь обязательные платежи (аренда, связь, кредиты), и я напомню заранее.'}</T></Card>
      ) : bills.map(({ bill, due, days }) => (
        <Card key={bill.id} onPress={() => go('bills')} style={days < 0 ? { borderColor: C.red } : undefined}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '700' }}>{bill.name}</T>
              <T style={{ color: days < 0 ? C.red : days <= 3 ? C.gold : C.sub, fontSize: 13 }}>
                {days < 0 ? `Просрочен на ${-days} дн.` : days === 0 ? 'Сегодня' : `Через ${days} дн. · ${due.getDate()} ${MONTHS[due.getMonth()]}`}
              </T>
            </View>
            <T style={{ fontWeight: '800' }}>{fmt(bill.amount)}</T>
          </Row>
        </Card>
      ))}

      <GradientCard colors={['#2A1F0A', '#1A1525']} style={{ borderColor: '#4A3A12', marginTop: 8 }}>
        <T style={{ color: C.gold, fontWeight: '800', marginBottom: 6 }}>💡 Мысль дня</T>
        <T style={{ lineHeight: 22 }}>{quote}</T>
      </GradientCard>

      <SectionTitle>Достижения · {ach.filter((a) => a.done).length}/{ach.length}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {ach.map((a) => (
          <View key={a.id} style={{ width: '30.5%', backgroundColor: a.done ? '#13302A' : C.card, borderRadius: 16, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: a.done ? '#1F5A4C' : C.line, opacity: a.done ? 1 : 0.5 }}>
            <T style={{ fontSize: 26 }}>{a.done ? a.emoji : '🔒'}</T>
            <T style={{ fontSize: 11, textAlign: 'center', marginTop: 4, color: a.done ? C.text : C.sub }}>{a.title}</T>
          </View>
        ))}
      </View>

      <Btn title="🤖 Отчёт для ИИ-советника" kind="gold" onPress={() => go('report')} style={{ marginTop: 20 }} />
    </Screen>
  );
}

function Mini({ label, value, red }: { label: string; value: number; red?: boolean }) {
  return (
    <View>
      <T style={{ fontSize: 11, color: C.sub }}>{label}</T>
      <T style={{ fontWeight: '700', color: red ? C.red : C.text }}>{fmtShort(value)}</T>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View>
      <T style={{ fontSize: 12, color: C.sub }}>{label}</T>
      <T style={{ fontSize: 18, fontWeight: '800', color }}>{fmtShort(value)}</T>
    </View>
  );
}

function MonthsChart() {
  const state = useStore();
  const st = snapshot();
  const keys = lastMonthKeys(6);
  const data = keys.map((k) => summarizeMonth(st, k));
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expenses + d.saved)));
  const H = 90;
  if (data.every((d) => d.income === 0 && d.expenses === 0)) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', height: H }}>
        {data.map((d) => (
          <Svg key={d.key} width={36} height={H}>
            <Rect x={2} y={H - (d.income / max) * H} width={14} height={(d.income / max) * H} rx={4} fill={C.green} />
            <Rect x={19} y={H - ((d.expenses + d.saved) / max) * H} width={14} height={(d.expenses / max) * H} rx={4} fill={C.red} opacity={0.85} />
            <Rect x={19} y={H - (d.saved / max) * H} width={14} height={(d.saved / max) * H} rx={4} fill={C.gold} />
          </Svg>
        ))}
      </Row>
      <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
        {keys.map((k) => <T key={k} style={{ width: 36, textAlign: 'center', fontSize: 11, color: C.sub }}>{MONTHS[Number(k.slice(5)) - 1]}</T>)}
      </Row>
      <Row style={{ gap: 14, marginTop: 8 }}>
        <Legend color={C.green} label="доход" /><Legend color={C.red} label="расходы" /><Legend color={C.gold} label="отложено" />
      </Row>
    </View>
  );
}

const Legend = ({ color, label }: { color: string; label: string }) => (
  <Row style={{ gap: 5 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} /><T style={{ fontSize: 11, color: C.sub }}>{label}</T></Row>
);

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100; const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
