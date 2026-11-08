import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseAmount } from './calc';
import { useStore } from './store';
import type { Transaction, TxKind } from './types';
import { Btn, C, Chip, Row, s, success, T, tap } from './ui';

export function TxSheet({ visible, onClose, editing }: { visible: boolean; onClose: () => void; editing?: Transaction | null }) {
  const categories = useStore((x) => x.categories);
  const accounts = useStore((x) => x.accounts);
  const add = useStore((x) => x.addTransaction);
  const update = useStore((x) => x.updateTransaction);
  const remove = useStore((x) => x.removeTransaction);
  const insets = useSafeAreaInsets();

  const [kind, setKind] = useState<TxKind>('expense');
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('exp_food');
  const [acc, setAcc] = useState<string | undefined>();
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!visible) return;
    setErr('');
    if (editing) {
      setKind(editing.kind); setAmount(group(String(editing.amount))); setCat(editing.categoryId);
      setAcc(editing.accountId); setNote(editing.note ?? ''); setDate(editing.date.slice(0, 10));
    } else {
      setKind('expense'); setAmount(''); setCat('exp_food'); setAcc(accounts[0]?.id); setNote('');
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [visible]);

  const cats = categories.filter((c) => c.kind === kind);

  const save = () => {
    const n = parseAmount(amount);
    if (!Number.isFinite(n) || n <= 0) { setErr('Введи сумму'); return; }
    const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
    const keepTime = editing && editing.date.slice(0, 10) === d ? editing.date : new Date(`${d}T${new Date().toTimeString().slice(0, 8)}`).toISOString();
    const categoryId = cats.some((c) => c.id === cat) ? cat : cats[0].id;
    if (editing) update({ ...editing, kind, amount: n, categoryId, accountId: acc, note, date: keepTime });
    else add({ kind, amount: n, categoryId, accountId: acc, note, date: keepTime, source: 'manual' });
    success();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={s.grabber} />
          <Row style={{ gap: 8, marginBottom: 14 }}>
            {(['expense', 'income'] as TxKind[]).map((k) => (
              <Pressable key={k} onPress={() => { tap(); setKind(k); setCat(k === 'income' ? 'inc_business' : 'exp_food'); }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: kind === k ? (k === 'income' ? '#123A33' : '#3A1520') : C.card, borderWidth: 1, borderColor: kind === k ? (k === 'income' ? C.green : C.red) : C.line }}>
                <T style={{ fontWeight: '700', color: kind === k ? (k === 'income' ? C.green : C.red) : C.sub }}>{k === 'income' ? '＋ Доход' : '− Расход'}</T>
              </Pressable>
            ))}
          </Row>
          <TextInput
            autoFocus={!editing}
            value={amount}
            onChangeText={(x) => setAmount(/[кkмm]/i.test(x) ? x : group(x.replace(/[^\d]/g, '')))}
            placeholder="0"
            placeholderTextColor={C.dim}
            keyboardType="decimal-pad"
            style={{ color: kind === 'income' ? C.green : C.text, fontSize: 40, fontWeight: '800', textAlign: 'center', paddingVertical: 6 }}
          />
          <T style={{ color: C.sub, textAlign: 'center', marginBottom: 12 }}>сум · можно писать 300к или 1.5м</T>
          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {cats.map((c) => <Chip key={c.id} label={`${c.emoji} ${c.name}`} active={cat === c.id} onPress={() => setCat(c.id)} />)}
            </View>
            {accounts.length > 0 && (
              <>
                <T style={s.label}>Счёт</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  <Chip label="Без счёта" active={!acc} onPress={() => setAcc(undefined)} />
                  {accounts.map((a) => <Chip key={a.id} label={a.name} active={acc === a.id} onPress={() => setAcc(a.id)} />)}
                </View>
              </>
            )}
            <Row style={{ gap: 10, marginBottom: 12 }}>
              <TextInput value={note} onChangeText={setNote} placeholder="Комментарий" placeholderTextColor={C.dim} style={[s.input, { flex: 2 }]} />
              <TextInput value={date} onChangeText={setDate} placeholder="ГГГГ-ММ-ДД" placeholderTextColor={C.dim} style={[s.input, { flex: 1.3 }]} />
            </Row>
          </ScrollView>
          {!!err && <T style={{ color: C.red, marginBottom: 8 }}>{err}</T>}
          <Btn title={editing ? 'Сохранить' : 'Добавить'} onPress={save} />
          {editing && <Btn title="Удалить" kind="ghost" style={{ marginTop: 10 }} onPress={() => { remove(editing.id); onClose(); }} />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const group = (x: string) => x.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
