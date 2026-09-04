import { describe, it, expect } from "vitest";
import { Telegraf } from "telegraf";

import { validateStore } from "../src/stores";
import { createAdmin } from "../src/createAdmin";
import type { UserStore } from "../src/stores";

const userStore: UserStore = {
  findUsersByQuery: async () => [],
  findUserById: async () => null,
  getUsers: async () => [],
  getUserStats: async () => ({}),
};

describe("validateStore", () => {
  it("проходит для минимального стора без опциональных фич", () => {
    expect(() => validateStore(userStore, {})).not.toThrow();
  });

  it("бросает со списком недостающих методов включённой фичи", () => {
    try {
      validateStore(userStore, { broadcast: true, promocodes: true });
      throw new Error("должно было бросить");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("broadcast.getAllBroadcasts");
      expect(msg).toContain("promocodes.createPromoCode");
      expect(msg).not.toContain("payments.");
    }
  });

  it("бросает, если не хватает метода из обязательного users", () => {
    const partial = { findUsersByQuery: async () => [] };
    expect(() => validateStore(partial, {})).toThrow(/users\.getUserStats/);
  });
});

describe("createAdmin + validateStore", () => {
  it("бот, которому нужны только пользователи, подключается с минимальным db", () => {
    const bot = new Telegraf("12345:TEST");
    expect(() =>
      createAdmin({
        bot,
        admins: [1],
        db: userStore,
        features: {
          broadcast: false,
          subscriptions: false,
          promocodes: false,
          reports: false,
          referral: false,
          payments: false,
          postcontentAd: false,
        },
      }),
    ).not.toThrow();
  });

  it("падает при включённой фиче без методов стора", () => {
    const bot = new Telegraf("12345:TEST");
    expect(() =>
      createAdmin({
        bot,
        admins: [1],
        db: userStore,
        features: { payments: true },
      }),
    ).toThrow(/payments\.getAllPayments/);
  });
});
