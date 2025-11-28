export interface Broadcast {
  id: string;
  title: string;
  type: "text" | "photo" | "video";
  text: string;
  mediaUrl?: string;
  scheduledAt?: Date;
  createdAt: Date;
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

export interface UserReport {
  userId: number;
  message: string;
  adminReply: string;
  done: boolean;
}

export interface Subscription {
  userId: number;
  subscriptionToDate?: Date;
  demoUsed: boolean;
  isDemoSubscription: boolean;
}

export interface User {
  userId: number;
  username?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  zodiak?: string;
  localTimeShift?: number;
  notificationTime?: number;
  bithdate?: Date;
  demoUsed: boolean;
  active: boolean;
  refLink?: string;
  createdAt: Date;
  promoCode?: string;
  subscription?: string;
}
