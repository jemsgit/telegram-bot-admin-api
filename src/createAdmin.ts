import type { Server } from "node:http";

import type { AdminConfig } from "./config";
import { resolveFeatures, applyAdapterGating } from "./config";
import type { AdminServices } from "./types";
import { validateStore } from "./stores";
import { buildAdminServices } from "./services/buildServices";
import { createAdminBot } from "./adminBot/createAdminBot";
import { AdminServer } from "./AdminServer";
import { normalizeApiPath } from "./http/register";
import { setLogger } from "./logger";
import { validateRouteUi, resolveRouteUi } from "./ui-schema";

export interface AdminHandle {
  services: AdminServices;
  /** Монтирует admin-меню в Telegraf хоста. Вызывать до `bot.launch()`. */
  attachBot(): void;
  /** Поднимает HTTP API. Возвращает http.Server. Бросает, если http.enabled без token. */
  startHttp(): Server | undefined;
  /** Останавливает HTTP API. */
  stopHttp(): Promise<void>;
}

/**
 * Единая точка подключения админки к боту на telegraf.
 *
 * ```ts
 * const admin = createAdmin({
 *   bot,
 *   admins: [123],
 *   db,
 *   features: { broadcast: true, reports: true },
 *   adapters: {
 *     broadcast: { scheduler, sendTest: (b) => bot.sendTestBroadcast(b) },
 *     reports: { replyToUser: (id, reply, original) => host.reply(id, reply) },
 *   },
 *   http: { enabled: true, port: 3010, token: process.env.ADMIN_API_TOKEN },
 * });
 * admin.attachBot();
 * admin.startHttp();
 * ```
 */
export function createAdmin(config: AdminConfig): AdminHandle {
  setLogger(config.logger, config.logLevel);
  const features = applyAdapterGating(
    resolveFeatures(config.features),
    config.adapters,
  );
  validateStore(config.db, features);
  validateRouteUi(config.http?.customRoutes ?? []);
  const services = buildAdminServices({
    db: config.db,
    adapters: config.adapters,
  });

  let server: AdminServer | undefined;

  return {
    services,

    attachBot() {
      if (config.telegramMenu?.enabled === false) return;
      const middleware = createAdminBot({
        admins: config.admins,
        services,
        features,
        menu: config.telegramMenu,
      });
      config.bot.use(middleware.middleware());
    },

    startHttp() {
      const http = config.http;
      if (!http?.enabled) return undefined;
      if (!http.token) {
        throw new Error(
          "createAdmin: http.enabled требует http.token (модуль не читает env сам)",
        );
      }
      const uiAuth = http.ui?.auth;
      if (uiAuth && (!uiAuth.username?.trim() || !uiAuth.password?.trim())) {
        throw new Error(
          "createAdmin: http.ui.auth требует непустые username и password",
        );
      }
      server = new AdminServer(
        config.bot,
        config.db,
        services,
        {
          port: http.port ?? 3105,
          customRoutes: http.customRoutes ?? [],
          adminApiKey: http.token,
          cors: http.cors,
          ui: http.ui,
        },
        {
          ...features,
          customRoutesConfig: (http.customRoutes ?? [])
            .filter((r) => r.ui)
            .map((r) => ({
              url: normalizeApiPath(r.path),
              method: r.method,
              ...resolveRouteUi(r),
            })),
        },
      );
      return server.start();
    },

    async stopHttp() {
      await server?.stop();
      server = undefined;
    },
  };
}
