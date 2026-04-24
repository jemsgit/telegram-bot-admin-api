import { NextFunction } from "express";
import { Context, Telegraf } from "telegraf";
import { Broadcast, User } from "./models";
import { TypedDB } from "./db";
import { Scenes } from "telegraf";
import { UserService } from "../services/user";
import { BroadcastService } from "../services/broadcast";
import { ReportService } from "../services/report";
import { PromocodeService } from "../services/promocode";
import { SubscriptionService } from "../services/subscriptions";
import { RefferService } from "../services/reffer";
import { PaymentService } from "../services/payment";
import { PostContentService } from "../services/postcontent";

export type {
  Broadcast,
  Payment,
  Promo,
  UserReport,
  Subscription,
  User,
  RefferalCount,
} from "./models";

export interface CustomRoute {
  method: "get" | "post" | "put" | "delete";
  path: string;
  handler: (
    req: Express.Request,
    res: Express.Response,
    next: NextFunction,
    bot: BotApp,
    db: TypedDB
  ) => Promise<void>;
}

export interface FeaturesConfig {
  broadcast?: boolean;
  subscriptions?: boolean;
  promocodes?: boolean;
  reports?: boolean;
  referral?: boolean;
  payments?: boolean;
  postcontentAd?: boolean;
}

export type Bot = Telegraf<any>;

export interface BotApp {
  bot: Bot;
  sendTestBroadcast: (b: Broadcast) => void;
  replyToUserReport: (userId: number, message: string, text: string) => void;
}

export interface AdminBotConfig {
  broadcast: boolean;
  subscriptions: boolean;
  promocodes: boolean;
  reports: boolean;
  referral: boolean;
  payments: boolean;
  postcontentAd: boolean;
}

// Сервисы
export interface AdminServices {
  userService: UserService;
  broadcastService: BroadcastService;
  reportService: ReportService;
  promocodeService: PromocodeService;
  subscriptionService: SubscriptionService;
  refferService: RefferService;
  paymentService: PaymentService;
  postContentService: PostContentService;
}

export interface AdminBotSessionData extends Scenes.SceneSessionData {
  admin: {
    foundUser?: User | null;
    waitingForPromoInput?: boolean;
    replyingToReport?: string | null;
  };
}

// Интерфейс для глобальной сессии пользователя
export interface SessionData {
  admin?: {
    foundUser?: User | null;
    searchResults?: User[];
    searchPage?: number;
    waitingForPromoInput?: boolean;
    replyingToReport?: string | null;
    promoCreateStep?:
      | "code"
      | "discount"
      | "price"
      | "description"
      | "dates"
      | "activeFrom"
      | "activeTo";
    promoDraft?: {
      code?: string;
      discountPercent?: number;
      price?: number;
      description?: string;
      activeFrom?: Date;
      activeTo?: Date;
      isActive?: boolean;
      segments?: string[];
    };
    promoList?: any[];
    promoPage?: number;
    broadcastDraft?: {
      title?: string;
      type?: "text" | "photo" | "video";
      text?: string;
      mediaUrl?: string;
      scheduledAt?: Date;
      excludePaid?: boolean;
      linkButtons?: Array<{ text: string; url: string }>;
    };
    broadcastStep?:
      | "title"
      | "type"
      | "text"
      | "mediaUrl"
      | "scheduledAt"
      | "schedule"
      | "excludePaid"
      | "linkButton";
    adCreateStep?:
      | "text"
      | "showFor"
      | "maxViews"
      | "priority"
      | "perUserLimit"
      | "dates"
      | "startsAt"
      | "endsAt"; // Добавили
    adDraft?: {
      // Добавили
      text?: string;
      isActive?: boolean;
      showFor?: Array<"image" | "video" | "audio" | "text" | "any">;
      maxViews?: number | null;
      priority?: number;
      perUserLimit?: number;
      startsAt?: string | null;
      endsAt?: string | null;
      selectingMultiple?: boolean;
    };
  };
}

export interface PostContentAd {
  _id: string;
  text: string;
  isActive: boolean;
  showFor: Array<"image" | "video" | "audio" | "text" | "any">;
  maxViews: number | null;
  views: number;
  priority: number;
  perUserLimit: number;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostContentAdView {
  _id: string;
  userId: string;
  adId: string; // ObjectId as string
  views: number;
  lastShownAt: Date | null;
}

export interface AdminBotSessionContext extends Context {
  session: SessionData;
}

export type AdminBotContext = AdminBotSessionContext & Scenes.SceneContext;
export type CustomScene = {
  buttonText?: string;
  name: string;
  scene: Scenes.BaseScene<AdminBotContext>;
};

export type { TypedDB } from "./db";
