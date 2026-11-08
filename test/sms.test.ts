// Run: npm run test:sms
import { parseBankSms } from '../src/smsParse';

type Exp = { amount: number; kind: 'income' | 'expense' | null; card?: string; balance?: number; merchant?: string } | null;
const cases: [string, Exp][] = [
  ['Pokupka: 125 000.00 UZS\nKORZINKA CHILONZOR\nKarta: *1234\n08.11.26 14:22\nBalans: 2 450 300.50 UZS', { amount: 125000, kind: 'expense', card: '1234', balance: 2450301, merchant: 'KORZINKA CHILONZOR' }],
  ['Oplata 45 000,00 UZS YANDEX GO karta ***5678 08.11.2026 Ostatok 1 200 000,00 UZS', { amount: 45000, kind: 'expense', card: '5678', balance: 1200000, merchant: 'YANDEX GO' }],
  ['Popolnenie scheta: +3 500 000.00 UZS. Karta *4321. Dostupno: 5 950 300.50 UZS', { amount: 3500000, kind: 'income', card: '4321' }],
  ['HUMOCARD *1234: tolov 89 000.00 UZS, EVOS MAX WAY. Qoldiq: 1 111 000.00 UZS', { amount: 89000, kind: 'expense', balance: 1111000 }],
  ['Kod podtverzhdeniya: 123456. Nikomu ne soobshayte', null],
  ['Списание 250 000 сум, карта *9988, магазин: MEDIAPARK. Баланс: 3 000 000 сум', { amount: 250000, kind: 'expense', card: '9988', merchant: 'MEDIAPARK' }],
  ["Hisobga tushdi: 1 000 000 so'm. Karta *7777. Balans: 4 000 000 so'm", { amount: 1000000, kind: 'income', balance: 4000000 }],
  ["O'tkazma: 300 000 UZS karta *1111 ga. Qoldiq 700 000 UZS", { amount: 300000, kind: 'expense' }],
  ["O'tkazma qabul qilindi: 500 000 UZS karta *1111. Qoldiq 1 200 000 UZS", { amount: 500000, kind: 'income' }],
  ['Purchase 12.50 USD NETFLIX.COM card *2222 Available 900 000 UZS', { amount: 12.5, kind: 'expense', card: '2222' }],
  ['Операция отклонена: недостаточно средств. 90 000 сум', null],
];

let fail = 0;
for (const [body, exp] of cases) {
  const got = parseBankSms(body);
  const ok = exp === null ? got === null
    : !!got && got.amount === exp.amount && got.kind === exp.kind
      && (exp.card === undefined || got.cardLast4 === exp.card)
      && (exp.balance === undefined || got.balanceAfter === exp.balance)
      && (exp.merchant === undefined || got.merchant === exp.merchant);
  if (!ok) { fail++; console.log('FAIL', body, '\n  got', JSON.stringify(got), '\n  exp', JSON.stringify(exp)); }
}
console.log(`${cases.length - fail}/${cases.length} SMS cases passed`);
process.exit(fail ? 1 : 0);
