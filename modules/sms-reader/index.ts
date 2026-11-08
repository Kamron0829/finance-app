import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type RawSms = { id: string; address: string; body: string; date: number };

type Native = {
  hasPermission(): boolean;
  readInbox(sinceMs: number, limit: number): Promise<RawSms[]>;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('SmsReader') : null;

export const smsSupported = !!native;

export function hasSmsPermission(): boolean {
  return native ? native.hasPermission() : false;
}

export async function readInbox(sinceMs: number, limit = 300): Promise<RawSms[]> {
  if (!native) return [];
  return native.readInbox(sinceMs, limit);
}
