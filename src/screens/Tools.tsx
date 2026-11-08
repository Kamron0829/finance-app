import React, { useMemo, useState } from 'react';
import { Alert, Platform, Switch, TextInput, View } from 'react-native';
import { fmt } from '../calc';
import { buildAiReport, copyAiReport, exportBackup, pickBackup, shareAiReport } from '../export';
import { requestSmsPermission, smsSupported } from '../sms';
import { DEFAULT_SENDERS, snapshot, useStore } from '../store';
import { Btn, C, Card, Chip, Empty, Row, s, Screen, success, T } from '../ui';

type Back = { onBack: () => void };

// ---------------- SMS inbox ----------------
export function SmsInbox({ onBack, onSync, syncing }: Back & { onSync: () => void; syncing: boolean }) {
  const st = useStore();
  const cats = st.categories;
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');

  const enable = async () => {
    if (!smsSupported) { setMsg('Чтение SMS работает только в установленном Android-приложении (APK).'); return; }
    const ok = await requestSmsPermission();
    if (ok) { st.updateSettings({ smsEnabled: true }); setMsg(''); setTimeout(onSync, 300); }
    else setMsg('Без разрешения на SMS автоучёт не работает. Можно включить позже в настройках Android → Приложения → Finance App → Разрешения.');
  };

  return (
    <Screen title="SMS от банков" onBack={onBack} right={st.settings.smsEnabled ? <Btn small kind="ghost" title={syncing ? 'Ищу…' : '↻ Проверить'} onPress={onSync} /> : undefined}>
      {!st.settings.smsEnabled ? (
        <Card>
          <T style={{ fontSize: 17, fontWeight: '800' }}>📩 Автоучёт по SMS</T>
          <T style={{ color: C.sub, marginTop: 8, lineHeight: 20 }}>
            Finance App прочитает SMS только от банков и платёжных систем (Uzcard, Humo, Click, Payme, Uzum, Kapitalbank и др.), найдёт сумму, магазин и баланс,
            и предложит записать операцию. Сначала подтягиваются SMS за последние 30 дней.{'\n\n'}
            Коды подтверждения и пароли игнорируются. Ничего не отправляется в интернет.
          </T>
          <Btn title="Разрешить доступ к SMS" onPress={enable} style={{ marginTop: 14 }} />
          {!!msg && <T style={{ color: C.gold, marginTop: 10 }}>{msg}</T>}
        </Card>
      ) : (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <T style={{ fontWeight: '700' }}>Добавлять без подтверждения</T>
                <T style={{ color: C.sub, fontSize: 12 }}>Если выключено, каждую операцию подтверждаешь сам</T>
              </View>
              <Switch value={st.settings.smsAutoAdd} onValueChange={(v) => st.updateSettings({ smsAutoAdd: v })} trackColor={{ true: C.green2, false: C.line }} thumbColor="#fff" />
            </Row>
            <T style={{ color: C.sub, fontSize: 12, marginTop: 10 }}>
              Последняя проверка: {st.settings.lastSmsSync ? new Date(st.settings.lastSmsSync).toLocaleString('ru-RU') : 'ещё не было'}
            </T>
          </Card>
          {st.pendingSms.length > 1 && (
            <Btn title={`✓ Принять все (${st.pendingSms.length})`} kind="ghost" onPress={() => { for (const p of st.pendingSms) st.resolvePendingSms(p.smsId, true, picked[p.smsId]); success(); }} style={{ marginBottom: 12 }} />
          )}
          {st.pendingSms.length === 0 && <Empty emoji="✅" title="Всё разобрано" text="Новые SMS от банков проверяются при каждом открытии приложения." />}
          {st.pendingSms.map((p) => {
            const options = cats.filter((c) => c.kind === p.kind);
            const sel = picked[p.smsId] ?? p.suggestedCategoryId;
            return (
              <Card key={p.smsId}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T style={{ color: C.sub, fontSize: 12 }}>{p.sender} · {new Date(p.date).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</T>
                  <T style={{ fontWeight: '900', fontSize: 18, color: p.kind === 'income' ? C.green : C.text }}>{p.kind === 'income' ? '+' : '−'}{fmt(p.amount)}</T>
                </Row>
                {p.merchant && <T style={{ fontWeight: '700', marginTop: 4 }}>{p.merchant}</T>}
                <T style={{ color: C.dim, fontSize: 12, marginTop: 6 }} numberOfLines={3}>{p.body}</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {options.map((c) => <Chip key={c.id} label={`${c.emoji} ${c.name}`} active={sel === c.id} onPress={() => setPicked({ ...picked, [p.smsId]: c.id })} />)}
                </View>
                <Row style={{ gap: 10, marginTop: 12 }}>
                  <Btn small title="Добавить" onPress={() => { st.resolvePendingSms(p.smsId, true, sel); success(); }} style={{ flex: 1 }} />
                  <Btn small kind="ghost" title="Пропустить" onPress={() => st.resolvePendingSms(p.smsId, false)} style={{ flex: 1 }} />
                </Row>
              </Card>
            );
          })}
          <SendersEditor />
        </>
      )}
    </Screen>
  );
}

function SendersEditor() {
  const st = useStore();
  const [v, setV] = useState('');
  return (
    <Card>
      <T style={{ fontWeight: '800' }}>Отправители, которые считаются банком</T>
      <T style={{ color: C.sub, fontSize: 12, marginTop: 4, marginBottom: 10 }}>Если SMS твоего банка не ловятся, добавь имя отправителя, как оно видно в SMS.</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {st.settings.smsSenders.map((x) => (
          <Chip key={x} label={`${x} ✕`} onPress={() => st.updateSettings({ smsSenders: st.settings.smsSenders.filter((y) => y !== x) })} />
        ))}
      </View>
      <Row style={{ gap: 8, marginTop: 10 }}>
        <TextInput value={v} onChangeText={setV} placeholder="Например: OCTO" placeholderTextColor={C.dim} style={[s.input, { flex: 1 }]} autoCapitalize="characters" />
        <Btn small title="＋" onPress={() => { if (v.trim()) st.updateSettings({ smsSenders: [...st.settings.smsSenders, v.trim().toUpperCase()] }); setV(''); }} />
      </Row>
      <Btn small kind="ghost" title="Сбросить список" onPress={() => st.updateSettings({ smsSenders: DEFAULT_SENDERS })} style={{ marginTop: 10 }} />
    </Card>
  );
}

// ---------------- AI report ----------------
export function Report({ onBack }: Back) {
  const state = useStore();
  const [q, setQ] = useState('');
  const [done, setDone] = useState('');
  const md = useMemo(() => buildAiReport(snapshot(), q), [state, q]);
  return (
    <Screen title="Отчёт для ИИ" subtitle="Все цифры и расчёты в одном файле" onBack={onBack}>
      <Card>
        <T style={{ lineHeight: 21 }}>
          1. Напиши вопрос (необязательно).{'\n'}2. Нажми «Поделиться файлом» или «Скопировать».{'\n'}3. Вставь в Claude, и он скажет, что делать, успеваешь ли ты к целям и где теряешь деньги.
        </T>
        <TextInput value={q} onChangeText={setQ} multiline placeholder="Например: смогу ли я купить Mercedes за 2 года?" placeholderTextColor={C.dim}
          style={[s.input, { marginTop: 12, minHeight: 70, textAlignVertical: 'top' }]} />
        <Btn title="📤 Поделиться файлом" kind="gold" onPress={async () => { await shareAiReport(q); setDone(''); }} style={{ marginTop: 12 }} />
        <Btn title="📋 Скопировать текст" kind="ghost" onPress={async () => { await copyAiReport(q); success(); setDone('Скопировано! Вставь в чат с Claude.'); }} style={{ marginTop: 10 }} />
        {!!done && <T style={{ color: C.green, marginTop: 10 }}>{done}</T>}
      </Card>
      <T style={{ color: C.sub, fontSize: 12, marginBottom: 8 }}>Предпросмотр ({md.length} символов):</T>
      <Card><T style={{ fontFamily: Platform.OS === 'android' ? 'monospace' : undefined, fontSize: 11, color: C.sub }}>{md.slice(0, 4000)}{md.length > 4000 ? '\n…' : ''}</T></Card>
    </Screen>
  );
}

// ---------------- Settings ----------------
export function Settings({ onBack, onReschedule }: Back & { onReschedule: () => void }) {
  const st = useStore();
  const [name, setName] = useState(st.settings.name);
  const [usd, setUsd] = useState(String(st.settings.usdRate));
  const [infl, setInfl] = useState(String(st.settings.inflation));
  const [msg, setMsg] = useState('');

  const save = () => {
    st.updateSettings({ name: name.trim() || 'Друг', usdRate: Number(usd.replace(/\s/g, '')) || st.settings.usdRate, inflation: Number(infl.replace(',', '.')) || st.settings.inflation });
    success(); setMsg('Сохранено'); onReschedule();
  };
  const confirm = (title: string, text: string, ok: () => void) => {
    if (Platform.OS === 'web') { if (window.confirm(`${title}\n${text}`)) ok(); return; }
    Alert.alert(title, text, [{ text: 'Отмена', style: 'cancel' }, { text: 'Да', style: 'destructive', onPress: ok }]);
  };

  return (
    <Screen title="Настройки" onBack={onBack}>
      <Card>
        <T style={s.label}>Как к тебе обращаться</T>
        <TextInput value={name} onChangeText={setName} style={s.input} />
        <T style={[s.label, { marginTop: 12 }]}>Курс USD/UZS</T>
        <TextInput value={usd} onChangeText={setUsd} style={s.input} keyboardType="decimal-pad" />
        <T style={[s.label, { marginTop: 12 }]}>Инфляция для расчёта целей, % в год</T>
        <TextInput value={infl} onChangeText={setInfl} style={s.input} keyboardType="decimal-pad" />
        <Btn title="Сохранить" onPress={save} style={{ marginTop: 14 }} />
        {!!msg && <T style={{ color: C.green, marginTop: 8 }}>{msg}</T>}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T style={{ fontWeight: '700' }}>Ежедневные уведомления</T>
          <Switch value={st.settings.notificationsEnabled} onValueChange={(v) => { st.updateSettings({ notificationsEnabled: v }); setTimeout(onReschedule, 50); }} trackColor={{ true: C.green2, false: C.line }} thumbColor="#fff" />
        </Row>
        <T style={[s.label, { marginTop: 12 }]}>Время утреннего уведомления</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[7, 8, 9, 10, 11, 12].map((h) => <Chip key={h} label={`${h}:00`} active={st.settings.notifyHour === h} onPress={() => { st.updateSettings({ notifyHour: h }); setTimeout(onReschedule, 50); }} />)}
        </View>
        <T style={{ color: C.sub, fontSize: 12, marginTop: 10, lineHeight: 18 }}>
          Утром: мотивация, прогресс целей и капитала. В 21:00: напоминание внести траты. Платежи: за 3 дня и в день оплаты.
        </T>
      </Card>

      <Card>
        <T style={{ fontWeight: '800', marginBottom: 6 }}>Резервная копия</T>
        <T style={{ color: C.sub, fontSize: 13, marginBottom: 12, lineHeight: 19 }}>Все данные хранятся только на этом телефоне. Сохраняй копию в Telegram «Избранное» или на Google Диск раз в неделю.</T>
        <Btn title="💾 Сохранить копию" kind="ghost" onPress={exportBackup} />
        <Btn title="📂 Восстановить из файла" kind="ghost" style={{ marginTop: 10 }} onPress={async () => {
          try {
            const data = await pickBackup();
            if (data) confirm('Восстановить?', 'Текущие данные будут заменены данными из файла.', () => { st.replaceAll(data); setMsg('Данные восстановлены'); });
          } catch (e: any) { setMsg(e?.message ?? 'Не удалось прочитать файл'); }
        }} />
      </Card>

      <Btn title="Удалить все данные" kind="danger" onPress={() => confirm('Удалить всё?', 'Это нельзя отменить. Сначала сохрани резервную копию.', () => st.resetAll())} style={{ marginTop: 8 }} />
      <T style={{ color: C.dim, fontSize: 12, textAlign: 'center', marginTop: 16 }}>Finance App 1.1 · данные только на устройстве</T>
    </Screen>
  );
}
