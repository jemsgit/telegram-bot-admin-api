import { describe, it, expect, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import { Telegraf } from "telegraf";

import { createMemoryStore } from "../src/memoryStore";
import { validateStore, STORE_CONTRACT } from "../src/stores";
import { createAdmin, type AdminHandle } from "../src/createAdmin";

let handle: AdminHandle | undefined;
afterEach(async () => {
  await handle?.stopHttp();
  handle = undefined;
});

const adapters = {
  broadcast: {
    scheduler: {
      scheduleBroadcast: async () => {},
      rescheduleBroadcast: async () => true,
      cancelBroadcast: async () => {},
    },
    sendTest: () => {},
  },
  reports: { replyToUser: () => {} },
};

describe("createMemoryStore", () => {
  it("удовлетворяет контракту всех фич", () => {
    const allFeatures = Object.fromEntries(
      Object.keys(STORE_CONTRACT)
        .filter((k) => k !== "users")
        .map((k) => [k, true]),
    );
    expect(() => validateStore(createMemoryStore(), allFeatures)).not.toThrow();
  });

  it("работает как db в createAdmin (HTTP + бот)", async () => {
    const db = createMemoryStore({
      users: [
        { userId: 1, username: "alice", active: true },
        { userId: 2, username: "bob", active: false },
      ],
      promocodes: [
        {
          code: "WELCOME",
          discountPercent: 10,
          activeFrom: new Date(),
          activeTo: new Date(),
          isActive: true,
          segments: [],
        },
      ],
    });

    const bot = new Telegraf("12345:TEST");
    handle = createAdmin({
      bot,
      admins: [1],
      db,
      adapters,
      http: { enabled: true, port: 0, token: "t" },
    });
    const server = handle.startHttp()!;
    const { port } = server.address() as AddressInfo;
    const api = (p: string) =>
      fetch(`http://127.0.0.1:${port}${p}`, {
        headers: { "x-api-key": "t" },
      });

    expect(await (await api("/api/users/all")).json()).toHaveLength(2);
    expect(await (await api("/api/users/1")).json()).toMatchObject({
      username: "alice",
    });
    expect(await (await api("/api/promocodes")).json()).toHaveLength(1);
    expect(await (await api("/api/stats")).json()).toEqual({
      totalUsers: 2,
      activeUsers: 1,
    });
  });

  it("extendSubscription/deleteSubscription меняют состояние", async () => {
    const db = createMemoryStore({ users: [{ userId: 5, active: true }] });
    expect(await db.extendSubscription!(5, 30)).toBe(true);
    const u = await db.findUserById(5);
    expect(u?.subscription?.activeUntil).toBeInstanceOf(Date);
    expect(await db.deleteSubscription!(5)).toBe(true);
    expect((await db.findUserById(5))?.subscription).toBeNull();
  });
});
