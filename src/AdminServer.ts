import express, { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import type { Socket } from "node:net";
import type { Telegraf } from "telegraf";
import cors from "cors";
import bodyParser from "body-parser";

import type { AdminServices } from "./types";
import type { AdminStore } from "./stores";
import type { ResolvedFeatures, CustomRouteWithUi } from "./config";
import { resolveFeatures } from "./config";
import { errorMiddleware } from "./http/http";
import { mountRoutes } from "./http/register";
import { resolveUiDir } from "./http/uiStatic";
import { createUiAuthRouter, safeEqual } from "./http/uiAuth";
import { log } from "./logger";

type AdminServerFeaturesConfig = Partial<ResolvedFeatures> & {
  customRoutesConfig?: unknown[];
};

type AdminServerOptions = {
  customRoutes?: CustomRouteWithUi[];
  port?: number;
  /** Токен авторизации к /api/*. Обязателен. */
  adminApiKey?: string;
  /** Allowlist Origin для CORS. По умолчанию отражает любой origin. */
  cors?: { origins: string[] | true };
  /** Отдавать standalone-UI (см. docs/CUSTOMIZABLE_ADMIN_UI.md). */
  ui?: {
    enabled?: boolean;
    auth?: { username: string; password: string };
  };
};

/**
 * HTTP REST API админки.
 *
 * @internal Конструктор — деталь реализации. Внешний код должен использовать
 * `createAdmin({ http: { enabled: true } })`.
 */
export class AdminServer {
  private app: Express;
  private adminApiKey: string;
  private port: number;
  private server?: Server;
  private sockets = new Set<Socket>();

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    telegraf: Telegraf<any>,
    db: AdminStore,
    services: AdminServices,
    options: AdminServerOptions = {},
    featuresConfig: AdminServerFeaturesConfig = {},
  ) {
    if (!options.adminApiKey) {
      throw new Error("AdminServer: не задан http.token");
    }
    this.adminApiKey = options.adminApiKey;
    this.port = options.port ?? 3105;

    const features: ResolvedFeatures = resolveFeatures(featuresConfig);

    this.app = express();
    const allowed = options.cors?.origins ?? true;
    this.app.use(
      cors({
        origin:
          allowed === true
            ? (_origin, callback) => callback(null, true)
            : (origin, callback) =>
                callback(null, !origin || allowed.includes(origin)),
        credentials: true,
      }),
    );
    this.app.use(bodyParser.json());

    this.app.get("/health", (_req, res) => {
      res.json({ ok: true });
    });

    if (options.ui?.enabled) {
      // Логин UI — до статики и до /api-авторизации, сам без токена.
      this.app.use(
        "/ui",
        createUiAuthRouter({
          token: this.adminApiKey,
          auth: options.ui.auth,
        }),
      );

      const uiDir = resolveUiDir();
      if (uiDir) {
        this.app.use(express.static(uiDir));
      } else {
        log.warn(
          "http.ui.enabled=true, но собранный UI не найден (lib/ui) — " +
            "выполните `npm run build` в ui/ перед публикацией/запуском",
        );
      }
    }

    this.app.use("/api", this.apiAuth.bind(this));

    mountRoutes(
      this.app,
      { services, telegraf, db },
      features,
      options.customRoutes ?? [],
      featuresConfig,
    );

    this.app.use(errorMiddleware);
  }

  private apiAuth(req: Request, res: Response, next: NextFunction) {
    const key =
      req.header("x-api-key") || req.header("authorization")?.split(" ")[1];
    if (!key || !safeEqual(key, this.adminApiKey)) {
      return res.status(401).json({ error: "unauthorized" });
    }
    next();
  }

  /** Поднимает сервер, возвращает http.Server. */
  start(): Server {
    this.server = this.app.listen(this.port, () => {
      const addr = this.server?.address();
      const port = typeof addr === "object" && addr ? addr.port : this.port;
      log.info(`HTTP API слушает порт :${port}`);
    });
    this.server.on("connection", (socket) => {
      this.sockets.add(socket);
      socket.on("close", () => this.sockets.delete(socket));
    });
    return this.server;
  }

  /** Graceful shutdown: перестаёт принимать соединения и дорывает активные. */
  async stop(): Promise<void> {
    const server = this.server;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
      for (const socket of this.sockets) socket.end();
      setTimeout(() => {
        for (const socket of this.sockets) socket.destroy();
      }, 5000).unref();
    });
    this.server = undefined;
    this.sockets.clear();
  }
}
