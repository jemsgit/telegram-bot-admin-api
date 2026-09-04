import type { AdminStore, PaymentStats } from "./stores";
import type {
  AdminUser,
  Broadcast,
  Payment,
  Promo,
  UserReport,
  Subscription,
  RefferalCount,
  PostContentAd,
  PostContentAdView,
} from "./types";

export interface MemoryStoreSeed {
  users?: AdminUser[];
  broadcasts?: Broadcast[];
  promocodes?: Promo[];
  reports?: UserReport[];
  subscriptions?: Subscription[];
  payments?: Payment[];
  referrals?: RefferalCount[];
  ads?: PostContentAd[];
}

/**
 * In-memory реализация всех сторов. Для прототипов, тестов и как эталон формы.
 * Не персистит.
 */
export function createMemoryStore(seed: MemoryStoreSeed = {}): AdminStore {
  const users = new Map<string, AdminUser>(
    (seed.users ?? []).map((u) => [String(u.userId), u]),
  );
  const broadcasts = new Map<string, Broadcast>(
    (seed.broadcasts ?? []).map((b) => [b.id, b]),
  );
  const promos = new Map<string, Promo>(
    (seed.promocodes ?? []).map((p) => [p.code, p]),
  );
  const reports = [...(seed.reports ?? [])];
  const subscriptions = [...(seed.subscriptions ?? [])];
  const payments = [...(seed.payments ?? [])];
  const referrals = [...(seed.referrals ?? [])];
  const ads = new Map<string, PostContentAd>(
    (seed.ads ?? []).map((a) => [a._id, a]),
  );
  const adViews: PostContentAdView[] = [];

  const emptyPaymentStats = (): PaymentStats => ({
    currentMonth: { totalAmount: 0, totalIncomeAmount: 0, count: 0 },
    lastMonth: { totalAmount: 0, totalIncomeAmount: 0, count: 0 },
  });

  return {
    // users
    async findUsersByQuery(q) {
      const needle = q.toLowerCase();
      return [...users.values()].filter(
        (u) =>
          String(u.userId) === q ||
          u.username?.toLowerCase().includes(needle) ||
          u.firstName?.toLowerCase().includes(needle) ||
          u.lastName?.toLowerCase().includes(needle),
      );
    },
    async findUserById(id) {
      return users.get(String(id)) ?? null;
    },
    async getUsers() {
      return [...users.values()];
    },
    async getUserStats() {
      return {
        totalUsers: users.size,
        activeUsers: [...users.values()].filter((u) => u.active).length,
      };
    },

    // subscriptions
    async getAllSubscriptions() {
      return [...subscriptions];
    },
    async extendSubscription(userId, days) {
      const u = users.get(String(userId));
      if (!u) return false;
      const base = u.subscription?.activeUntil
        ? new Date(u.subscription.activeUntil)
        : new Date();
      base.setDate(base.getDate() + days);
      u.subscription = { ...u.subscription, activeUntil: base };
      return true;
    },
    async activatePromoSubscription(userId, data) {
      const u = users.get(String(userId));
      if (!u) return false;
      const until = new Date();
      until.setDate(until.getDate() + data.days);
      u.subscription = { activeUntil: until, isTrial: true, trialUsed: true };
      return true;
    },
    async deleteSubscription(userId) {
      const u = users.get(String(userId));
      if (!u) return false;
      u.subscription = null;
      return true;
    },

    // broadcasts
    async getAllBroadcasts(status) {
      const all = [...broadcasts.values()];
      return status ? all.filter((b) => b.status === status) : all;
    },
    async getBroadcast(id) {
      return broadcasts.get(id) ?? null;
    },
    async saveBroadcast(b) {
      broadcasts.set(b.id, b);
    },
    async deleteBroadcast(id) {
      return broadcasts.delete(id);
    },

    // promocodes
    async createPromoCode(data) {
      const promo: Promo = {
        ...data,
        segments: data.segments ?? [],
        isActive: data.isActive ?? true,
      };
      promos.set(promo.code, promo);
      return promo;
    },
    async deletePromocode(code) {
      return promos.delete(code);
    },
    async getAllPromoCodes() {
      return [...promos.values()];
    },
    async addPromoCodeToUser(userId, promoCode) {
      const u = users.get(String(userId));
      if (!u) return false;
      u.promoCode = promoCode;
      return true;
    },

    // reports
    async getReports() {
      return [...reports];
    },
    async getReportById(id) {
      return reports.find((r) => r._id === id) ?? null;
    },
    async saveReportReply(reportId, _author, text) {
      const r = reports.find((x) => x._id === reportId);
      if (r) {
        r.adminReply = text;
        r.done = true;
      }
    },
    async getUserReports(userId) {
      return reports.filter((r) => String(r.userId) === String(userId));
    },

    // payments
    async getAllPayments() {
      return [...payments];
    },
    async getPaymentsStats() {
      return emptyPaymentStats();
    },

    // referral
    async getRefferals() {
      return [...referrals];
    },
    async countRefferalsByRefLink(link) {
      return referrals.find((r) => r.refLink === link) ?? 0;
    },

    // postcontent
    async getAds(filter) {
      let list = [...ads.values()];
      if (filter?.isActive !== undefined) {
        list = list.filter((a) => a.isActive === filter.isActive);
      }
      return list;
    },
    async getAdById(id) {
      return ads.get(id) ?? null;
    },
    async createAd(data) {
      const ad: PostContentAd = {
        ...data,
        _id: data._id || `ad_${ads.size + 1}`,
        views: data.views ?? 0,
      };
      ads.set(ad._id, ad);
      return ad;
    },
    async updateAd(id, data) {
      const ad = ads.get(id);
      if (!ad) return null;
      Object.assign(ad, data);
      return ad;
    },
    async deleteAd(id) {
      return ads.delete(id);
    },
    async addAdViewToUser(userId, adId) {
      let view = adViews.find((v) => v.userId === userId && v.adId === adId);
      if (!view) {
        view = {
          _id: `v${adViews.length + 1}`,
          userId,
          adId,
          views: 0,
          lastShownAt: null,
        };
        adViews.push(view);
      }
      view.views += 1;
      view.lastShownAt = new Date();
      return view;
    },
    async getAdForUser(_userId, type) {
      return (
        [...ads.values()].find(
          (a) =>
            a.isActive &&
            (a.showFor.includes(type) || a.showFor.includes("any")),
        ) ?? null
      );
    },
  };
}
