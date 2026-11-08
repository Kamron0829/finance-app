import { PermissionsAndroid, Platform } from 'react-native';
import { hasSmsPermission, readInbox, smsSupported, type RawSms } from '../modules/sms-reader';
import type { AppState, PendingSms } from './types';
import { isBankSender, parseBankSms, suggestCategory } from './smsParse';

export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || !smsSupported) return false;
  if (hasSmsPermission()) return true;
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
    title: 'Доступ к SMS от банков',
    message: 'Moliya читает только SMS от банков и платёжных систем, чтобы сама записывать доходы и расходы. Данные не покидают телефон.',
    buttonPositive: 'Разрешить',
    buttonNegative: 'Не сейчас',
  });
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

export { smsSupported };

/** Read new bank SMS and turn them into pending items. Returns how many were found. */
export async function scanSms(state: AppState): Promise<{ pending: PendingSms[]; seen: string[]; until: number }> {
  const now = Date.now();
  // First sync looks back 30 days so the current month gets filled in.
  const since = state.settings.lastSmsSync || now - 30 * 86400000;
  let raw: RawSms[] = [];
  try {
    raw = await readInbox(since - 60000, 500);
  } catch {
    return { pending: [], seen: [], until: state.settings.lastSmsSync };
  }
  const seenSet = new Set(state.seenSmsIds);
  const pending: PendingSms[] = [];
  const seen: string[] = [];
  for (const sms of raw) {
    if (seenSet.has(sms.id)) continue;
    seen.push(sms.id);
    if (!isBankSender(state, sms.address)) continue;
    const p = parseBankSms(sms.body);
    if (!p) continue;
    const amountUzs = Math.round(p.currency === 'USD' ? p.amount * state.settings.usdRate : p.amount);
    const kind = p.kind ?? 'expense';
    pending.push({
      smsId: sms.id,
      sender: sms.address,
      body: sms.body,
      date: new Date(sms.date).toISOString(),
      amount: amountUzs,
      kind,
      merchant: p.merchant,
      cardLast4: p.cardLast4,
      balanceAfter: p.balanceAfter,
      suggestedCategoryId: suggestCategory(state, kind, p.merchant, sms.body),
    });
  }
  return { pending, seen, until: now };
}
