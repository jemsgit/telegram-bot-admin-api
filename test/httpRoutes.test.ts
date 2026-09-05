import { describe, it, expect, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import { Telegraf } from "telegraf";

import { createAdmin, type AdminHandle } from "../src/createAdmin";
import { resolveUiDir } from "../src/http/uiStatic";
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
  ui?: { enabled?: boolean; auth?: { username: string; password: string } };
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
    http: {
      enabled: true,
      port: 0,
      token: "t",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customRoutes: opts.customRoutes as any,
      ui: opts.ui,
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
  api.raw = (path: string, init?: RequestInit) =>
    fetch(`http://127.0.0.1:${port}${path}`, init);
  return api;
}

describe("GET /api/openapi.json", () => {
  it("отдаётся под тем же токеном, что и остальной /api/*", async () => {
    const api = start({});
    expect((await api.raw("/api/openapi.json")).status).toBe(401);

    const res = await api("/api/openapi.json");
    expect(res.status).toBe(200);
    const doc = await res.json();
    expect(doc.openapi).toBe("3.0.3");
    expect(doc.paths["/api/users"].get).toBeDefined();
  });

  it("не включает customRoutes бота (они описываются через ui-schema)", async () => {
    const api = start({
      customRoutes: [
        {
          method: "get",
          path: "/api/custom/ping",
          handler: (_req: unknown, res: { json: (v: unknown) => void }) =>
            res.json({ pong: true }),
        },
      ],
    });
    const doc = await (await api("/api/openapi.json")).json();
    expect(doc.paths["/api/custom/ping"]).toBeUndefined();
  });
});

describe("standalone-UI (http.ui.enabled)", () => {
  it("выключен по умолчанию — GET / ничего не отдаёт (404)", async () => {
    const api = start({});
    const r = await api.raw("/");
    expect(r.status).toBe(404);
  });

  it("включён — не ломает /api/*, GET / отдаёт бандл если он собран", async () => {
    const api = start({ ui: { enabled: true } });
    // /api/* по-прежнему работает и по-прежнему требует токен
    expect((await api.raw("/api/stats")).status).toBe(401);
    expect((await api("/api/stats")).status).toBe(200);

    const root = await api.raw("/");
    const uiBuilt = resolveUiDir() !== null;
    if (uiBuilt) {
      expect(root.status).toBe(200);
      expect(root.headers.get("content-type")).toContain("text/html");
      expect(await root.text()).toContain("<div id=\"root\">");
    } else {
      // lib/ui не собран в этом окружении (напр. свежий чекаут без `ui` build) —
      // опция не должна ронять сервер, просто отдавать 404 на /.
      expect(root.status).toBe(404);
    }
  });
});

describe("UI-логин (/ui/*)", () => {
  it("token-режим по умолчанию: /ui/login отдаёт http.token на верный токен", async () => {
    const api = start({ ui: { enabled: true } });

    const cfg = await (await api.raw("/ui/config")).json();
    expect(cfg.loginMode).toBe("token");

    const bad = await api.raw("/ui/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "wrong" }),
    });
    expect(bad.status).toBe(401);

    const ok = await api.raw("/ui/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "t" }),
    });
    expect(ok.status).toBe(200);
    const { token } = await ok.json();
    expect(token).toBe("t");

    // выданный токен реально работает на /api/*
    const stats = await api.raw("/api/stats", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(stats.status).toBe(200);
  });

  it("password-режим: сверяет оба поля, возвращает http.token", async () => {
    const api = start({
      ui: { enabled: true, auth: { username: "admin", password: "s3cret" } },
    });

    const cfg = await (await api.raw("/ui/config")).json();
    expect(cfg.loginMode).toBe("password");

    const wrongUser = await api.raw("/ui/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "nope", password: "s3cret" }),
    });
    expect(wrongUser.status).toBe(401);

    const wrongPass = await api.raw("/ui/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "nope" }),
    });
    expect(wrongPass.status).toBe(401);

    const ok = await api.raw("/ui/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "s3cret" }),
    });
    expect(ok.status).toBe(200);
    expect((await ok.json()).token).toBe("t");
  });

  it("createAdmin бросает на пустых username/password в http.ui.auth", () => {
    const bot = new Telegraf("12345:TEST");
    expect(() =>
      createAdmin({
        bot,
        admins: [1],
        db: makeFakeDb(),
        http: {
          enabled: true,
          port: 0,
          token: "t",
          ui: { enabled: true, auth: { username: "", password: "x" } },
        },
      }).startHttp(),
    ).toThrow(/username и password/);
  });

  it("/ui/* не монтируется без ui.enabled", async () => {
    const api = start({});
    expect((await api.raw("/ui/config")).status).toBe(404);
  });
});

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
        kind: "list",
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
