import type { AppState, TxKind } from './types';

/**
 * Bank SMS in Uzbekistan come in Russian, Uzbek (latin/cyrillic) and English.
 * We look for an amount with a currency and decide the direction by keywords.
 * Anything unclear goes to the review queue instead of being guessed.
 */

const INCOME_WORDS = [
  'popolnen', 'пополнен', 'zachislen', 'зачислен', 'postuplen', 'поступлен', 'kirim', 'кирим',
  "hisobga tushdi", 'tushdi', 'тушди', 'received', 'credited', 'credit', 'vozvrat', 'возврат',
  'perevod na kartu', 'перевод на карту', "o'tkazma qabul", 'qabul qilindi', 'cashback', 'кэшбэк',
];
const EXPENSE_WORDS = [
  'pokupka', 'покупка', 'oplata', 'оплата', 'spisan', 'списан', 'snyat', 'снят', 'chiqim', 'чиқим',
  "to'lov", 'tolov', 'тўлов', 'xarid', 'харид', 'debit', 'purchase', 'payment', 'perevod s karty',
  'перевод с карты', 'otkazma', "o'tkazma", 'ўтказма', 'yechildi', 'ечилди', 'withdraw', 'nalichn',
];
const IGNORE_RE = /\b(kod|код|code|parol|пароль|otp|tasdiqlash)\b|подтвержд|не сообщайте|hech kimga|\botkaz\b|отказ|otklonen|отклонен|rad etildi|nedostatochno|недостаточно|insufficient/i;
const STRONG_EXPENSE = ['pokupka', 'покупка', 'oplata', 'оплата', 'spisan', 'списан', 'xarid', 'харид', 'purchase', 'snyat', 'снят'];

const AMOUNT_RE = /(\d{1,3}(?:[  .,]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(uzs|sum|so'm|so‘m|сум|сўм|usd|\$)/i;
const BALANCE_RE = /(balans|баланс|ostatok|остаток|qoldiq|қолдиқ|dostupno|доступно|available)[^\d]{0,15}(\d{1,3}(?:[  .,]\d{3})+|\d+)(?:[.,](\d{1,2}))?/i;
const CARD_RE = /(?:\*{1,4}|x{2,4}|karta[^\d]{0,4}|карта[^\d]{0,4}|card[^\d]{0,4})(\d{4})\b/i;

function toNumber(intPart: string, frac?: string): number {
  const clean = intPart.replace(/[  .,]/g, '');
  return parseFloat(clean + (frac ? '.' + frac : ''));
}

export interface ParsedSms {
  amount: number;
  currency: 'UZS' | 'USD';
  kind: TxKind | null;
  merchant?: string;
  cardLast4?: string;
  balanceAfter?: number;
}

export function parseBankSms(body: string): ParsedSms | null {
  const text = body.replace(/\s+/g, ' ').trim();
  const low = text.toLowerCase();
  if (IGNORE_RE.test(text)) return null;

  // Remove the balance part before looking for the operation amount.
  const balMatch = text.match(BALANCE_RE);
  const withoutBalance = balMatch ? text.replace(balMatch[0], ' ') : text;
  const am = withoutBalance.match(AMOUNT_RE);
  if (!am) return null;
  const currency = /usd|\$/i.test(am[3]) ? 'USD' : 'UZS';
  const raw = toNumber(am[1], am[2]);
  const amount = currency === 'USD' ? raw : Math.round(raw);
  if (!amount || amount <= 0) return null;

  const isIncome = INCOME_WORDS.some((w) => low.includes(w));
  const isExpense = EXPENSE_WORDS.some((w) => low.includes(w));
  const strongExpense = STRONG_EXPENSE.some((w) => low.includes(w));
  const before = withoutBalance.slice(Math.max(0, (am.index ?? 0) - 2), am.index ?? 0);
  let kind: TxKind | null = null;
  if (/\+\s*$/.test(before)) kind = 'income';
  else if (/[-−]\s*$/.test(before)) kind = 'expense';
  else if (isIncome && !strongExpense) kind = 'income';
  else if (isExpense) kind = 'expense';

  const card = text.match(CARD_RE)?.[1];
  const balanceAfter = balMatch ? Math.round(toNumber(balMatch[2], balMatch[3])) : undefined;

  return { amount, currency, kind, merchant: extractMerchant(text), cardLast4: card, balanceAfter };
}

function extractMerchant(text: string): string | undefined {
  const patterns = [
    /(?:merchant|торговая точка|магазин|savdo nuqtasi|продавец)[:\s]+([^,;\n]+?)(?:[,;.]|\s{2}|$)/i,
    /(?:pokupka|покупка|oplata|оплата|xarid|to'lov)[:\s]+(?:[\d\s.,]+(?:uzs|sum|сум|so'm)\s*)?(?:v\s+|в\s+)?([A-ZА-ЯЁ0-9"'«][^,;\n]{2,40}?)(?:[,;]|\s+\d{2}[.:/]|\s+karta|\s+карта|\s+balans|\s+баланс|$)/i,
    /\b(?:v|в)\s+([A-ZА-ЯЁ0-9"'«][^,;\n]{2,40}?)(?:[,;]|\s+\d{2}[.:/]|$)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const v = m[1].replace(/["«»]/g, '').trim();
      if (v && !/^\d/.test(v) && v.length >= 2) return v.slice(0, 40);
    }
  }
  return undefined;
}

const MERCHANT_HINTS: [RegExp, string][] = [
  [/korzinka|makro|havas|carrefour|baraka|magnum|bi1|supermarket|market|oziq|продукт/i, 'exp_food'],
  [/yandex.?go|uber|taxi|такси|mytaxi|metro|bus|avtobus/i, 'exp_transport'],
  [/azs|gaz|metan|propan|benzin|uzbekneftegaz|lukoil|fuel/i, 'exp_fuel'],
  [/apteka|аптека|dori|clinic|klinika|med/i, 'exp_health'],
  [/cafe|кафе|kafe|restoran|ресторан|evos|kfc|oqtepa|bellissimo|les ailes|coffee|кофе|burger|pizza|chopar|max way/i, 'exp_cafe'],
  [/uzmobile|beeline|ucell|mobiuz|humans|uztelecom|sarkor|turon|comnet|internet/i, 'exp_mobile'],
  [/hududgaz|elektr|энерг|suv|вода|issiqlik|kommunal|коммун|toza hudud|ijara|аренд/i, 'exp_housing'],
  [/soliq|налог|tax|my\.gov|davlat xizmat/i, 'exp_taxes'],
  [/kredit|кредит|nasiya|рассроч|loan/i, 'exp_loans'],
  [/universitet|университет|kontrakt|контракт|edu|ta'lim|school|курс/i, 'exp_education'],
  [/netflix|spotify|youtube|apple|google|icloud|openai|anthropic|claude|steam|subscription/i, 'exp_subs'],
  [/uzum|wildberries|ozon|aliexpress|zara|mediapark|texnomart|shop|магазин/i, 'exp_shopping'],
];

export function suggestCategory(state: AppState, kind: TxKind, merchant: string | undefined, body: string): string {
  if (merchant) {
    const known = state.merchantMap[merchant.toLowerCase()];
    if (known) return known;
  }
  if (kind === 'income') {
    if (/perevod|перевод|o'tkazma|p2p/i.test(body)) return 'inc_transfer';
    return 'inc_other';
  }
  const hay = `${merchant ?? ''} ${body}`;
  for (const [re, cat] of MERCHANT_HINTS) if (re.test(hay)) return cat;
  if (/perevod|перевод|o'tkazma|p2p/i.test(body)) return 'exp_transfer';
  return 'exp_other';
}

export function isBankSender(state: AppState, sender: string): boolean {
  const s = sender.toUpperCase().replace(/\s/g, '');
  return state.settings.smsSenders.some((x) => s.includes(x.toUpperCase().replace(/\s/g, '')));
}

