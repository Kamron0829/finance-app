import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { fmt, fmtShort, goalPlan, healthScore, nextDueDate, streak, totals } from './calc';
import type { AppState } from './types';

// No internet/news server: daily content is a rotating library of motivation and
// practical money tips, mixed with the user's own numbers so it stays relevant.
export const MOTIVATION = [
  'Богатство строится не доходом, а разницей между доходом и расходами. Сегодня увеличь эту разницу хотя бы на 1%.',
  'Сначала заплати себе: переведи в цель до того, как начнёшь тратить.',
  'Каждые 100 000 сум, отложенные сегодня, работают на тебя годами. Не трать на то, что забудешь завтра.',
  'Деньги любят счёт. Внеси все сегодняшние траты, это займёт 30 секунд.',
  'Самые богатые люди думают о деньгах как о солдатах: каждый должен работать.',
  'Доход растёт от навыков. Что ты сегодня сделаешь, чтобы стоить дороже?',
  'Один лишний клиент в месяц для агентства может дать больше, чем год экономии на кофе.',
  'Подушка безопасности на 6 месяцев даёт свободу принимать смелые решения.',
  'Инфляция в Узбекистане съедает деньги под матрасом. Пусть свободные деньги лежат на депозите или работают.',
  'Не покупай машину в кредит раньше, чем у тебя есть подушка. Сначала фундамент, потом крыша.',
  'Проверь подписки: каждая забытая подписка тихо крадёт деньги каждый месяц.',
  'Твой бизнес — главный актив. Найди одну операцию, которую можно поднять в цене на 10%.',
  'Маленькие шаги каждый день сильнее больших рывков раз в год.',
  'Сравни ставки депозитов в 3 банках. Разница в 3-4% годовых на крупной сумме — это реальные деньги.',
  'Ни один миллионер не стал им, не зная своих цифр. Открой Finance App и посмотри на прогресс.',
  'Перед покупкой больше 500 000 сум подожди 48 часов. Если хочется так же сильно — бери.',
  'Долг с высокой ставкой — это инвестиция наоборот. Гаси самый дорогой первым.',
  'Твоя цель — не просто заработать, а сохранить и приумножить.',
  'Раздели доход сразу при получении: обязательное, цели, жизнь. Решение принято заранее, силы воли не нужно.',
  'Посчитай, сколько ты зарабатываешь в час. Делегируй всё, что стоит дешевле.',
  'Богатство — это то, что ты не видишь: деньги, которые не потрачены.',
  'Один процент лучше каждый день — это в 37 раз лучше через год.',
  'Налоги по бизнесу плати вовремя: штрафы — самые бесполезные расходы.',
  'Подумай, как твоя платформа может приносить деньги, пока ты спишь.',
  'Ставь цели в цифрах и датах. «Хочу машину» — мечта. «400 млн к декабрю 2027» — план.',
  'Отметь победу: даже маленький шаг к цели — это шаг.',
  'Не сравнивай свою главу 1 с чужой главой 20. Сравнивай себя с собой месяц назад.',
  'Каждая трата — это голос за ту жизнь, которую ты строишь.',
];

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily', {
      name: 'Ежедневная мотивация', importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync('bills', {
      name: 'Платежи', importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

function dailyBody(state: AppState, dayOffset: number): { title: string; body: string } {
  const idx = (Math.floor(Date.now() / 86400000) + dayOffset) % MOTIVATION.length;
  const quote = MOTIVATION[idx];
  const kind = dayOffset % 3;
  const g = [...state.goals].sort((a, b) => a.priority - b.priority)[0];
  if (kind === 1 && g) {
    const p = goalPlan(state, g);
    return {
      title: `${g.emoji} ${g.name}: ${Math.round(p.progress * 100)}%`,
      body: `Осталось ${fmtShort(p.remaining)} сум. Чтобы успеть, откладывай ${fmt(p.requiredMonthly)} в месяц. ${quote}`,
    };
  }
  if (kind === 2) {
    const t = totals(state);
    return {
      title: `💎 Капитал: ${fmtShort(t.netWorth)} сум · здоровье ${healthScore(state).total}/100`,
      body: quote,
    };
  }
  const s = streak(state.checkins);
  return { title: s > 1 ? `🔥 ${s} дней подряд! Не прерывай серию` : '☀️ Доброе утро, будущий миллионер', body: quote };
}

/** Re-plan the next 14 days of notifications. Call on app start and after data changes. */
export async function rescheduleAll(state: AppState) {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!state.settings.notificationsEnabled) return;
  const now = new Date();

  for (let i = 0; i < 14; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, state.settings.notifyHour, 0);
    if (at <= now) continue;
    const c = dailyBody(state, i);
    await Notifications.scheduleNotificationAsync({
      content: { title: c.title, body: c.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'daily' },
    });
  }

  // Evening check-in reminder to log the day's spending.
  for (let i = 0; i < 7; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 21, 0);
    if (at <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: '📝 Итоги дня', body: 'Проверь операции за сегодня и подтверди SMS от банков. 30 секунд, и цифры точные.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'daily' },
    });
  }

  // Bill reminders: 3 days before and on the due day.
  for (const b of state.bills) {
    const due = nextDueDate(b);
    for (const before of [3, 0]) {
      const at = new Date(due.getFullYear(), due.getMonth(), due.getDate() - before, 10, 0);
      if (at <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: before ? `⏰ Через ${before} дня: ${b.name}` : `❗ Сегодня оплатить: ${b.name}`,
          body: `${fmt(b.amount)}${b.autopay ? ' (автоплатёж, проверь баланс)' : ''}`,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'bills' },
      });
    }
  }
}
