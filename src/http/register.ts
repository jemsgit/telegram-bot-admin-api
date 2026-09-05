import type { Express, RequestHandler } from "express";

import type { ResolvedFeatures, CustomRouteWithUi } from "../config";
import { buildHttpRoutes } from "../features";
import { asyncRoute, type RouteContext } from "./http";
import { buildOpenApiDocument } from "./openapi";

/**
 * Приводит путь кастомного роута к виду `/api/<...>`: ведущие слэши и необязательный
 * префикс `api/` срезаются, затем добавляется `/api/`. Благодаря этому кастомные
 * роуты всегда попадают под `apiAuth` (`app.use("/api", ...)`), как и кор-роуты,
 * а хост может писать путь и с `/api/...`, и без.
 */
export function normalizeApiPath(path: string): string {
  const rest = path
    .trim()
    .replace(/^\/+/, "")
    .replace(/^api\/+/, "");
  return `/api/${rest}`;
}

/** Монтирует все `/api/*` роуты в express-приложение. */
export function mountRoutes(
  app: Express,
  ctx: RouteContext,
  features: ResolvedFeatures,
  customRoutes: CustomRouteWithUi[],
  featuresConfigPayload: unknown,
): void {
  for (const def of buildHttpRoutes(ctx.services, features)) {
    const mws: RequestHandler[] = [];
    if (def.validate) {
      mws.push(
        ...(Array.isArray(def.validate) ? def.validate : [def.validate]),
      );
    }
    app[def.method](`/api${def.path}`, ...mws, asyncRoute(def, ctx));
  }

  // GET /api/config — форма фич + UI-схемы кастомных роутов (для внешней панели)
  app.get("/api/config", (_req, res) => {
    res.json(featuresConfigPayload);
  });

  // GET /api/openapi.json — спека встроенных core+feature роутов (не
  // включает customRoutes бота — см. src/http/openapi.ts). Источник для
  // типизированного клиента встроенных экранов панели.
  app.get("/api/openapi.json", (_req, res) => {
    res.json(buildOpenApiDocument(features));
  });

  // Кастомные роуты хоста — под `/api` и под `apiAuth`.
  for (const route of customRoutes) {
    const mws: RequestHandler[] = route.validate
      ? Array.isArray(route.validate)
        ? route.validate
        : [route.validate]
      : [];

    app[route.method](
      normalizeApiPath(route.path),
      ...mws,
      asyncRoute(
        {
          method: route.method,
          path: route.path,
          handler: (req, res) =>
            route.handler(req, res, () => {}, ctx.telegraf, ctx.db),
        },
        ctx,
      ),
    );
  }
}
