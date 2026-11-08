import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch,
  Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmt, parseAmount } from './calc';

export const C = {
  bg: '#0B0F14',
  bg2: '#11161D',
  card: '#151B23',
  card2: '#1B232D',
  line: '#232C38',
  text: '#F2F5F8',
  sub: '#8B97A7',
  dim: '#5B6676',
  green: '#2EE6A6',
  green2: '#14B8A6',
  gold: '#F5C451',
  gold2: '#F59E0B',
  red: '#FF5C7A',
  blue: '#5B8CFF',
  purple: '#A78BFA',
};

export const GOAL_COLORS = ['#2EE6A6', '#F5C451', '#5B8CFF', '#A78BFA', '#FF8A5B', '#FF5C7A', '#22D3EE'];

export const tap = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };
export const success = () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };

export function T({ style, children, ...p }: { style?: StyleProp<TextStyle>; children: React.ReactNode; numberOfLines?: number }) {
  return <Text style={[{ color: C.text, fontSize: 15 }, style]} {...p}>{children}</Text>;
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const body = <View style={[s.card, style]}>{children}</View>;
  if (!onPress) return body;
  return <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>{body}</Pressable>;
}

export function GradientCard({ children, colors = ['#123A33', '#0F1F2A'], style }: { children: React.ReactNode; colors?: [string, string, ...string[]]; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.card, { borderColor: '#1F4A41' }, style]}>
      {children}
    </LinearGradient>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={s.sectionRow}>
      <T style={s.section}>{children}</T>
      {right}
    </View>
  );
}

export function Btn({ title, onPress, kind = 'primary', small, style, disabled }: {
  title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'gold'; small?: boolean; style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  const colors: [string, string] = kind === 'gold' ? [C.gold, C.gold2] : kind === 'danger' ? ['#FF5C7A', '#E11D48'] : [C.green, C.green2];
  const inner = <T style={[s.btnText, kind === 'ghost' && { color: C.text }, small && { fontSize: 13 }]}>{title}</T>;
  return (
    <Pressable disabled={disabled} onPress={() => { tap(); onPress(); }} style={({ pressed }) => [{ opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }, style]}>
      {kind === 'ghost'
        ? <View style={[s.btn, small && s.btnSmall, { backgroundColor: C.card2, borderWidth: 1, borderColor: C.line }]}>{inner}</View>
        : <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.btn, small && s.btnSmall]}>{inner}</LinearGradient>}
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={[s.chip, active && { backgroundColor: '#163B33', borderColor: C.green }]}>
      <T style={{ fontSize: 13, color: active ? C.green : C.sub }}>{label}</T>
    </Pressable>
  );
}

/** Animated progress bar. */
export function Bar({ value, color = C.green, height = 8, track = C.line }: { value: number; color?: string; height?: number; track?: string }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: Math.max(0, Math.min(1, value)), duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value]);
  return (
    <View style={{ height, backgroundColor: track, borderRadius: height, overflow: 'hidden' }}>
      <Animated.View style={{ height, borderRadius: height, backgroundColor: color, width: a.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Animated ring (goal progress / health score). */
export function Ring({ value, size = 120, stroke = 12, colors = [C.green, C.gold], children, track = C.line }: {
  value: number; size?: number; stroke?: number; colors?: [string, string]; children?: React.ReactNode; track?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const a = useRef(new Animated.Value(0)).current;
  const id = useRef('g' + Math.random().toString(36).slice(2, 8)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: Math.max(0, Math.min(1, value)), duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGrad id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </SvgGrad>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r} stroke={`url(#${id})`} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={a.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] })}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Number that counts up when it changes. */
export function CountUp({ value, style, format = (n: number) => fmt(n) }: { value: number; style?: StyleProp<TextStyle>; format?: (n: number) => string }) {
  const [shown, setShown] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current; const to = value; const start = Date.now(); const dur = 900;
    let raf: any;
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step); else prev.current = to;
    };
    step();
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <T style={style}>{format(shown)}</T>;
}

export function Empty({ emoji, title, text, action }: { emoji: string; title: string; text: string; action?: React.ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <T style={{ fontSize: 40 }}>{emoji}</T>
      <T style={{ fontSize: 17, fontWeight: '700', marginTop: 8 }}>{title}</T>
      <T style={{ color: C.sub, textAlign: 'center', marginTop: 6, marginBottom: action ? 14 : 0, lineHeight: 20 }}>{text}</T>
      {action}
    </Card>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

// ---------------- generic form sheet ----------------
export type Field =
  | { key: string; label: string; type: 'text'; placeholder?: string }
  | { key: string; label: string; type: 'amount'; placeholder?: string }
  | { key: string; label: string; type: 'number'; placeholder?: string }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[] }
  | { key: string; label: string; type: 'switch' };

export function FormSheet({ visible, title, fields, initial, onClose, onSave, onDelete, saveLabel = 'Сохранить' }: {
  visible: boolean; title: string; fields: Field[]; initial: Record<string, any>;
  onClose: () => void; onSave: (v: Record<string, any>) => void; onDelete?: () => void; saveLabel?: string;
}) {
  const [v, setV] = useState<Record<string, any>>(initial);
  const [err, setErr] = useState('');
  const insets = useSafeAreaInsets();
  useEffect(() => { if (visible) { setV(toEditable(fields, initial)); setErr(''); } }, [visible]);

  const save = () => {
    const out: Record<string, any> = { ...v };
    for (const f of fields) {
      if (f.type === 'amount') {
        const n = parseAmount(String(v[f.key] ?? ''));
        if (!Number.isFinite(n)) { setErr(`Проверь поле «${f.label}»`); return; }
        out[f.key] = n;
      } else if (f.type === 'number') {
        const n = parseFloat(String(v[f.key] ?? '').replace(',', '.'));
        if (!Number.isFinite(n)) { setErr(`Проверь поле «${f.label}»`); return; }
        out[f.key] = n;
      } else if (f.type === 'text' && f.key === 'name' && !String(v[f.key] ?? '').trim()) {
        setErr('Введи название'); return;
      }
    }
    success();
    onSave(out);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={s.grabber} />
          <T style={{ fontSize: 20, fontWeight: '800', marginBottom: 12 }}>{title}</T>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>
            {fields.map((f) => (
              <View key={f.key} style={{ marginBottom: 14 }}>
                {f.type !== 'switch' && <T style={s.label}>{f.label}</T>}
                {f.type === 'select' ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {f.options.map((o) => <Chip key={o.value} label={o.label} active={v[f.key] === o.value} onPress={() => setV({ ...v, [f.key]: o.value })} />)}
                  </View>
                ) : f.type === 'switch' ? (
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T>{f.label}</T>
                    <Switch value={!!v[f.key]} onValueChange={(x) => setV({ ...v, [f.key]: x })} trackColor={{ true: C.green2, false: C.line }} thumbColor="#fff" />
                  </Row>
                ) : (
                  <TextInput
                    style={[s.input, f.type === 'amount' && { fontSize: 22, fontWeight: '700' }]}
                    value={String(v[f.key] ?? '')}
                    onChangeText={(x) => setV({ ...v, [f.key]: f.type === 'amount' ? groupDigits(x) : x })}
                    placeholder={f.placeholder}
                    placeholderTextColor={C.dim}
                    keyboardType={f.type === 'text' ? 'default' : 'decimal-pad'}
                  />
                )}
              </View>
            ))}
          </ScrollView>
          {!!err && <T style={{ color: C.red, marginBottom: 8 }}>{err}</T>}
          <Btn title={saveLabel} onPress={save} />
          {onDelete && <Btn title="Удалить" kind="ghost" onPress={onDelete} style={{ marginTop: 10 }} />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function groupDigits(x: string) {
  if (/[кkмm]/i.test(x)) return x;
  const digits = x.replace(/[^\d]/g, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function toEditable(fields: Field[], initial: Record<string, any>) {
  const v: Record<string, any> = { ...initial };
  for (const f of fields) {
    if (f.type === 'amount' && typeof v[f.key] === 'number') v[f.key] = groupDigits(String(Math.round(v[f.key])));
    if (f.type === 'number' && typeof v[f.key] === 'number') v[f.key] = String(v[f.key]);
  }
  return v;
}

export function Screen({ children, title, subtitle, onBack, right }: { children: React.ReactNode; title?: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 140 }}>
      {(title || onBack) && (
        <Row style={{ marginBottom: 16, justifyContent: 'space-between' }}>
          <Row style={{ flex: 1 }}>
            {onBack && (
              <Pressable onPress={onBack} hitSlop={12} style={{ marginRight: 12 }}>
                <T style={{ fontSize: 26, color: C.sub }}>‹</T>
              </Pressable>
            )}
            <View style={{ flex: 1 }}>
              {title && <T style={{ fontSize: 26, fontWeight: '800' }}>{title}</T>}
              {subtitle && <T style={{ color: C.sub, marginTop: 2 }}>{subtitle}</T>}
            </View>
          </Row>
          {right}
        </Row>
      )}
      {children}
    </ScrollView>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.line, marginBottom: 12 },
  section: { fontSize: 13, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 1 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 10 },
  btn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  btnText: { color: '#06231C', fontWeight: '800', fontSize: 16 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.card2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: C.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1, borderColor: C.line },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 14 },
  label: { color: C.sub, fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 16 },
  muted: { color: C.sub, fontSize: 13 },
});
