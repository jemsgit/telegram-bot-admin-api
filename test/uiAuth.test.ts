import { describe, it, expect } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";

import { createUiAuthRouter, safeEqual } from "../src/http/uiAuth";

function mount(
  router: ReturnType<typeof createUiAuthRouter>,
): Promise<{ url: string; close: () => void }> {
  const app = express();
  app.use(express.json());
  app.use("/ui", router);
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => server.close(),
      });
    });
  });
}

const post = (url: string, body: unknown) =>
  fetch(`${url}/ui/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("safeEqual", () => {
  it("true на равных, false на разных (в т.ч. разной длины)", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcdef")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("createUiAuthRouter — троттлинг", () => {
  it("блокирует после perIpMax неудач (429 + Retry-After)", async () => {
    const router = createUiAuthRouter(
      { token: "T" },
      { perIpMax: 3, globalMax: 100, failDelayMs: 0, windowMs: 60_000 },
    );
    const { url, close } = await mount(router);
    try {
      for (let i = 0; i < 3; i++) {
        expect((await post(url, { token: "bad" })).status).toBe(401);
      }
      const blocked = await post(url, { token: "bad" });
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("retry-after")).toBeTruthy();
      // даже верный токен теперь не проходит — IP в локауте
      expect((await post(url, { token: "T" })).status).toBe(429);
    } finally {
      close();
    }
  });

  it("успешный вход сбрасывает счётчик неудач по IP", async () => {
    const router = createUiAuthRouter(
      { token: "T" },
      { perIpMax: 3, globalMax: 100, failDelayMs: 0, windowMs: 60_000 },
    );
    const { url, close } = await mount(router);
    try {
      await post(url, { token: "bad" });
      await post(url, { token: "bad" });
      expect((await post(url, { token: "T" })).status).toBe(200);
      // счётчик сброшен — снова доступno 3 попытки
      await post(url, { token: "bad" });
      await post(url, { token: "bad" });
      expect((await post(url, { token: "bad" })).status).toBe(401);
    } finally {
      close();
    }
  });

  it("globalMax — бэкстоп когда IP один (за прокси)", async () => {
    const router = createUiAuthRouter(
      { token: "T" },
      { perIpMax: 1000, globalMax: 2, failDelayMs: 0, windowMs: 60_000 },
    );
    const { url, close } = await mount(router);
    try {
      expect((await post(url, { token: "bad" })).status).toBe(401);
      expect((await post(url, { token: "bad" })).status).toBe(401);
      expect((await post(url, { token: "bad" })).status).toBe(429);
    } finally {
      close();
    }
  });
});
