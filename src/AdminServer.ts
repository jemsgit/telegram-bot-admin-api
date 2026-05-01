import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import bodyParser from "body-parser";

import { BotApp, CustomRoute, FeaturesConfig, TypedDB } from "./types";
import { UserService } from "./services/user";
import { BroadcastService } from "./services/broadcast";
import { ReportService } from "./services/report";
import { PromocodeService } from "./services/promocode";
import { RefferService } from "./services/reffer";
import { SubscriptionService } from "./services/subscriptions";
import { PaymentService } from "./services/payment";
import {
  validatePromoCreate,
  validateDays,
  validateReply,
  validatePromoCode,
  broadcastValidationSchema,
} from "./validators";
import { PostContentService } from "./services/postcontent";

const defaultFeaturesConfig: FeaturesConfig = {
  broadcast: true,
  subscriptions: true,
  promocodes: true,
  reports: true,
  referral: true,
  payments: true,
  postcontentAd: true,
};

type AdminServerFeaturesConfig = FeaturesConfig & {
  customRoutesConfig?: any[]; // можешь вынести в отдельный тип, если уже описал поля
};

type AdminServerOptions = {
  customRoutes?: CustomRoute[];
  port?: number;
};

export class AdminServer<T extends BotApp> {
  private app: Express;
  private adminApiKey: string | undefined;

  private userService: UserService;
  private broadcastService: BroadcastService;
  private reportService: ReportService;
  private promocodeService: PromocodeService;
  private subscriptionService: SubscriptionService;
  private refferService: RefferService;
  private paymentService: PaymentService;
  private adService: PostContentService;

  private port: number;

  constructor(
    private bot: T,
    private db: TypedDB,
    private scheduleService: any, // можно тоже типизировать, если есть интерфейс
    options: AdminServerOptions = {},
    featuresConfig: AdminServerFeaturesConfig = defaultFeaturesConfig,
  ) {
    this.adminApiKey = process.env.ADMIN_API_TOKEN;
    this.port = options.port ?? 3105;

    // Инициализация сервисов
    this.userService = new UserService(this.db);
    this.broadcastService = new BroadcastService(
      this.db,
      this.scheduleService,
      this.bot,
    );
    this.reportService = new ReportService(this.db, this.bot);
    this.promocodeService = new PromocodeService(this.db);
    this.subscriptionService = new SubscriptionService(this.db);
    this.refferService = new RefferService(this.db);
    this.paymentService = new PaymentService(this.db);
    this.adService = new PostContentService(this.db);

    this.app = express();
    this.app.use(
      cors({
        origin: (_origin, callback) => {
          callback(null, true);
        },
        credentials: true,
      }),
    );

    this.app.use(bodyParser.json());

    this.app.use("/api", this.apiAuth.bind(this));

    this.registerRoutes(featuresConfig);
    this.registerCustomRoutes(options.customRoutes ?? []);
  }

  private apiAuth(req: Request, res: Response, next: NextFunction) {
    if (!this.adminApiKey) {
      return res
        .status(500)
        .json({ error: "ADMIN_API_TOKEN is not configured" });
    }
    const key =
      req.header("x-api-key") || req.header("authorization")?.split(" ")[1];
    if (key !== this.adminApiKey) {
      return res.status(401).json({ error: "unauthorized" });
    }
    next();
  }

  private registerRoutes(config: AdminServerFeaturesConfig) {
    const app = this.app;

    // 1. Поиск пользователей
    app.get(
      "/api/users",
      async (req: Request, res: Response): Promise<void> => {
        try {
          const q = String(req.query.query || "");
          const data = await this.userService.search(q);
          res.json(data);
        } catch (e) {
          console.error("Failed to search users", e);
          res.status(500).json({ error: "Failed to search users" });
        }
      },
    );

    // Все пользователи — должен быть до /api/users/:id, иначе Express матчит "all" как id
    app.get(
      "/api/users/all",
      async (_req: Request, res: Response): Promise<void> => {
        try {
          const data = await this.userService.getAll();
          res.json(data);
        } catch (e) {
          console.error("Failed to get users", e);
          res.status(500).json({ error: "Failed to get users" });
        }
      },
    );

    // 1.1 Получить пользователя по id
    app.get(
      "/api/users/:id",
      async (req: Request, res: Response): Promise<void> => {
        try {
          const { id } = req.params;
          const data = await this.userService.getById(id);
          res.json(data);
        } catch (e) {
          console.error("Failed to get user by id", e);
          res.status(500).json({ error: "Failed to search users" });
        }
      },
    );

    if (config.payments) {
      app.get(
        "/api/payments",
        async (_req: Request, res: Response): Promise<void> => {
          try {
            const data = await this.paymentService.getAllPayments();
            res.json(data);
          } catch (e) {
            console.error("Failed to get payments", e);
            res.status(500).json({ error: "Failed to get pyments" });
          }
        },
      );

      app.get(
        "/api/payments/stats",
        async (_req: Request, res: Response): Promise<void> => {
          try {
            const data = await this.paymentService.getStats();
            res.json(data);
          } catch (e) {
            console.error("Failed to get payment stats", e);
            res.status(500).json({ error: "Failed to get pyments" });
          }
        },
      );
    }

    if (config.postcontentAd) {
      // Получить список реклам
      app.get(
        "/api/ads",
        async (_req: Request, res: Response): Promise<void> => {
          try {
            const ads = await this.adService.list();
            res.json(ads);
          } catch (e) {
            console.error("Failed to get ads", e);
            res.status(500).json({ error: "Failed to get ads" });
          }
        },
      );

      // Получить рекламу по id
      app.get(
        "/api/ads/:id",
        async (req: Request, res: Response): Promise<void> => {
          try {
            const ad = await this.adService.get(req.params.id);
            if (!ad) {
              res.status(404).json({ error: "not found" });
              return;
            }
            res.json(ad);
          } catch (e) {
            console.error("Failed to get ad", e);
            res.status(500).json({ error: "Failed to get ad" });
          }
        },
      );

      // Создать рекламу
      app.post(
        "/api/ads",
        async (req: Request, res: Response): Promise<void> => {
          try {
            const ad = await this.adService.create(req.body);
            res.json(ad);
          } catch (e) {
            console.error("Failed to create ad", e);
            res.status(500).json({ error: "Failed to create ad" });
          }
        },
      );

      // Обновить рекламу
      app.patch(
        "/api/ads/:id",
        async (req: Request, res: Response): Promise<void> => {
          try {
            const updated = await this.adService.update(
              req.params.id,
              req.body,
            );
            if (!updated) {
              res.status(404).json({ error: "not found" });
              return;
            }
            res.json(updated);
          } catch (e) {
            console.error("Failed to update ad", e);
            res.status(500).json({ error: "Failed to update ad" });
          }
        },
      );

      // Удалить рекламу
      app.delete(
        "/api/ads/:id",
        async (req: Request, res: Response): Promise<void> => {
          try {
            const ok = await this.adService.delete(req.params.id);
            res.json({ ok });
          } catch (e) {
            console.error("Failed to delete ad", e);
            res.status(500).json({ error: "Failed to delete ad" });
          }
        },
      );
    }

    if (config.subscriptions) {
      // Продление подписки
      app.post(
        "/api/users/:id/extend-subscription",
        validateDays,
        async (req: Request, res: Response): Promise<void> => {
          try {
            await this.userService.extendSubscription(
              req.params.id,
              req.body.days,
            );
            res.json({ ok: true });
          } catch (e) {
            console.error("Failed to extend subscription", e);
            res.status(500).json({ error: "Failed to extend subscription" });
          }
        },
      );

      // Активировать промо-подписку
      app.post(
        "/api/users/:id/activate-promo-subscription",
        validateDays,
        async (req: Request, res: Response): Promise<void> => {
          try {
            await this.userService.activatePromo(req.params.id, req.body);
            res.json({ ok: true });
          } catch (e) {
            console.error("Failed to activate promo subscription", e);
            res.status(500).json({
              error: "Failed to activate promo subscription",
            });
          }
        },
      );

      // Удалить подписку
      app.delete(
        "/api/users/:id/subscription",
        async (req: Request, res: Response): Promise<void> => {
          try {
            await this.userService.deleteSubscription(req.params.id);
            res.json({ ok: true });
          } catch (e) {
            console.error("Failed to delete subscription", e);
            res.status(500).json({ error: "Failed to delete subscription" });
          }
        },
      );

      app.get(
        "/api/subscriptions",
        async (_req: Request, res: Response): Promise<void> => {
          try {
            const data = await this.subscriptionService.getAllSubscriptions();
            res.json(data);
          } catch (e) {
            console.error("Failed to get subscriptions", e);
            res.status(500).json({ error: "Failed to get subscriptions" });
          }
        },
      );
    }

    if (config.reports) {
      // Обращения пользователя
      app.get(
        "/api/users/:id/reports",
        async (req: Request, res: Response): Promise<void> => {
          try {
            const rows = await this.userService.getReports(req.params.id);
            res.json(rows);
          } catch (e) {
            console.error("Failed to get user reports", e);
            res.status(500).json({ error: "Failed to get user reports" });
          }
        },
      );

      app.get(
        "/api/reports",
        async (_req: Request, res: Response): Promise<void> => {
          try {
            const rows = await this.reportService.getAll();
            res.json(rows);
          } catch (e) {
            console.error("Failed to load reports", e);
            res.status(500).json({ error: "Failed to load reports" });
          }
        },
      );

      app.get(
        "/api/reports/:reportId",
        async (req: Request, res: Response): Promise<void> => {
          try {
            const { reportId } = req.params;
            const data = await this.reportService.getById(reportId);
            res.json(data);
          } catch (e) {
            console.error("Failed to load report", e);
            res.status(500).json({ error: "Failed to load reports" });
          }
        },
      );

      app.post(
        "/api/reports/:reportId/reply",
        validateReply,
        async (req: Request, res: Response): Promise<void> => {
          const reportId = req.params.reportId;
          const { text } = req.body as { text: string };

          try {
            const report = await this.reportService.getById(reportId);

            if (!report) {
              res.status(404).json({ error: "not found" });
              return;
            }

            await this.reportService.reply(report, text);
            res.json({ ok: true });
          } catch (e) {
            console.error("Send error", e);
            res.status(500).json({ error: "send_failed" });
          }
        },
      );
    }

    // Статистика
    app.get(
      "/api/stats",
      async (_req: Request, res: Response): Promise<void> => {
        try {
          const rows = await this.userService.getStats();
          res.json(rows);
        } catch (e) {
          console.error("Failed to get statistics", e);
          res.status(500).json({ error: "Failed to get statistics" });
        }
      },
    );

    if (config.promocodes) {
      app.post(
        "/api/users/:id/promocode",
        validatePromoCode,
        async (req: Request, res: Response): Promise<void> => {
          try {
            await this.userService.addPromocode(
              req.params.id,
              req.body.promoCode,
            );
            res.json({ ok: true });
          } catch (e) {
            console.error("Failed to add promocode", e);
            res.status(500).json({ error: "Failed to add promocode" });
          }
        },
      );

      app.post(
        "/api/promocodes",
        validatePromoCreate,
        async (req: Request, res: Response): Promise<void> => {
          try {
            const promo = await this.promocodeService.create(req.body);
            res.status(201).json(promo);
          } catch (error: any) {
            console.error("Failed to create promocode", error);
            res.status(500).json({ error: error.message });
          }
        },
      );

      app.delete(
        "/api/promocodes/:code",
        async (req: Request, res: Response): Promise<void> => {
          try {
            const code = req.params.code;
            const deleted = await this.promocodeService.delete(code);
            if (!deleted) {
              res.status(404).json({ error: `Промокод ${code} не найден` });
              return;
            }
            res.json({ ok: true, message: `Промокод ${code} удалён` });
          } catch (error: any) {
            console.error("Failed to delete promocode", error);
            res.status(500).json({ error: error.message });
          }
        },
      );

      app.get(
        "/api/promocodes",
        async (_req: Request, res: Response): Promise<void> => {
          try {
            const promos = await this.promocodeService.getAll();
            res.json(promos);
          } catch (error: any) {
            console.error("Failed to get promocodes", error);
            res.status(500).json({ error: error.message });
          }
        },
      );
    }

    if (config.broadcast) {
      app.get(
        "/api/broadcasts",
        async (req: Request, res: Response): Promise<void> => {
          try {
            const status = req.query.status as string | undefined;
            const broadcasts = await this.broadcastService.list(status);
            res.json(broadcasts);
          } catch (e) {
            console.error("Failed to get broadcasts", e);
            res.status(500).json({ error: "Failed to get broadcasts" });
          }
        },
      );

      app.get(
        "/api/broadcasts/:id",
        async (req: Request, res: Response): Promise<void> => {
          try {
            const broadcast = await this.broadcastService.get(req.params.id);
            if (!broadcast) {
              res.status(404).json({ error: "Broadcast not found" });
              return;
            }
            res.json(broadcast);
          } catch (e) {
            console.error("Failed to get broadcast", e);
            res.status(500).json({ error: "Failed to get broadcast" });
          }
        },
      );

      app.post(
        "/api/broadcasts",
        async (req: Request, res: Response): Promise<void> => {
          const { error, value } = broadcastValidationSchema.validate(
            req.body,
            {
              abortEarly: false,
            },
          );

          if (error) {
            res.status(400).json({
              error: "Validation error",
              details: error.details.map((d: any) => d.message),
            });
            return;
          }

          try {
            const b = await this.broadcastService.create(value);
            res.json(b);
          } catch (e) {
            console.error("Failed to create broadcast", e);
            res.status(500).json({ error: "Failed to create broadcast" });
          }
        },
      );

      app.post(
        "/api/broadcasts/:id/send-test",
        async (req: Request, res: Response): Promise<void> => {
          try {
            const ok = await this.broadcastService.sendTest(req.params.id);
            if (!ok) {
              res.status(404).json({ error: "not found" });
              return;
            }
            res.json({ ok: true });
          } catch (e) {
            console.error("Failed to send test broadcast", e);
            res.status(500).json({ error: "Failed to send test broadcast" });
          }
        },
      );

      app.put(
        "/api/broadcasts/:id",
        async (req: Request, res: Response): Promise<void> => {
          const { error, value } = broadcastValidationSchema.validate(
            req.body,
            { abortEarly: false },
          );

          if (error) {
            res.status(400).json({
              error: "Validation error",
              details: error.details.map((d: any) => d.message),
            });
            return;
          }

          try {
            const updated = await this.broadcastService.update(
              req.params.id,
              value as any,
            );
            if (!updated) {
              res.status(404).json({ error: "not found" });
              return;
            }
            res.json(updated);
          } catch (e: any) {
            if (e.message === "cant modify") {
              res.status(403).json({ error: "cant modify" });
              return;
            }
            console.error("Failed to update broadcast", e);
            res.status(500).json({ error: "Failed to update broadcast" });
          }
        },
      );

      app.delete(
        "/api/broadcasts/:id",
        async (req: Request, res: Response): Promise<void> => {
          try {
            const ok = await this.broadcastService.delete(req.params.id);
            if (!ok) {
              res.status(404).json({ error: "not found" });
              return;
            }
            res.json({ ok: true });
          } catch (e) {
            console.error("Failed to delete broadcast", e);
            res.status(500).json({ error: "Failed to delete broadcast" });
          }
        },
      );
    }

    if (config.referral) {
      app.get(
        "/api/reffers",
        async (req: Request, res: Response): Promise<void> => {
          try {
            const query = req.query.query as string | undefined;

            if (query) {
              const data = await this.refferService.countByLink(query);
              res.json(data);
              return;
            }

            const data = await this.refferService.getAll();
            res.json(data);
          } catch (e) {
            console.error("Failed to get reffers", e);
            res.status(500).json({ error: "Failed to get reffers" });
          }
        },
      );
    }

    app.get(
      "/api/config",
      async (_req: Request, res: Response): Promise<void> => {
        res.json(config);
        return;
      },
    );
  }

  private registerCustomRoutes(customRoutes: CustomRoute[]) {
    for (const route of customRoutes) {
      const { method, path, handler } = route;
      this.app[method](
        path,
        async (req: Request, res: Response, next: NextFunction) => {
          try {
            await handler(req, res, next, this.bot, this.db);
          } catch (err) {
            console.error("Custom route error:", err);
            res.status(500).json({ error: "internal_error" });
          }
        },
      );
    }
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`✅ Admin server listening on :${this.port}`);
    });
  }
}
