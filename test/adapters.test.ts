import { describe, it, expect, vi } from "vitest";

import { applyAdapterGating, resolveFeatures } from "../src/config";
import { buildAdminServices } from "../src/services/buildServices";
import { makeFakeDb } from "./helpers/fakeDb";

describe("applyAdapterGating", () => {
  it("гасит broadcast/reports без адаптеров", () => {
    const warn = vi.fn();
    const out = applyAdapterGating(resolveFeatures(), undefined, warn);
    expect(out.broadcast).toBe(false);
    expect(out.reports).toBe(false);
    expect(out.promocodes).toBe(true);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("оставляет фичи, для которых адаптеры переданы", () => {
    const warn = vi.fn();
    const out = applyAdapterGating(
      resolveFeatures(),
      {
        broadcast: {
          scheduler: {
            scheduleBroadcast: () => {},
            rescheduleBroadcast: () => true,
            cancelBroadcast: () => {},
          },
          sendTest: () => {},
        },
        reports: { replyToUser: () => {} },
      },
      warn,
    );
    expect(out.broadcast).toBe(true);
    expect(out.reports).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("сервисы используют адаптеры по фичам", () => {
  it("broadcastService.sendTest зовёт adapters.broadcast.sendTest", async () => {
    const sendTest = vi.fn();
    const services = buildAdminServices({
      db: makeFakeDb({ getBroadcast: async () => ({ id: "b1" }) as never }),
      adapters: {
        broadcast: {
          scheduler: {
            scheduleBroadcast: () => {},
            rescheduleBroadcast: () => true,
            cancelBroadcast: () => {},
          },
          sendTest,
        },
      },
    });
    await services.broadcastService.sendTest("b1");
    expect(sendTest).toHaveBeenCalledWith({ id: "b1" });
  });

  it("reportService.reply зовёт adapters.reports.replyToUser(userId, replyText, originalText)", async () => {
    const replyToUser = vi.fn();
    const services = buildAdminServices({
      db: makeFakeDb(),
      adapters: { reports: { replyToUser } },
    });
    await services.reportService.reply(
      {
        userId: 5,
        message: "исходное",
        adminReply: "",
        done: false,
        _id: "r1",
      },
      "ответ",
    );
    expect(replyToUser).toHaveBeenCalledWith(5, "ответ", "исходное");
  });

  it("broadcastService.sendTest без адаптера бросает понятную ошибку", async () => {
    const services = buildAdminServices({
      db: makeFakeDb({ getBroadcast: async () => ({ id: "b1" }) as never }),
    });
    await expect(services.broadcastService.sendTest("b1")).rejects.toThrow(
      /adapters\.broadcast/,
    );
  });
});
