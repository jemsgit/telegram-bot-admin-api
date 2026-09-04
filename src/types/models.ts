export interface Broadcast {
  id: string;
  title: string;
  type: "text" | "photo" | "video";
  text: string;
  mediaUrl?: string;
  scheduledAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
  status: "pending" | "done" | "progress" | "cancelled";
  excludePaid: boolean;
  sentUsers: string[];
  linkButtons: Array<{ text: string; url: string }>;
}

export interface Payment {
  chatId: string;
  username: string;
  chargeId: string;
  amount: number;
  incomeAmount: number;
  currency: string;
  date: Date;
}

export interface Promo {
  code: string;
  description?: string;
  discountPercent: number;
  price?: number;
  activeFrom: Date;
  activeTo: Date;
  isActive: boolean;
  segments: string[];
}

export interface RefferalCount {
  refLink: string;
  count: number;
}

export interface UserReport {
  userId: number;
  message: string;
  adminReply: string;
  done: boolean;
  _id: string;
}

export type UserId = number | string;

/**
 * Подписка пользователя в нейтральных терминах. Конкретный бот маппит
 * свою модель в эту форму.
 */
export interface UserSubscription {
  /** До какого момента подписка активна. */
  activeUntil?: Date | null;
  /** Пробная/демо-подписка. */
  isTrial?: boolean;
  /** Пробный период уже был использован. */
  trialUsed?: boolean;
}

/**
 * Пользователь в терминах админки. Всё бот-специфичное — в `extra`.
 *
 * @typeParam Extra форма поля `extra` конкретного бота
 */
export interface AdminUser<Extra = Record<string, unknown>> {
  userId: UserId;
  username?: string;
  firstName?: string;
  lastName?: string;
  createdAt?: Date;
  active?: boolean;
  /** Текущий промокод пользователя (фича `promocodes`). */
  promoCode?: string;
  /** Заполняется при включённой фиче `subscriptions`. */
  subscription?: UserSubscription | null;
  /** Произвольные поля конкретного бота. */
  extra?: Extra;
}

/**
 * @deprecated Используйте `AdminUser`. Список подписок отдаёт `SubscriptionStore`.
 */
export interface Subscription {
  userId: number;
  subscriptionToDate?: Date;
  demoUsed: boolean;
  isDemoSubscription: boolean;
}

/**
 * @deprecated Используйте `AdminUser`. Тип оставлен для обратной совместимости
 * и включает бывшие бот-специфичные поля astro-bot.
 */
export type User = AdminUser & {
  name?: string;
  zodiak?: string;
  localTimeShift?: number;
  notificationTime?: number;
  bithdate?: Date;
  demoUsed?: boolean;
  refLink?: string;
};
