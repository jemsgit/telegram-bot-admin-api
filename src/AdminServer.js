const express = require("express");
var cors = require("cors");
const bodyParser = require("body-parser");
const Joi = require("joi");
const { BroadcastService } = require("./services/broadcast");
const { UserService } = require("./services/user");
const { ReportService } = require("./services/report");
const { PromocodeService } = require("./services/promocode");
const { RefferService } = require("./services/reffer");
const { SubscriptionService } = require("./services/subscriptions");
const { PaymentService } = require("./services/payment");

const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN;

// Схема валидации для поля days
const daysSchema = Joi.object({
  days: Joi.number().integer().positive().required(),
});

// Схема валидации для поля days
const reportReplySchema = Joi.object({
  text: Joi.string().required(),
});

// Схема валидации для поля days
const promoCodeSchema = Joi.object({
  promoCode: Joi.string().required(),
});

const broadcastValidationSchema = Joi.object({
  title: Joi.string().optional(),
  type: Joi.string().valid("text", "photo", "video").default("text"),
  text: Joi.alternatives().conditional("type", {
    is: "text",
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),

  mediaUrl: Joi.alternatives().conditional("type", {
    is: Joi.valid("photo", "video"),
    then: Joi.string().uri().required(),
    otherwise: Joi.string().optional(),
  }),
  scheduledAt: Joi.date().iso().optional(),
  excludePaid: Joi.boolean().default(true),
  linkButtons: Joi.array()
    .items(
      Joi.object({
        text: Joi.string().required(),
        url: Joi.string().uri().required(),
      })
    )
    .default([]),
});

// Joi-схема для валидирования промокода при создании
const promoCreateSchema = Joi.object({
  code: Joi.string().required(),
  description: Joi.string().optional(),
  discountPercent: Joi.number().min(0).max(100).required(),
  price: Joi.number().positive().optional(),
  activeFrom: Joi.date().iso().required(),
  activeTo: Joi.date().iso().required(),
  isActive: Joi.boolean().default(true),
  segments: Joi.array().items(Joi.string()).default([]).optional(),
});

// Middleware валидации для создания промокода
function validatePromoCreate(req, res, next) {
  const { error, value } = promoCreateSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({ error: error.details.map((d) => d.message) });
  }
  req.body = value;
  next();
}

// Middleware для валидации
function validateDays(req, res, next) {
  const { error, value } = daysSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  // Передаём уже проверенное значение дальше
  req.body = value;
  next();
}

// Middleware для валидации
function validateReply(req, res, next) {
  const { error, value } = reportReplySchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  // Передаём уже проверенное значение дальше
  req.body = value;
  next();
}

function validatePromoCode(req, res, next) {
  const { error, value } = promoCodeSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  req.body = value;
  next();
}

const defaultFeturesConfig = {
  broadcast: true,
  subscriptions: true,
  promocodes: true,
  reports: true,
  referral: true,
  payments: true,
};

class AdminServer {
  constructor(
    bot,
    db,
    scheduleService,
    { customRoutes = [], port = 3105 } = {},
    feturesConfig = defaultFeturesConfig
  ) {
    this.bot = bot;
    this.db = db;
    this.port = port;
    this.scheduleService = scheduleService;
    this.adminApiKey = process.env.ADMIN_API_TOKEN;
    this.broadcastService = new BroadcastService(
      this.db,
      this.scheduleService,
      this.bot
    );
    this.userService = new UserService(this.db);
    this.reportService = new ReportService(this.db, this.bot);
    this.promocodeService = new PromocodeService(this.db);
    this.subscriptionService = new SubscriptionService(this.db);
    this.refferService = new RefferService(this.db);
    this.paymentService = new PaymentService(this.db);

    this.app = express();
    this.app.use(
      cors({
        origin: (origin, callback) => {
          callback(null, true);
        },
        credentials: true,
      })
    );

    this.app.use(bodyParser.json());

    this.app.use("/api", this.apiAuth.bind(this));

    this.registerRoutes(feturesConfig);
    this.registerCustomRoutes(customRoutes);
  }

  apiAuth(req, res, next) {
    const key =
      req.header("x-api-key") || req.header("authorization")?.split(" ")[1];
    if (key !== this.adminApiKey)
      return res.status(401).json({ error: "unauthorized" });
    next();
  }

  registerRoutes(config) {
    const app = this.app;

    // 1. Поиск пользователей + +
    app.get("/api/users", async (req, res) => {
      try {
        const q = String(req.query.query || "");
        const data = await this.userService.search(q);
        res.json(data);
      } catch (e) {
        res.status(500).json({ error: "Failed to search users" });
      }
    });

    // 1.1 Поиск пользователей + +
    app.get("/api/users/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const data = await this.userService.getById(id);
        res.json(data);
      } catch (e) {
        res.status(500).json({ error: "Failed to search users" });
      }
    });

    // + +
    app.get("/api/users/all", async (req, res) => {
      try {
        const data = await this.userService.getAll();
        res.json(data);
      } catch (e) {
        res.status(500).json({ error: "Failed to get users" });
      }
    });

    if (config.payments) {
      app.get("/api/payments", async (req, res) => {
        try {
          const data = await this.paymentService.getAllPayments();
          res.json(data);
        } catch (e) {
          res.status(500).json({ error: "Failed to get pyments" });
        }
      });

      app.get("/api/payments/stats", async (req, res) => {
        try {
          const data = await this.paymentService.getStats();
          res.json(data);
        } catch (e) {
          res.status(500).json({ error: "Failed to get pyments" });
        }
      });
    }

    if (config.subscriptions) {
      // 2. Продление подписки +
      app.post(
        "/api/users/:id/extend-subscription",
        validateDays,
        async (req, res) => {
          try {
            await this.userService.extendSubscription(
              req.params.id,
              req.body.days
            );
            res.json({ ok: true });
          } catch (e) {
            res.status(500).json({ error: "Failed to extend subscription" });
          }
        }
      );

      // 3. Активировать промо-подписку +
      app.post(
        "/api/users/:id/activate-promo-subscription",
        validateDays,
        async (req, res) => {
          try {
            await this.userService.activatePromo(req.params.id, req.body);
            res.json({ ok: true });
          } catch (e) {
            res
              .status(500)
              .json({ error: "Failed to activate promo subscription" });
          }
        }
      );

      // 4. Удалить подписку +
      app.delete("/api/users/:id/subscription", async (req, res) => {
        try {
          await this.userService.deleteSubscription(req.params.id);
          res.json({ ok: true });
        } catch (e) {
          res.status(500).json({ error: "Failed to delete subscription" });
        }
      });

      app.get("/api/subscriptions", async (req, res) => {
        try {
          let data = await this.subscriptionService.getAllSubscriptions();
          res.json(data);
        } catch (e) {
          res.status(500).json({ error: "Failed to extend subscription" });
        }
      });
    }

    if (config.reports) {
      // 5. Обращения пользователя +
      app.get("/api/users/:id/reports", async (req, res) => {
        try {
          const rows = await this.userService.getReports(req.params.id);
          res.json(rows);
        } catch (e) {
          res.status(500).json({ error: "Failed to get user reports" });
        }
      });

      // +
      app.get("/api/reports", async (req, res) => {
        try {
          const rows = await this.reportService.getAll();
          res.json(rows);
        } catch (e) {
          res.status(500).json({ error: "Failed to load reports" });
        }
      });

      // +
      app.get("/api/reports/:reportId", async (req, res) => {
        try {
          const { reportId } = req.params;
          console.log("here");
          const data = await this.reportService.getById(reportId);
          res.json(data);
        } catch (e) {
          console.log(e);
          res.status(500).json({ error: "Failed to load reports" });
        }
      });

      // 6. Ответ на обращение (через бота) +
      app.post(
        "/api/reports/:reportId/reply",
        validateReply,
        async (req, res) => {
          const reportId = req.params.reportId;
          const { text } = req.body;

          try {
            const report = await this.reportService.getById(reportId);

            if (!report) {
              return res.status(404).json({ error: "not found" });
            }

            await this.reportService.reply(report, text);

            res.json({ ok: true });
          } catch (e) {
            console.error("Send error", e);
            res.status(500).json({ error: "send_failed" });
          }
        }
      );
    }

    // 7. Статистика + +
    app.get("/api/stats", async (req, res) => {
      try {
        const rows = await this.userService.getStats();
        res.json(rows);
      } catch (e) {
        res.status(500).json({ error: "Failed to get statistics" });
      }
    });

    if (config.promocodes) {
      // 11. Добавить промокод пользователю + +
      app.post(
        "/api/users/:id/promocode",
        validatePromoCode,
        async (req, res) => {
          try {
            await this.userService.addPromocode(
              req.params.id,
              req.body.promoCode
            );
            res.json({ ok: true });
          } catch (e) {
            res.status(500).json({ error: "Failed to add promocode" });
          }
        }
      );

      app.post("/api/promocodes", validatePromoCreate, async (req, res) => {
        try {
          const promo = await this.promocodeService.create(req.body);
          res.status(201).json(promo);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // Удаление промокода
      app.delete("/api/promocodes/:code", async (req, res) => {
        try {
          const code = req.params.code;
          await this.promocodeService.delete(code);
          res.json({ ok: true, message: `Промокод ${code} удалён` });
        } catch (error) {
          res.status(404).json({ error: error.message });
        }
      });

      app.get("/api/promocodes", async (req, res) => {
        try {
          const promos = await this.promocodeService.getAll();
          res.json(promos);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
    }

    if (config.broadcast) {
      // Получить все рассылки (с возможным фильтром по статусу) + +
      app.get("/api/broadcasts", async (req, res) => {
        try {
          const broadcasts = await this.broadcastService.list(req.query.status);
          res.json(broadcasts);
        } catch (e) {
          res.status(500).json({ error: "Failed to get broadcasts" });
        }
      });

      // Получить одну рассылку по id +
      app.get("/api/broadcasts/:id", async (req, res) => {
        const broadcast = await this.broadcastService.get(req.params.id);
        if (!broadcast)
          return res.status(404).json({ error: "Broadcast not found" });
        res.json(broadcast);
      });

      // 8. Создать рассылку +
      app.post("/api/broadcasts", async (req, res) => {
        const { error, value } = broadcastValidationSchema.validate(req.body, {
          abortEarly: false,
        });

        if (error) {
          return res.status(400).json({
            error: "Validation error",
            details: error.details.map((d) => d.message),
          });
        }

        try {
          const b = await this.broadcastService.create(value);
          res.json(b);
        } catch (e) {
          res.status(500).json({ error: "Failed to create broadcast" });
        }
      });

      // 9. Тестовая рассылка + +
      app.post("/api/broadcasts/:id/send-test", async (req, res) => {
        const ok = await this.broadcastService.sendTest(req.params.id);
        if (!ok) return res.status(404).json({ error: "not found" });
        res.json({ ok: true });
      });

      // === Редактировать запланированную рассылку === +
      app.put("/api/broadcasts/:id", async (req, res) => {
        try {
          const updated = await this.broadcastService.update(
            req.params.id,
            req.body
          );
          if (!updated) return res.status(404).json({ error: "not found" });
          res.json(updated);
        } catch (error) {
          if (error.message === "cant modify") {
            return res.status(403).json({ error: "cant modify" });
          }
          res.status(500).json({ error: "Failed to update broadcast" });
        }
      });

      // === Удалить запланированную рассылку === + +
      app.delete("/api/broadcasts/:id", async (req, res) => {
        const ok = await this.broadcastService.delete(req.params.id);
        if (!ok) return res.status(404).json({ error: "not found" });
        res.json({ ok: true });
      });
    }

    if (config.referral) {
      // + +
      app.get("/api/reffers", async (req, res) => {
        try {
          const { query } = req.query;

          if (query) {
            const data = await this.refferService.countByLink(query);
            return res.json(data);
          }

          const data = await this.refferService.getAll();
          res.json(data);
        } catch (error) {
          res.status(500).json({ error: "Failed to get reffers" });
        }
      });
    }

    app.get("/api/config", async (req, res) => {
      return res.json(config);
    });
  }

  registerCustomRoutes(customRoutes) {
    for (const route of customRoutes) {
      // route = { method, path, handler }
      const { method, path, handler } = route;
      this.app[method](path, async (req, res, next) => {
        try {
          await handler(req, res, next, this.bot, this.db);
        } catch (err) {
          console.error("Custom route error:", err);
          res.status(500).json({ error: "internal_error" });
        }
      });
    }
  }

  /** Запуск сервера */
  start() {
    this.app.listen(this.port, () =>
      console.log(`✅ Admin server listening on :${this.port}`)
    );
  }
}

module.exports = { AdminServer };
