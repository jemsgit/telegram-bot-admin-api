import { describe, it, expect, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import { Telegraf } from "telegraf";

import { createAdmin, type AdminHandle } from "../src/createAdmin";
import { makeFakeDb } from "./helpers/fakeDb";

let handle: AdminHandle | undefined;
afterEach(async () => {
  await handle?.stopHttp();
  handle = undefined;
});

const scheduler = {
  scheduleBroadcast: async () => {},
  rescheduleBroadcast: async () => true,
  cancelBroadcast: async () => {},
};

function start(opts: {
  db?: Parameters<typeof makeFakeDb>[0];
  features?: Record<string, boolean>;
  customRoutes?: unknown[];
}) {
  const bot = new Telegraf("12345:TEST");
  handle = createAdmin({
    bot,
    admins: [1],
    db: makeFakeDb(opts.db),
    adapters: {
      broadcast: { scheduler, sendTest: () => {} },
      reports: { replyToUser: () => {} },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    features: opts.features as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    http: {
      enabled: true,
      port: 0,
      token: "t",
      customRoutes: opts.customRoutes as any,
    },
  });
  const server = handle.startHttp()!;
  const { port } = server.address() as AddressInfo;
  const api = (path: string, init?: RequestInit) =>
    fetch(`http://127.0.0.1:${port}${path}`, {
      ...init,
      headers: {
        "x-api-key": "t",
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  api.raw = (path: string) => fetch(`http://127.0.0.1:${port}${path}`);
  return api;
}

describe("HTTP роуты из дескрипторов", () => {
  it("/health доступен без токена", async () => {
    const api = start({});
    const r = await api.raw("/health");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });

  it("нет токена -> AdminServer бросает при старте", () => {
    const bot = new Telegraf("12345:TEST");
    expect(() =>
      createAdmin({
        bot,
        admins: [1],
        db: makeFakeDb(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        http: { enabled: true, port: 0 } as any,
      }).startHttp(),
    ).toThrow(/token/i);
  });

  it("core: /users, /users/all, /users/:id, /stats", async () => {
    const api = start({
      db: {
        getUsers: async () => [{ userId: 1 }, { userId: 2 }],
        findUserById: async () => ({ userId: 7 }),
        getUserStats: async () => ({ total: 3 }),
      },
    });
    expect(await (await api("/api/users/all")).json()).toHaveLength(2);
    expect(await (await api("/api/users/7")).json()).toEqual({ userId: 7 });
    expect(await (await api("/api/stats")).json()).toEqual({ total: 3 });
    expect((await api("/api/users?query=x")).status).toBe(200);
  });

  it("гейтинг фич: выключенная фича не регистрирует роут (404)", async () => {
    const api = start({ features: { payments: false, broadcast: true } });
    expect((await api("/api/payments")).status).toBe(404);
    expect((await api("/api/broadcasts")).status).toBe(200);
  });

  it("referral: /api/referrals (README) и /api/reffers (алиас)", async () => {
    const api = start({
      db: { getRefferals: async () => [{ refLink: "a", count: 2 }] },
    });
    expect(await (await api("/api/referrals")).json()).toEqual([
      { refLink: "a", count: 2 },
    ]);
    expect((await api("/api/reffers")).status).toBe(200);
  });

  it("promocodes POST -> 201", async () => {
    const api = start({
      db: { createPromoCode: async (d) => ({ ...d, isActive: true }) },
    });
    const res = await api("/api/promocodes", {
      method: "POST",
      body: JSON.stringify({
        code: "A",
        discountPercent: 10,
        activeFrom: "2025-01-01",
        activeTo: "2025-02-01",
      }),
    });
    expect(res.status).toBe(201);
  });

  it("broadcasts POST -> 400 с details при невалидном теле", async () => {
    const api = start({});
    const res = await api("/api/broadcasts", {
      method: "POST",
      body: JSON.stringify({ type: "photo" }), // нет mediaUrl
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation error");
    expect(Array.isArray(body.details)).toBe(true);
  });

  it("404 из хендлера: /broadcasts/:id несуществующий", async () => {
    const api = start({ db: { getBroadcast: async () => null } });
    const res = await api("/api/broadcasts/nope");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Broadcast not found");
  });

  it("500 при неожиданной ошибке сервиса", async () => {
    const api = start({
      db: {
        getUserStats: async () => {
          throw new Error("boom");
        },
      },
    });
    const res = await api("/api/stats");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal_error" });
  });

  it("кастомный роут + /api/config отдаёт его UI-схему", async () => {
    const api = start({
      customRoutes: [
        {
          method: "get",
          path: "/api/custom/ping",
          handler: (_req: unknown, res: { json: (v: unknown) => void }) =>
            res.json({ pong: true }),
          ui: { description: "ping", fields: [] },
        },
      ],
    });
    expect(await (await api("/api/custom/ping")).json()).toEqual({
      pong: true,
    });

    const config = await (await api("/api/config")).json();
    expect(config.customRoutesConfig).toEqual([
      {
        url: "/api/custom/ping",
        method: "get",
        description: "ping",
        fields: [],
      },
    ]);
  });

  it("кастомный роут без префикса /api монтируется под /api и под авторизацией", async () => {
    const api = start({
      customRoutes: [
        {
          method: "post",
          path: "users/:id/rights", // без /api и без ведущего слэша
          handler: (
            req: { params: { id: string }; body: { right: string } },
            res: { json: (v: unknown) => void },
            _next: unknown,
            _bot: unknown,
            db: { addUserRight: (id: string, r: string) => Promise<void> },
          ) =>
            db
              .addUserRight(req.params.id, req.body.right)
              .then(() => res.json({ ok: true })),
        },
      ],
      db: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        addUserRight: (async () => {}) as any,
      },
    });

    // смонтирован по /api/users/:id/rights
    const ok = await api("/api/users/5/rights", {
      method: "POST",
      body: JSON.stringify({ right: "admin" }),
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });

    // без токена — 401 (значит под apiAuth)
    const noAuth = await api.raw("/api/users/5/rights");
    expect(noAuth.status).toBe(401);
  });

  it("кастомный роут: validate-миддлвар отсекает плохой запрос", async () => {
    const api = start({
      customRoutes: [
        {
          method: "post",
          path: "/api/guarded",
          validate: (
            req: { body: { name?: string } },
            res: { status: (c: number) => { json: (v: unknown) => void } },
            next: () => void,
          ) =>
            req.body.name
              ? next()
              : res.status(422).json({ error: "name required" }),
          handler: (_req: unknown, res: { json: (v: unknown) => void }) =>
            res.json({ ok: true }),
        },
      ],
    });

    expect(
      (await api("/api/guarded", { method: "POST", body: "{}" })).status,
    ).toBe(422);
    expect(
      (
        await api("/api/guarded", {
          method: "POST",
          body: JSON.stringify({ name: "x" }),
        })
      ).status,
    ).toBe(200);
  });
});
