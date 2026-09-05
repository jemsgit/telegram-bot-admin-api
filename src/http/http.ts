import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { Telegraf } from "telegraf";
import type Joi from "joi";

import type { AdminServices } from "../types";
import type { AdminStore } from "../stores";
import { log } from "../logger";

/** Ошибка с HTTP-статусом. Всё остальное — 500. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface RouteContext {
  services: AdminServices;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  telegraf: Telegraf<any>;
  db: AdminStore;
}

export type RouteHandler = (
  req: Request,
  res: Response,
  ctx: RouteContext,
) => Promise<unknown> | unknown;

export interface RouteDef {
  method: "get" | "post" | "put" | "delete" | "patch";
  /** Путь под `/api` — например `/users/:id`. */
  path: string;
  validate?: RequestHandler | RequestHandler[];
  handler: RouteHandler;
  /** HTTP-статус для успешного ответа, если хендлер вернул значение. */
  successStatus?: number;

  // --- Метаданные для GET /api/openapi.json (см. src/http/openapi.ts) ---
  /** Короткое описание роута для документации. */
  summary?: string;
  /** Группировка в OpenAPI (по умолчанию — имя фичи). */
  tags?: string[];
  /**
   * Joi-схема тела запроса — та же, что используется в `validate` (см.
   * `validators/index.ts`, экспортированы и мидлвары, и сырые схемы).
   * Опционально: не у каждого роута с `validate` схема экспортирована.
   */
  bodySchema?: Joi.Schema;
}

/**
 * Оборачивает хендлер: ловит ошибки, а возвращённое значение сериализует в JSON
 * (если ответ ещё не отправлен). `undefined` — хендлер ответил сам.
 */
export function asyncRoute(def: RouteDef, ctx: RouteContext): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(def.handler(req, res, ctx))
      .then((value) => {
        if (res.headersSent) return;
        if (value === undefined) {
          res.status(def.successStatus ?? 204).end();
          return;
        }
        res.status(def.successStatus ?? 200).json(value);
      })
      .catch(next);
  };
}

/** Централизованный обработчик ошибок. Монтируется последним. */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return;
  if (err instanceof HttpError) {
    res
      .status(err.status)
      .json(
        err.details !== undefined
          ? { error: err.message, details: err.details }
          : { error: err.message },
      );
    return;
  }
  log.error("route error:", err);
  res.status(500).json({ error: "internal_error" });
}
