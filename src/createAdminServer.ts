import type { Bot, CustomRoute, FeaturesConfig } from "./types";
import { AdminServer } from "./AdminServer";
import { TypedDB } from "./types/db";

interface CreateAdminServerOptions {
  port?: number;
  features?: Partial<FeaturesConfig>;
  customRoutes?: Array<CustomRoute>;
  customRoutesConfig?: any[];
  baseUrl?: string;
}

function createAdminServer<B extends Bot = Bot>(
  bot: B,
  db: TypedDB,
  scheduler: any,
  options: CreateAdminServerOptions = {}
): AdminServer<B> {
  const {
    port = 3105,
    features = {},
    customRoutes = [],
    customRoutesConfig = [],
    baseUrl,
  } = options;

  const adminServer = new AdminServer(
    bot,
    db,
    scheduler,
    { customRoutes, port },
    {
      ...features,
      base: baseUrl,
      customRoutesConfig,
    }
  );

  return adminServer;
}

export { createAdminServer };
