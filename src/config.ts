import type { Telegraf } from "telegraf";
import type { CustomRoute, CustomScene, FeaturesConfig } from "./types";
import type { AdminStore } from "./stores";
import type { SessionStore } from "./adminBot/sessionStore";
import type { AdminAdapters } from "./adapters";
import type { Logger, LogLevel } from "./logger";
import { log } from "./logger";

/**
 * Единый список фич. `users` и `statistics` всегда включены и здесь не значатся.
 */
export const FEATURE_NAMES = [
  "broadcast",
  "subscriptions",
  "promocodes",
  "reports",
  "referral",
  "payments",
  "postcontentAd",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

/** Все фичи включены по умолчанию. */
export const DEFAULT_FEATURES: Record<FeatureName, boolean> = {
  broadcast: true,
  subscriptions: true,
  promocodes: true,
  reports: true,
  referral: true,
  payments: true,
  postcontentAd: true,
};

export type ResolvedFeatures = Record<FeatureName, boolean>;

export function resolveFeatures(
  input?: Partial<FeaturesConfig> | null,
): ResolvedFeatures {
  const out = { ...DEFAULT_FEATURES };
  if (input) {
    for (const name of FEATURE_NAMES) {
      if (typeof input[name] === "boolean") out[name] = input[name] as boolean;
    }
  }
  return out;
}

/**
 * Гасит фичи, для которых не передан обязательный адаптер хоста,
 * с предупреждением в лог. Возвращает новый объект.
 */
export function applyAdapterGating(
  features: ResolvedFeatures,
  adapters: AdminAdapters | undefined,
  warn: (msg: string) => void = (msg) => log.warn(msg),
): ResolvedFeatures {
  const out = { ...features };
  if (out.broadcast && !adapters?.broadcast) {
    warn(
      "features.broadcast включена, но не передан adapters.broadcast — фича отключена",
    );
    out.broadcast = false;
  }
  if (out.reports && !adapters?.reports) {
    warn(
      "features.reports включена, но не передан adapters.reports — фича отключена",
    );
    out.reports = false;
  }
  return out;
}

/** Описание кастомного роута вместе с UI-схемой для внешней панели. */
export interface CustomRouteWithUi extends CustomRoute {
  ui?: {
    description?: string;
    fields?: unknown[];
  };
}

export interface HttpConfig {
  enabled?: boolean;
  port?: number;
  /** Токен авторизации к /api/*. Обязателен при enabled. Модуль НЕ читает env сам. */
  token?: string;
  /** Разрешённые Origin для CORS. `true` — отражать любой (только для локалки). */
  cors?: { origins: string[] | true };
  customRoutes?: CustomRouteWithUi[];
}

export interface TelegramMenuConfig {
  enabled?: boolean;
  /**
   * `own` (по умолчанию) — модуль монтирует собственный `session()` для admin-сцен,
   * изолированно от сессии хоста. Передайте `store`, чтобы состояние переживало рестарт.
   */
  session?: {
    store?: SessionStore;
    getSessionKey?: (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctx: any,
    ) => Promise<string | undefined> | string | undefined;
  };
  customScenes?: CustomScene[];
}

export interface AdminConfig {
  /** Telegraf-инстанс бота-хоста. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot: Telegraf<any>;
  /** Telegram ID администраторов. */
  admins: number[];
  /** Реализация сторов включённых фич (обязателен `UserStore`). */
  db: AdminStore;
  features?: Partial<FeaturesConfig>;

  /**
   * Адаптеры хоста по фичам. Нужны только для включённых фич:
   * `broadcast` требует `adapters.broadcast`, `reports` — `adapters.reports`.
   * Если адаптер не передан, соответствующая фича молча отключается.
   */
  adapters?: AdminAdapters;

  telegramMenu?: TelegramMenuConfig;
  http?: HttpConfig;

  /**
   * Свой логгер (winston / pino / любой объект с `debug/info/warn/error`).
   * По умолчанию — `console` с префиксом `[telegraf-admin-for-bots]`.
   */
  logger?: Logger;
  /** Уровень встроенного логгера, если свой не передан. По умолчанию `"info"`. */
  logLevel?: LogLevel;
}
