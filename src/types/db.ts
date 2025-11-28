import type {
  Broadcast,
  Payment,
  Promo,
  UserReport,
  Subscription,
  User,
} from "./models";

export interface TypedDB {
  // Broadcast methods
  getAllBroadcasts: (status?: string | null) => Promise<Broadcast[]>;
  getBroadcast: (id: string) => Promise<Broadcast | null>;
  saveBroadcast: (broadcast: Broadcast) => Promise<void>;
  deleteBroadcast: (id: string) => Promise<boolean>;

  // Payment methods
  getPaymentsStats: () => Promise<{
    currentMonth: {
      totalAmount: number;
      totalIncomeAmount: number;
      count: number;
    };
    lastMonth: {
      totalAmount: number;
      totalIncomeAmount: number;
      count: number;
    };
  }>;
  getAllPayments: () => Promise<Payment[]>;

  // Promo methods
  createPromoCode: (
    data: Omit<Promo, "isActive"> & { isActive?: boolean }
  ) => Promise<Promo>;
  deletePromocode: (code: string) => Promise<boolean>;
  getAllPromoCodes: () => Promise<Promo[]>;

  // Report methods
  getReports: () => Promise<UserReport[]>;
  getReportById: (reportId: string) => Promise<UserReport | null>;
  saveReportReply: (
    reportId: string,
    author: string,
    text: string
  ) => Promise<void>;

  // Subscription methods
  getAllSubscriptions: () => Promise<Subscription[]>;

  // User methods
  findUsersByQuery: (query: string) => Promise<User[]>;
  findUserById: (userId: string | number) => Promise<User | null>;
  getUsers: () => Promise<User[]>;
  extendSubscription: (
    userId: string | number,
    days: number
  ) => Promise<boolean>;
  activatePromoSubscription: (
    userId: string | number,
    data: { days: number }
  ) => Promise<boolean>;
  deleteSubscription: (userId: string | number) => Promise<boolean>;
  getUserReports: (userId: string | number) => Promise<UserReport[]>;
  addPromoCodeToUser: (
    userId: string | number,
    promoCode: string
  ) => Promise<boolean>;
  getUserStats: () => Promise<any>;

  // Referral methods
  getRefferals: () => Promise<any[]>;
  countRefferalsByRefLink: (link: string) => Promise<any>;
}
