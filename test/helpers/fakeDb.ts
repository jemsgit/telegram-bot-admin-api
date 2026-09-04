import type { AdminStore } from "../../src/stores";

/** Минимальный in-memory AdminStore для тестов. Возвращает пустые коллекции. */
export function makeFakeDb(overrides: Partial<AdminStore> = {}): AdminStore {
  const base: AdminStore = {
    getAllBroadcasts: async () => [],
    getBroadcast: async () => null,
    saveBroadcast: async () => {},
    deleteBroadcast: async () => true,

    getPaymentsStats: async () => ({
      currentMonth: { totalAmount: 0, totalIncomeAmount: 0, count: 0 },
      lastMonth: { totalAmount: 0, totalIncomeAmount: 0, count: 0 },
    }),
    getAllPayments: async () => [],

    createPromoCode: async (data) => ({
      ...data,
      isActive: data.isActive ?? true,
    }),
    deletePromocode: async () => true,
    getAllPromoCodes: async () => [],

    getReports: async () => [],
    getReportById: async () => null,
    saveReportReply: async () => {},

    getAllSubscriptions: async () => [],

    findUsersByQuery: async () => [],
    findUserById: async () => null,
    getUsers: async () => [],
    extendSubscription: async () => true,
    activatePromoSubscription: async () => true,
    deleteSubscription: async () => true,
    getUserReports: async () => [],
    addPromoCodeToUser: async () => true,
    getUserStats: async () => ({}),

    getRefferals: async () => [],
    countRefferalsByRefLink: async () => 0,

    getAds: async () => [],
    getAdById: async () => null,
    createAd: async (data) => data,
    updateAd: async () => null,
    deleteAd: async () => true,
    addAdViewToUser: async () => ({
      _id: "v1",
      userId: "1",
      adId: "1",
      views: 1,
      lastShownAt: null,
    }),
    getAdForUser: async () => null,
  };
  return { ...base, ...overrides };
}
