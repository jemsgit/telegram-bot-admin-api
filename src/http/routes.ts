import type { AdminServices } from "../types";
import type { FeatureName } from "../config";
import {
  validatePromoCreate,
  validateDays,
  validateReply,
  validatePromoCode,
  broadcastValidationSchema,
  daysSchema,
  reportReplySchema,
  promoCodeSchema,
  promoCreateSchema,
} from "../validators";
import { HttpError, type RouteDef } from "./http";

type RoutesFactory = (services: AdminServices) => RouteDef[];

/** Роуты, доступные всегда: пользователи + статистика. */
export const coreRoutes: RoutesFactory = (s) => [
  {
    method: "get",
    path: "/users",
    summary: "Поиск пользователей",
    tags: ["users"],
    handler: (req) => s.userService.search(String(req.query.query || "")),
  },
  // до /users/:id — иначе Express матчит "all" как id
  {
    method: "get",
    path: "/users/all",
    summary: "Все пользователи",
    tags: ["users"],
    handler: () => s.userService.getAll(),
  },
  {
    method: "get",
    path: "/users/:id",
    summary: "Пользователь по ID",
    tags: ["users"],
    handler: (req) => s.userService.getById(req.params.id),
  },
  {
    method: "get",
    path: "/stats",
    summary: "Общая статистика",
    tags: ["stats"],
    handler: () => s.userService.getStats(),
  },
];

export const featureRoutes: Record<FeatureName, RoutesFactory> = {
  subscriptions: (s) => [
    {
      method: "post",
      path: "/users/:id/extend-subscription",
      summary: "Продлить подписку пользователя",
      tags: ["subscriptions"],
      validate: validateDays,
      bodySchema: daysSchema,
      handler: async (req) => {
        await s.userService.extendSubscription(req.params.id, req.body.days);
        return { ok: true };
      },
    },
    {
      method: "post",
      path: "/users/:id/activate-promo-subscription",
      summary: "Активировать подписку по промокоду",
      tags: ["subscriptions"],
      validate: validateDays,
      bodySchema: daysSchema,
      handler: async (req) => {
        await s.userService.activatePromo(req.params.id, req.body);
        return { ok: true };
      },
    },
    {
      method: "delete",
      path: "/users/:id/subscription",
      summary: "Удалить подписку пользователя",
      tags: ["subscriptions"],
      handler: async (req) => {
        await s.userService.deleteSubscription(req.params.id);
        return { ok: true };
      },
    },
    {
      method: "get",
      path: "/subscriptions",
      summary: "Все подписки",
      tags: ["subscriptions"],
      handler: () => s.subscriptionService.getAllSubscriptions(),
    },
  ],

  reports: (s) => [
    {
      method: "get",
      path: "/users/:id/reports",
      summary: "Обращения пользователя",
      tags: ["reports"],
      handler: (req) => s.userService.getReports(req.params.id),
    },
    {
      method: "get",
      path: "/reports",
      summary: "Все обращения",
      tags: ["reports"],
      handler: () => s.reportService.getAll(),
    },
    {
      method: "get",
      path: "/reports/:reportId",
      summary: "Обращение по ID",
      tags: ["reports"],
      handler: (req) => s.reportService.getById(req.params.reportId),
    },
    {
      method: "post",
      path: "/reports/:reportId/reply",
      summary: "Ответить на обращение",
      tags: ["reports"],
      validate: validateReply,
      bodySchema: reportReplySchema,
      handler: async (req) => {
        const report = await s.reportService.getById(req.params.reportId);
        if (!report) throw new HttpError(404, "not found");
        await s.reportService.reply(report, req.body.text);
        return { ok: true };
      },
    },
  ],

  promocodes: (s) => [
    {
      method: "post",
      path: "/users/:id/promocode",
      summary: "Выдать промокод пользователю",
      tags: ["promocodes"],
      validate: validatePromoCode,
      bodySchema: promoCodeSchema,
      handler: async (req) => {
        await s.userService.addPromocode(req.params.id, req.body.promoCode);
        return { ok: true };
      },
    },
    {
      method: "post",
      path: "/promocodes",
      summary: "Создать промокод",
      tags: ["promocodes"],
      validate: validatePromoCreate,
      bodySchema: promoCreateSchema,
      successStatus: 201,
      handler: (req) => s.promocodeService.create(req.body),
    },
    {
      method: "delete",
      path: "/promocodes/:code",
      summary: "Удалить промокод",
      tags: ["promocodes"],
      handler: async (req) => {
        const { code } = req.params;
        const deleted = await s.promocodeService.delete(code);
        if (!deleted) throw new HttpError(404, `Промокод ${code} не найден`);
        return { ok: true, message: `Промокод ${code} удалён` };
      },
    },
    {
      method: "get",
      path: "/promocodes",
      summary: "Все промокоды",
      tags: ["promocodes"],
      handler: () => s.promocodeService.getAll(),
    },
  ],

  // Валидация на POST/PUT ниже — инлайн (`broadcastValidationSchema.validate(...)`
  // в хендлере), не через `validate:` миддлвар, как у остальных фич — известная
  // непоследовательность (см. IMPROVEMENTS.md, п. 8), не трогаем в рамках этой
  // задачи. `bodySchema` подставлен для документации несмотря на это.
  broadcast: (s) => [
    {
      method: "get",
      path: "/broadcasts",
      summary: "Список рассылок",
      tags: ["broadcast"],
      handler: (req) =>
        s.broadcastService.list(req.query.status as string | undefined),
    },
    {
      method: "get",
      path: "/broadcasts/:id",
      summary: "Рассылка по ID",
      tags: ["broadcast"],
      handler: async (req) => {
        const b = await s.broadcastService.get(req.params.id);
        if (!b) throw new HttpError(404, "Broadcast not found");
        return b;
      },
    },
    {
      method: "post",
      path: "/broadcasts",
      summary: "Создать рассылку",
      tags: ["broadcast"],
      bodySchema: broadcastValidationSchema,
      handler: (req) => {
        const { error, value } = broadcastValidationSchema.validate(req.body, {
          abortEarly: false,
        });
        if (error) {
          throw new HttpError(
            400,
            "Validation error",
            error.details.map((d) => d.message),
          );
        }
        return s.broadcastService.create(value);
      },
    },
    {
      method: "post",
      path: "/broadcasts/:id/send-test",
      summary: "Отправить тестовую рассылку админу",
      tags: ["broadcast"],
      handler: async (req) => {
        const ok = await s.broadcastService.sendTest(req.params.id);
        if (!ok) throw new HttpError(404, "not found");
        return { ok: true };
      },
    },
    {
      method: "put",
      path: "/broadcasts/:id",
      summary: "Обновить рассылку",
      tags: ["broadcast"],
      bodySchema: broadcastValidationSchema,
      handler: async (req) => {
        const { error, value } = broadcastValidationSchema.validate(req.body, {
          abortEarly: false,
        });
        if (error) {
          throw new HttpError(
            400,
            "Validation error",
            error.details.map((d) => d.message),
          );
        }
        try {
          const updated = await s.broadcastService.update(
            req.params.id,
            value as unknown as Record<string, unknown>,
          );
          if (!updated) throw new HttpError(404, "not found");
          return updated;
        } catch (e) {
          if (e instanceof Error && e.message === "cant modify") {
            throw new HttpError(403, "cant modify");
          }
          throw e;
        }
      },
    },
    {
      method: "delete",
      path: "/broadcasts/:id",
      summary: "Удалить рассылку",
      tags: ["broadcast"],
      handler: async (req) => {
        const ok = await s.broadcastService.delete(req.params.id);
        if (!ok) throw new HttpError(404, "not found");
        return { ok: true };
      },
    },
  ],

  referral: (s) => {
    const handler = (req: { query: Record<string, unknown> }) => {
      const query =
        (req.query.query as string | undefined) ??
        (req.query.link as string | undefined);
      return query
        ? s.refferService.countByLink(query)
        : s.refferService.getAll();
    };
    return [
      // основной путь по README; /reffers оставлен как алиас
      {
        method: "get",
        path: "/referrals",
        summary: "Рефералы (все или по ссылке)",
        tags: ["referral"],
        handler,
      },
      {
        method: "get",
        path: "/reffers",
        summary: "Алиас /referrals",
        tags: ["referral"],
        handler,
      },
    ];
  },

  payments: (s) => [
    {
      method: "get",
      path: "/payments",
      summary: "Все платежи",
      tags: ["payments"],
      handler: () => s.paymentService.getAllPayments(),
    },
    {
      method: "get",
      path: "/payments/stats",
      summary: "Статистика платежей",
      tags: ["payments"],
      handler: () => s.paymentService.getStats(),
    },
  ],

  postcontentAd: (s) => [
    {
      method: "get",
      path: "/ads",
      summary: "Список рекламных объявлений",
      tags: ["postcontentAd"],
      handler: () => s.postContentService.list(),
    },
    {
      method: "get",
      path: "/ads/:id",
      summary: "Объявление по ID",
      tags: ["postcontentAd"],
      handler: async (req) => {
        const ad = await s.postContentService.get(req.params.id);
        if (!ad) throw new HttpError(404, "not found");
        return ad;
      },
    },
    {
      method: "post",
      path: "/ads",
      summary: "Создать объявление",
      tags: ["postcontentAd"],
      handler: (req) => s.postContentService.create(req.body),
    },
    {
      method: "patch",
      path: "/ads/:id",
      summary: "Обновить объявление",
      tags: ["postcontentAd"],
      handler: async (req) => {
        const updated = await s.postContentService.update(
          req.params.id,
          req.body,
        );
        if (!updated) throw new HttpError(404, "not found");
        return updated;
      },
    },
    {
      method: "delete",
      path: "/ads/:id",
      summary: "Удалить объявление",
      tags: ["postcontentAd"],
      handler: async (req) => {
        const ok = await s.postContentService.delete(req.params.id);
        return { ok };
      },
    },
  ],
};
