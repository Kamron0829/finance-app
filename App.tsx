import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState as RNAppState, BackHandler, Pressable, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { rescheduleAll, setupNotifications } from './src/notifications';
import { Goals } from './src/screens/Goals';
import { Home } from './src/screens/Home';
import { Accounts, Bills, Debts, Health, Investments, More } from './src/screens/Manage';
import { Report, Settings, SmsInbox } from './src/screens/Tools';
import { Transactions } from './src/screens/Transactions';
import { scanSms } from './src/sms';
import { snapshot, useStore } from './src/store';
import { TxSheet } from './src/TxSheet';
import { C, T, tap } from './src/ui';

type Tab = 'home' | 'tx' | 'goals' | 'more';
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'home', icon: '◉', label: 'Главная' },
  { id: 'tx', icon: '☰', label: 'Операции' },
  { id: 'goals', icon: '◎', label: 'Цели' },
  { id: 'more', icon: '⋯', label: 'Ещё' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const [tab, setTab] = useState<Tab>('home');
  const [page, setPage] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());
  const insets = useSafeAreaInsets();
  const syncingRef = useRef(false);

  useEffect(() => useStore.persist.onFinishHydration(() => setHydrated(true)), []);

  const syncSms = useCallback(async () => {
    const st = snapshot();
    if (!st.settings.smsEnabled || syncingRef.current) return;
    syncingRef.current = true; setSyncing(true);
    try {
      const r = await scanSms(st);
      useStore.getState().addPendingSms(r.pending, r.seen, r.until);
      if (useStore.getState().settings.smsAutoAdd) {
        for (const p of r.pending) useStore.getState().resolvePendingSms(p.smsId, true);
      }
    } finally {
      syncingRef.current = false; setSyncing(false);
    }
  }, []);

  const reschedule = useCallback(() => { rescheduleAll(snapshot()).catch(() => {}); }, []);

  // On start and whenever the app comes back to the foreground: check-in, read SMS, refresh notifications.
  useEffect(() => {
    if (!hydrated) return;
    const onActive = () => { useStore.getState().checkin(); syncSms(); reschedule(); };
    setupNotifications().then(onActive).catch(onActive);
    const sub = RNAppState.addEventListener('change', (s) => { if (s === 'active') onActive(); });
    return () => sub.remove();
  }, [hydrated]);

  // Reschedule bill reminders when bills or goals change.
  useEffect(() => useStore.subscribe((s, prev) => {
    if (s.bills !== prev.bills || s.goals !== prev.goals) reschedule();
  }), []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page) { setPage(null); return true; }
      if (tab !== 'home') { setTab('home'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [page, tab]);

  const go = (p: string) => {
    if (p === 'tx' || p === 'goals' || p === 'home' || p === 'more') { setPage(null); setTab(p); }
    else setPage(p);
  };
  const back = () => setPage(null);

  if (!hydrated) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  let content: React.ReactNode;
  switch (page) {
    case 'bills': content = <Bills onBack={back} />; break;
    case 'debts': content = <Debts onBack={back} />; break;
    case 'accounts': content = <Accounts onBack={back} />; break;
    case 'investments': content = <Investments onBack={back} />; break;
    case 'health': content = <Health onBack={back} />; break;
    case 'sms': content = <SmsInbox onBack={back} onSync={syncSms} syncing={syncing} />; break;
    case 'report': content = <Report onBack={back} />; break;
    case 'settings': content = <Settings onBack={back} onReschedule={reschedule} />; break;
    default:
      content = tab === 'home' ? <Home go={go} />
        : tab === 'tx' ? <Transactions onSync={syncSms} syncing={syncing} />
        : tab === 'goals' ? <Goals />
        : <More go={go} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {content}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 8, paddingTop: 8, backgroundColor: 'rgba(11,15,20,0.97)', borderTopWidth: 1, borderTopColor: C.line, flexDirection: 'row', alignItems: 'center' }}>
        {TABS.slice(0, 2).map((t) => <TabBtn key={t.id} t={t} active={!page && tab === t.id} onPress={() => go(t.id)} />)}
        <Pressable onPress={() => { tap(); setAdding(true); }} style={{ marginTop: -26 }}>
          <LinearGradient colors={[C.green, C.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: C.bg }}>
            <T style={{ fontSize: 30, fontWeight: '900', color: '#06231C', marginTop: -2 }}>＋</T>
          </LinearGradient>
        </Pressable>
        {TABS.slice(2).map((t) => <TabBtn key={t.id} t={t} active={!page && tab === t.id} onPress={() => go(t.id)} />)}
      </View>
      <TxSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

function TabBtn({ t, active, onPress }: { t: { icon: string; label: string }; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
      <T style={{ fontSize: 20, color: active ? C.green : C.dim }}>{t.icon}</T>
      <T style={{ fontSize: 11, color: active ? C.green : C.dim, marginTop: 2, fontWeight: active ? '700' : '400' }}>{t.label}</T>
    </Pressable>
  );
}
