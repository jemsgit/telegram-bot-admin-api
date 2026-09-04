import type { Scenes } from "telegraf";

import type { AdminServices, AdminBotContext } from "../types";
import type { FeatureName, ResolvedFeatures } from "../config";
import { FEATURE_NAMES } from "../config";
import type { RouteDef } from "../http/http";
import { coreRoutes, featureRoutes } from "../http/routes";

import { getAdminUserSearchScene } from "../adminBot/scenes/UserSearchScene";
import { getAdminUserProfileScene } from "../adminBot/scenes/UserProfileScene";
import { getStatsScene } from "../adminBot/scenes/StatisticsScene";
import { getAdminExtendSubscriptionScene } from "../adminBot/scenes/ExtendSubscriptionScene";
import { getAdminAssignPromoScene } from "../adminBot/scenes/AssignPromoScene";
import { getAdminUserReportsScene } from "../adminBot/scenes/UserReportsScene";
import { getAdminReportsListScene } from "../adminBot/scenes/RepoprtsListScene";
import { getAdminBroadcastListScene } from "../adminBot/scenes/BroadcastListScene";
import { getAdminBroadcastCreateScene } from "../adminBot/scenes/BroadcastCreateScene";
import { getAdminPromoListScene } from "../adminBot/scenes/PromoListScene";
import { getAdminPromoCreateScene } from "../adminBot/scenes/PromoCreateScene";
import { getAdminPostContentAdListScene } from "../adminBot/scenes/PostcontentListScene";
import { getAdminPostContentAdCreateScene } from "../adminBot/scenes/PostContentAdCreateScene";
import { getAdminPaymentsScene } from "../adminBot/scenes/PaymentsScene";

type Scene = Scenes.BaseScene<AdminBotContext>;
type SceneFactory = (
  services: AdminServices,
  config: ResolvedFeatures,
) => Scene[];

export interface MenuEntry {
  /** Текст кнопки в главном меню. */
  button: string;
  /** ID сцены, в которую ведёт кнопка. */
  enter: string;
  /** Порядок в меню (по возрастанию). */
  order: number;
}

export interface FeatureModule {
  name: FeatureName;
  menu?: MenuEntry;
  scenes: SceneFactory;
  httpRoutes: (services: AdminServices) => RouteDef[];
}

/** Сцены и меню, доступные всегда (пользователи + статистика). */
export const CORE_SCENES: SceneFactory = (s, cfg) => [
  getAdminUserSearchScene(s, cfg),
  getAdminUserProfileScene(s, cfg),
  getStatsScene(s, cfg),
];

export const CORE_MENU: MenuEntry[] = [
  { button: "👥 Пользователи", enter: "AdminUserSearchScene", order: 10 },
  { button: "📊 Статистика", enter: "AdminStatisticsScene", order: 20 },
];

export const FEATURE_MODULES: FeatureModule[] = [
  {
    name: "broadcast",
    menu: {
      button: "📢 Рассылки",
      enter: "AdminBroadcastListScene",
      order: 30,
    },
    scenes: (s, cfg) => [
      getAdminBroadcastListScene(s, cfg),
      getAdminBroadcastCreateScene(s, cfg),
    ],
    httpRoutes: featureRoutes.broadcast,
  },
  {
    name: "subscriptions",
    scenes: (s, cfg) => [getAdminExtendSubscriptionScene(s, cfg)],
    httpRoutes: featureRoutes.subscriptions,
  },
  {
    name: "promocodes",
    menu: { button: "🎁 Промокоды", enter: "AdminPromoListScene", order: 50 },
    scenes: (s, cfg) => [
      getAdminAssignPromoScene(s, cfg),
      getAdminPromoListScene(s, cfg),
      getAdminPromoCreateScene(s, cfg),
    ],
    httpRoutes: featureRoutes.promocodes,
  },
  {
    name: "reports",
    menu: { button: "📝 Обращения", enter: "AdminReportsListScene", order: 60 },
    scenes: (s, cfg) => [
      getAdminUserReportsScene(s, cfg),
      getAdminReportsListScene(s),
    ],
    httpRoutes: featureRoutes.reports,
  },
  {
    name: "payments",
    menu: { button: "💰 Платежи", enter: "AdminPaymentsScene", order: 70 },
    scenes: (s) => [getAdminPaymentsScene(s)],
    httpRoutes: featureRoutes.payments,
  },
  {
    name: "postcontentAd",
    menu: {
      button: "📈 Инлайн реклама",
      enter: "AdminPostContentAdListScene",
      order: 40,
    },
    scenes: (s, cfg) => [
      getAdminPostContentAdListScene(s, cfg),
      getAdminPostContentAdCreateScene(s, cfg),
    ],
    httpRoutes: featureRoutes.postcontentAd,
  },
  {
    name: "referral",
    scenes: () => [],
    httpRoutes: featureRoutes.referral,
  },
];

const BY_NAME = new Map(FEATURE_MODULES.map((m) => [m.name, m]));

/** Дескрипторы включённых фич (в фиксированном порядке `FEATURE_NAMES`). */
export function selectEnabledFeatures(
  features: ResolvedFeatures,
): FeatureModule[] {
  return FEATURE_NAMES.filter((n) => features[n])
    .map((n) => BY_NAME.get(n)!)
    .filter(Boolean);
}

/** Собирает все сцены админки (core + включённые фичи). */
export function buildAdminScenes(
  services: AdminServices,
  features: ResolvedFeatures,
): Scene[] {
  return [
    ...CORE_SCENES(services, features),
    ...selectEnabledFeatures(features).flatMap((m) =>
      m.scenes(services, features),
    ),
  ];
}

/** Пункты главного меню (core + включённые фичи), отсортированные по `order`. */
export function buildMenuEntries(features: ResolvedFeatures): MenuEntry[] {
  return [
    ...CORE_MENU,
    ...selectEnabledFeatures(features)
      .map((m) => m.menu)
      .filter((x): x is MenuEntry => !!x),
  ].sort((a, b) => a.order - b.order);
}

/** Все активные HTTP-роуты: core + включённые фичи. */
export function buildHttpRoutes(
  services: AdminServices,
  features: ResolvedFeatures,
): RouteDef[] {
  return [
    ...coreRoutes(services),
    ...selectEnabledFeatures(features).flatMap((m) => m.httpRoutes(services)),
  ];
}
