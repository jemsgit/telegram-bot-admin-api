import { Scenes } from "telegraf";
import { getAdminBroadcastListScene } from "./BroadcastListScene";
import { getMainAdminMenuScene } from "./MainAdminMenuScene";
import { getAdminUserProfileScene } from "./UserProfileScene";
import { getAdminUserSearchScene } from "./UserSearchScene";

import { getAdminExtendSubscriptionScene } from "./ExtendSubscriptionScene";

import { getAdminAssignPromoScene } from "./AssignPromoScene";
import { getAdminUserReportsScene } from "./UserReportsScene";
import { getAdminReportsListScene } from "./RepoprtsListScene";
import { AdminBotConfig, AdminServices, CustomScene } from "../../types";
import { getAdminPromoListScene } from "./PromoListScene";
import { getAdminPromoCreateScene } from "./PromoCreateScene";
import { getAdminBroadcastCreateScene } from "./BroadcastCreateScene";
import { getAdminPostContentAdListScene } from "./PostcontentListScene";
import { getAdminPostContentAdCreateScene } from "./PostContentAdCreateScene";
import { getStatsScene } from "./StatisticsScene";
import { getAdminPaymentsScene } from "./PaymentsScene";

export function addScenesToMainBot(
  stage: Scenes.Stage<any>,
  customScenes: CustomScene[],
  services: AdminServices,
  config: AdminBotConfig
) {
  const customScenesList = customScenes.map((item) => item.scene);
  const adminScenes = [
    getMainAdminMenuScene(services, config, customScenes),
    getAdminUserSearchScene(services, config),
    getAdminUserProfileScene(services, config),
    getAdminExtendSubscriptionScene(services, config),
    getAdminAssignPromoScene(services, config),
    getAdminUserReportsScene(services, config),
    getAdminReportsListScene(services),
    getAdminBroadcastListScene(services, config),
    getAdminPromoListScene(services, config),
    getAdminPromoCreateScene(services, config),
    getAdminBroadcastCreateScene(services, config),
    getAdminPostContentAdListScene(services, config),
    getAdminPostContentAdCreateScene(services, config),
    getStatsScene(services, config),
    getAdminPaymentsScene(services),
    ...customScenesList,
  ];

  adminScenes.forEach((scene) => {
    stage.register(scene);
  });
}
