import { NextFunction, RequestHandler } from "express";
import { Context, Telegraf } from "telegraf";
import type { UserId } from "./models";
import type { AdminStore } from "../stores";
import type { ResolvedFeatures } from "../config";
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
  AdminUser,
  UserSubscription,
  UserId,
  RefferalCount,
} from "./models";

export interface CustomRoute {
  method: "get" | "post" | "put" | "delete" | "patch";
  /**
   * Путь роута. Монтируется под `/api` и под `apiAuth` — `/api/` в начале можно
   * писать или опускать: `/api/users/:id/rights` и `users/:id/rights`
   * эквивалентны.
   */
  path: string;
  /** Express-миддлвары до хендлера (валидация тела/параметров и т.п.). */
  validate?: RequestHandler | RequestHandler[];
  handler: (
    req: Express.Request,
    res: Express.Response,
    next: NextFunction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bot: Telegraf<any>,
    db: AdminStore,
  ) => Promise<void> | void;
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

/** Флаги фич в разрешённом виде — то, что видят сцены. */
export type AdminBotConfig = ResolvedFeatures;

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

// Интерфейс для глобальной сессии пользователя.
// NB: это ручной union всех полей визардов. Кандидат на переезд на
// `Scenes.WizardScene` / per-scene `scene.state` (см. REFACTORING.md E10).
export interface SessionData {
  admin?: {
    /** «Текущий» пользователь — только id, объект перечитываем из стора. */
    foundUserId?: UserId | null;
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
