import type { AdminServices } from "../types";
import type { ResolvedFeatures } from "../config";
import { coreRoutes, featureRoutes } from "./routes";
import type { RouteDef } from "./http";
import { joiSchemaToOpenApi } from "./joiToSchema";

/**
 * Роуты не выполняются — только их метаданные (`method`/`path`/`validate`/
 * `bodySchema`) читаются при сборке документа, хендлеры остаются
 * невызванными замыканиями. Поэтому пустой объект как `services` безопасен.
 */
const DUMMY_SERVICES = {} as AdminServices;

function expressPathToOpenApi(path: string): { path: string; params: string[] } {
  const params: string[] = [];
  const converted = path.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) => {
    params.push(name);
    return `{${name}}`;
  });
  return { path: converted, params };
}

/** Вложенный Schema Object (то, что отдаёт `joiSchemaToOpenApi`). */
type JsonSchema = Record<string, unknown>;

interface OpenApiParameter {
  name: string;
  in: string;
  required: boolean;
  schema: JsonSchema;
}

export interface OpenApiOperation {
  summary?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: {
    required: boolean;
    content: Record<string, { schema: JsonSchema }>;
  };
  responses: Record<
    string,
    { description: string; content?: Record<string, unknown> }
  >;
}

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, OpenApiOperation>>;
}

export interface BuildOpenApiOptions {
  title?: string;
  version?: string;
}

/**
 * Собирает OpenAPI 3.0-документ из встроенных core+feature роутов
 * (`routes.ts`) — того же `RouteDef[]`, которым монтируется реальный HTTP API
 * (`http/register.ts`). Используется для типизированного клиента встроенных
 * экранов панели (см. `docs/CUSTOMIZABLE_ADMIN_UI.md`, шаг 3).
 *
 * НЕ включает `customRoutes` бота — они бот-специфичны и уже описываются
 * декларативно через `ui-schema.ts` (`RouteUi`/`FieldSchema`), генерик-UI
 * потребляет их напрямую из `GET /api/config`, без нужды в OpenAPI.
 */
export function buildOpenApiDocument(
  features: ResolvedFeatures,
  options: BuildOpenApiOptions = {},
): OpenApiDocument {
  const enabledFeatureRoutes = (
    Object.keys(featureRoutes) as (keyof typeof featureRoutes)[]
  )
    .filter((name) => features[name])
    .flatMap((name) => featureRoutes[name](DUMMY_SERVICES));

  const routes: RouteDef[] = [...coreRoutes(DUMMY_SERVICES), ...enabledFeatureRoutes];

  const paths: OpenApiDocument["paths"] = {};

  for (const route of routes) {
    const { path, params } = expressPathToOpenApi(route.path);
    const fullPath = `/api${path}`;
    paths[fullPath] ??= {};

    const parameters = params.map((name) => ({
      name,
      in: "path",
      required: true,
      schema: { type: "string" },
    }));

    const operation: OpenApiOperation = {
      summary: route.summary,
      tags: route.tags,
      responses: {
        [String(route.successStatus ?? 200)]: {
          description: "OK",
          content: { "application/json": {} },
        },
        "401": { description: "unauthorized" },
      },
    };
    if (parameters.length) operation.parameters = parameters;
    if (route.bodySchema) {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": { schema: joiSchemaToOpenApi(route.bodySchema) },
        },
      };
    }

    paths[fullPath][route.method] = operation;
  }

  return {
    openapi: "3.0.3",
    info: {
      title: options.title ?? "telegraf-admin-for-bots API",
      version: options.version ?? "0.0.0",
    },
    paths,
  };
}
