import type { AdminServices } from "../types";
import type { FeatureName } from "../config";
import {
  validatePromoCreate,
  validateDays,
  validateReply,
  validatePromoCode,
  broadcastValidationSchema,
} from "../validators";
import { HttpError, type RouteDef } from "./http";

type RoutesFactory = (services: AdminServices) => RouteDef[];

/** Роуты, доступные всегда: пользователи + статистика. */
export const coreRoutes: RoutesFactory = (s) => [
  {
    method: "get",
    path: "/users",
    handler: (req) => s.userService.search(String(req.query.query || "")),
  },
  // до /users/:id — иначе Express матчит "all" как id
  { method: "get", path: "/users/all", handler: () => s.userService.getAll() },
  {
    method: "get",
    path: "/users/:id",
    handler: (req) => s.userService.getById(req.params.id),
  },
  { method: "get", path: "/stats", handler: () => s.userService.getStats() },
];

export const featureRoutes: Record<FeatureName, RoutesFactory> = {
  subscriptions: (s) => [
    {
      method: "post",
      path: "/users/:id/extend-subscription",
      validate: validateDays,
      handler: async (req) => {
        await s.userService.extendSubscription(req.params.id, req.body.days);
        return { ok: true };
      },
    },
    {
      method: "post",
      path: "/users/:id/activate-promo-subscription",
      validate: validateDays,
      handler: async (req) => {
        await s.userService.activatePromo(req.params.id, req.body);
        return { ok: true };
      },
    },
    {
      method: "delete",
      path: "/users/:id/subscription",
      handler: async (req) => {
        await s.userService.deleteSubscription(req.params.id);
        return { ok: true };
      },
    },
    {
      method: "get",
      path: "/subscriptions",
      handler: () => s.subscriptionService.getAllSubscriptions(),
    },
  ],

  reports: (s) => [
    {
      method: "get",
      path: "/users/:id/reports",
      handler: (req) => s.userService.getReports(req.params.id),
    },
    {
      method: "get",
      path: "/reports",
      handler: () => s.reportService.getAll(),
    },
    {
      method: "get",
      path: "/reports/:reportId",
      handler: (req) => s.reportService.getById(req.params.reportId),
    },
    {
      method: "post",
      path: "/reports/:reportId/reply",
      validate: validateReply,
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
      validate: validatePromoCode,
      handler: async (req) => {
        await s.userService.addPromocode(req.params.id, req.body.promoCode);
        return { ok: true };
      },
    },
    {
      method: "post",
      path: "/promocodes",
      validate: validatePromoCreate,
      successStatus: 201,
      handler: (req) => s.promocodeService.create(req.body),
    },
    {
      method: "delete",
      path: "/promocodes/:code",
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
      handler: () => s.promocodeService.getAll(),
    },
  ],

  broadcast: (s) => [
    {
      method: "get",
      path: "/broadcasts",
      handler: (req) =>
        s.broadcastService.list(req.query.status as string | undefined),
    },
    {
      method: "get",
      path: "/broadcasts/:id",
      handler: async (req) => {
        const b = await s.broadcastService.get(req.params.id);
        if (!b) throw new HttpError(404, "Broadcast not found");
        return b;
      },
    },
    {
      method: "post",
      path: "/broadcasts",
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
      handler: async (req) => {
        const ok = await s.broadcastService.sendTest(req.params.id);
        if (!ok) throw new HttpError(404, "not found");
        return { ok: true };
      },
    },
    {
      method: "put",
      path: "/broadcasts/:id",
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
      { method: "get", path: "/referrals", handler },
      { method: "get", path: "/reffers", handler },
    ];
  },

  payments: (s) => [
    {
      method: "get",
      path: "/payments",
      handler: () => s.paymentService.getAllPayments(),
    },
    {
      method: "get",
      path: "/payments/stats",
      handler: () => s.paymentService.getStats(),
    },
  ],

  postcontentAd: (s) => [
    { method: "get", path: "/ads", handler: () => s.postContentService.list() },
    {
      method: "get",
      path: "/ads/:id",
      handler: async (req) => {
        const ad = await s.postContentService.get(req.params.id);
        if (!ad) throw new HttpError(404, "not found");
        return ad;
      },
    },
    {
      method: "post",
      path: "/ads",
      handler: (req) => s.postContentService.create(req.body),
    },
    {
      method: "patch",
      path: "/ads/:id",
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
      handler: async (req) => {
        const ok = await s.postContentService.delete(req.params.id);
        return { ok };
      },
    },
  ],
};
