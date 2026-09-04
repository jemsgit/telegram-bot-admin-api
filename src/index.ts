import { createAdmin } from "./createAdmin";
import { AdminServer } from "./AdminServer";
import { buildAdminServices } from "./services/buildServices";
import { MemorySessionStore } from "./adminBot/sessionStore";
import { createMemoryStore } from "./memoryStore";
import { BroadcastService } from "./services/broadcast";
import { PaymentService } from "./services/payment";
import { PromocodeService } from "./services/promocode";
import { RefferService } from "./services/reffer";
import { ReportService } from "./services/report";
import { SubscriptionService } from "./services/subscriptions";
import { UserService } from "./services/user";

export {
  createAdmin,
  createMemoryStore,
  buildAdminServices,
  MemorySessionStore,
  AdminServer,
  BroadcastService,
  PaymentService,
  PromocodeService,
  RefferService,
  ReportService,
  SubscriptionService,
  UserService,
};

export type { AdminHandle } from "./createAdmin";
export type { MemoryStoreSeed } from "./memoryStore";
export type {
  AdminConfig,
  HttpConfig,
  TelegramMenuConfig,
  CustomRouteWithUi,
  FeatureName,
  ResolvedFeatures,
} from "./config";
export {
  FEATURE_NAMES,
  DEFAULT_FEATURES,
  resolveFeatures,
  applyAdapterGating,
} from "./config";
export { STORE_CONTRACT, validateStore } from "./stores";
export { createConsoleLogger, setLogger, log } from "./logger";
export type { Logger, LogLevel } from "./logger";
export type {
  AdminStore,
  UserStore,
  SubscriptionStore,
  BroadcastStore,
  PromoStore,
  ReportStore,
  PaymentStore,
  ReferralStore,
  PostContentStore,
  UserStats,
  PaymentStats,
  IdLike,
} from "./stores";
export type {
  BroadcastScheduler,
  BroadcastAdapter,
  ReportsAdapter,
  AdminAdapters,
} from "./adapters";
export type { SessionStore } from "./adminBot/sessionStore";
export { HttpError } from "./http/http";
export type { RouteDef, RouteContext, RouteHandler } from "./http/http";
export {
  FEATURE_MODULES,
  selectEnabledFeatures,
  buildMenuEntries,
} from "./features";
export type { FeatureModule, MenuEntry } from "./features";

export type {
  FeaturesConfig,
  CustomRoute,
  AdminBotContext,
  AdminBotSessionContext,
  SessionData,
  AdminServices,
  CustomScene,
  PostContentAd,
  PostContentAdView,
  AdminUser,
  UserSubscription,
  UserId,
  Broadcast,
  Payment,
  Promo,
  UserReport,
  Subscription,
  RefferalCount,
} from "./types";
