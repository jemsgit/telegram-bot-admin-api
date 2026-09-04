import type { PostContentAd, PostContentAdView } from "./types";
import type {
  Broadcast,
  Payment,
  Promo,
  UserReport,
  Subscription,
  AdminUser,
  RefferalCount,
} from "./types/models";

export type IdLike = string | number;

/** Свободная форма статистики — конкретный набор полей определяет бот. */
export type UserStats = Record<string, unknown>;

export interface PaymentStats {
  currentMonth: {
    totalAmount: number;
    totalIncomeAmount: number;
    count: number;
  };
  lastMonth: { totalAmount: number; totalIncomeAmount: number; count: number };
}

/** Пользователи и статистика — всегда обязателен. */
export interface UserStore {
  findUsersByQuery(query: string): Promise<AdminUser[]>;
  findUserById(userId: IdLike): Promise<AdminUser | null>;
  getUsers(): Promise<AdminUser[]>;
  getUserStats(): Promise<UserStats>;
}

/** Фича `subscriptions`. */
export interface SubscriptionStore {
  getAllSubscriptions(): Promise<Subscription[]>;
  extendSubscription(userId: IdLike, days: number): Promise<boolean>;
  activatePromoSubscription(
    userId: IdLike,
    data: { days: number },
  ): Promise<boolean>;
  deleteSubscription(userId: IdLike): Promise<boolean>;
}

/** Фича `broadcast`. */
export interface BroadcastStore {
  getAllBroadcasts(status?: string | null): Promise<Broadcast[]>;
  getBroadcast(id: string): Promise<Broadcast | null>;
  saveBroadcast(broadcast: Broadcast): Promise<void>;
  deleteBroadcast(id: string): Promise<boolean>;
}

/** Фича `promocodes`. */
export interface PromoStore {
  createPromoCode(
    data: Omit<Promo, "isActive"> & { isActive?: boolean },
  ): Promise<Promo>;
  deletePromocode(code: string): Promise<boolean>;
  getAllPromoCodes(): Promise<Promo[]>;
  addPromoCodeToUser(userId: IdLike, promoCode: string): Promise<boolean>;
}

/** Фича `reports`. */
export interface ReportStore {
  getReports(): Promise<UserReport[]>;
  getReportById(reportId: string): Promise<UserReport | null>;
  saveReportReply(
    reportId: string,
    author: string,
    text: string,
  ): Promise<void>;
  getUserReports(userId: IdLike): Promise<UserReport[]>;
}

/** Фича `payments`. */
export interface PaymentStore {
  getAllPayments(): Promise<Payment[]>;
  getPaymentsStats(): Promise<PaymentStats>;
}

/** Фича `referral`. */
export interface ReferralStore {
  getRefferals(): Promise<RefferalCount[]>;
  countRefferalsByRefLink(link: string): Promise<RefferalCount | number>;
}

/** Фича `postcontentAd`. Методы `getAdForUser` / `addAdViewToUser` — для рантайма бота. */
export interface PostContentStore {
  getAds(filter?: Partial<PostContentAd>): Promise<PostContentAd[]>;
  getAdById(id: string): Promise<PostContentAd | null>;
  createAd(data: PostContentAd): Promise<PostContentAd>;
  updateAd(
    id: string,
    data: Partial<PostContentAd>,
  ): Promise<PostContentAd | null>;
  deleteAd(id: string): Promise<boolean>;
  addAdViewToUser(userId: string, adId: string): Promise<PostContentAdView>;
  getAdForUser(
    userId: string,
    type: "image" | "video" | "audio" | "text" | "any",
  ): Promise<PostContentAd | null>;
}

/**
 * То, что модуль реально принимает: `UserStore` обязателен, остальное —
 * по включённым фичам (проверяется на старте `validateStore`).
 */
export type AdminStore = UserStore &
  Partial<
    SubscriptionStore &
      BroadcastStore &
      PromoStore &
      ReportStore &
      PaymentStore &
      ReferralStore &
      PostContentStore
  >;

/** Методы, которые обязан реализовать стор для каждой фичи. */
export const STORE_CONTRACT = {
  users: ["findUsersByQuery", "findUserById", "getUsers", "getUserStats"],
  subscriptions: [
    "getAllSubscriptions",
    "extendSubscription",
    "activatePromoSubscription",
    "deleteSubscription",
  ],
  broadcast: [
    "getAllBroadcasts",
    "getBroadcast",
    "saveBroadcast",
    "deleteBroadcast",
  ],
  promocodes: [
    "createPromoCode",
    "deletePromocode",
    "getAllPromoCodes",
    "addPromoCodeToUser",
  ],
  reports: ["getReports", "getReportById", "saveReportReply", "getUserReports"],
  payments: ["getAllPayments", "getPaymentsStats"],
  referral: ["getRefferals", "countRefferalsByRefLink"],
  postcontentAd: ["getAds", "getAdById", "createAd", "updateAd", "deleteAd"],
} as const satisfies Record<string, readonly string[]>;

export type StoreContractKey = keyof typeof STORE_CONTRACT;

/**
 * Проверяет, что стор реализует методы для всех включённых фич.
 * Бросает с полным списком недостающих методов.
 */
export function validateStore(
  db: object,
  enabledFeatures: Partial<Record<string, boolean>>,
): void {
  const bag = db as Record<string, unknown>;
  const missing: string[] = [];
  const check = (key: StoreContractKey) => {
    for (const method of STORE_CONTRACT[key]) {
      if (typeof bag[method] !== "function") missing.push(`${key}.${method}`);
    }
  };

  check("users");
  for (const key of Object.keys(STORE_CONTRACT) as StoreContractKey[]) {
    if (key === "users") continue;
    if (enabledFeatures[key]) check(key);
  }

  if (missing.length) {
    throw new Error(
      `telegraf-admin-for-bots: в переданном db не реализованы методы:\n  - ${missing.join(
        "\n  - ",
      )}\nЛибо реализуйте их, либо отключите соответствующие фичи в features.`,
    );
  }
}
