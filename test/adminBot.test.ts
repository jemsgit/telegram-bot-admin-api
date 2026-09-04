import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Telegraf, Telegram } from "telegraf";

import { createAdmin } from "../src/createAdmin";
import { makeFakeDb } from "./helpers/fakeDb";

type ApiCall = { method: string; payload: Record<string, unknown> };

let calls: ApiCall[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const realCallApi = (Telegram.prototype as any).callApi;

beforeEach(() => {
  calls = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Telegram.prototype as any).callApi = async (
    method: string,
    payload: any,
  ) => {
    calls.push({ method, payload: payload ?? {} });
    if (method === "getMe")
      return { id: 1, is_bot: true, username: "test_bot", first_name: "t" };
    return { message_id: Math.floor(Math.random() * 1e6) };
  };
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Telegram.prototype as any).callApi = realCallApi;
});

const sentTexts = () =>
  calls
    .filter((c) => c.method === "sendMessage")
    .map((c) => String(c.payload.text));

const lastKeyboardButtons = (): string[] => {
  const withKb = [...calls].reverse().find(
    (c) =>
      c.method === "sendMessage" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c.payload.reply_markup as any)?.keyboard,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kb = (withKb?.payload.reply_markup as any)?.keyboard as
    string[][] | undefined;
  return kb ? kb.flat() : [];
};

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

function textUpdate(userId: number, text: string) {
  const entities = text.startsWith("/")
    ? [{ type: "bot_command", offset: 0, length: text.split(/\s/)[0].length }]
    : undefined;
  return {
    update_id: Math.floor(Math.random() * 1e9),
    message: {
      message_id: Math.floor(Math.random() * 1e9),
      date: Math.floor(Date.now() / 1000),
      chat: { id: userId, type: "private" as const },
      from: { id: userId, is_bot: false, first_name: "U" },
      text,
      ...(entities ? { entities } : {}),
    },
  };
}

function cbUpdate(userId: number, data: string) {
  return {
    update_id: Math.floor(Math.random() * 1e9),
    callback_query: {
      id: String(Math.floor(Math.random() * 1e9)),
      from: { id: userId, is_bot: false, first_name: "U" },
      chat_instance: "1",
      message: {
        message_id: Math.floor(Math.random() * 1e9),
        date: Math.floor(Date.now() / 1000),
        chat: { id: userId, type: "private" as const },
        from: { id: 1, is_bot: true, first_name: "t" },
        text: "x",
      },
      data,
    },
  };
}

describe("createAdmin — telegram menu", () => {
  const ADMIN = 111;
  const STRANGER = 999;
  let bot: Telegraf;

  beforeEach(() => {
    bot = new Telegraf("12345:TEST");
    bot.botInfo = {
      id: 1,
      is_bot: true,
      username: "test_bot",
      first_name: "t",
    };
    createAdmin({
      bot,
      admins: [ADMIN],
      db: makeFakeDb(),
      adapters,
    }).attachBot();
  });

  it("не пускает не-администратора в /admin", async () => {
    await bot.handleUpdate(textUpdate(STRANGER, "/admin"));
    expect(sentTexts()).toHaveLength(0);
  });

  it("открывает меню администратору", async () => {
    await bot.handleUpdate(textUpdate(ADMIN, "/admin"));
    expect(sentTexts().some((t) => t.includes("Админ панель"))).toBe(true);
  });

  it("меню строится из дескрипторов включённых фич", async () => {
    await bot.handleUpdate(textUpdate(ADMIN, "/admin"));
    const buttons = lastKeyboardButtons();
    expect(buttons).toEqual(
      expect.arrayContaining([
        "👥 Пользователи",
        "📊 Статистика",
        "📢 Рассылки",
        "📝 Обращения",
        "🚪 Выйти",
      ]),
    );
    // payments/promocodes/postcontentAd включены по умолчанию
    expect(buttons).toContain("💰 Платежи");
  });

  it("выключенная фича не даёт кнопку в меню", async () => {
    const bot2 = new Telegraf("12345:TEST");
    bot2.botInfo = {
      id: 1,
      is_bot: true,
      username: "test_bot",
      first_name: "t",
    };
    createAdmin({
      bot: bot2,
      admins: [ADMIN],
      db: makeFakeDb(),
      adapters,
      features: { payments: false, broadcast: false },
    }).attachBot();

    await bot2.handleUpdate(textUpdate(ADMIN, "/admin"));
    const buttons = lastKeyboardButtons();
    expect(buttons).not.toContain("💰 Платежи");
    expect(buttons).not.toContain("📢 Рассылки");
    expect(buttons).toContain("👥 Пользователи");
  });

  it("кнопка фичи из меню ведёт в её сцену", async () => {
    await bot.handleUpdate(textUpdate(ADMIN, "/admin"));
    await bot.handleUpdate(textUpdate(ADMIN, "📢 Рассылки"));
    expect(sentTexts().some((t) => /Рассыл/i.test(t))).toBe(true);
  });

  it("держит состояние сцены между апдейтами в изолированной admin-сессии", async () => {
    await bot.handleUpdate(textUpdate(ADMIN, "/admin"));
    // «Пользователи» -> должен войти в сцену поиска
    await bot.handleUpdate(textUpdate(ADMIN, "👥 Пользователи"));
    expect(sentTexts().some((t) => /поиск|Поиск|пользоват/i.test(t))).toBe(
      true,
    );
  });

  it("/cancel изнутри сцены не трактуется как ввод и выходит в меню (A1)", async () => {
    await bot.handleUpdate(textUpdate(ADMIN, "/admin"));
    await bot.handleUpdate(textUpdate(ADMIN, "👥 Пользователи"));
    calls = [];
    await bot.handleUpdate(textUpdate(ADMIN, "/cancel"));
    expect(sentTexts().some((t) => t.includes("Админ панель"))).toBe(true);
    expect(sentTexts().some((t) => /не найден/i.test(t))).toBe(false);
  });

  it("/admin выходит в меню из активной сцены (A1)", async () => {
    await bot.handleUpdate(textUpdate(ADMIN, "/admin"));
    await bot.handleUpdate(textUpdate(ADMIN, "👥 Пользователи"));
    calls = [];
    await bot.handleUpdate(textUpdate(ADMIN, "/admin"));
    expect(sentTexts().some((t) => t.includes("Админ панель"))).toBe(true);
  });

  it("профиль рендерит AdminUser.subscription в нейтральных терминах", async () => {
    const user = {
      userId: 5,
      username: "vasya",
      firstName: "Вася",
      createdAt: new Date("2024-01-02"),
      active: true,
      subscription: {
        activeUntil: new Date("2025-06-01"),
        isTrial: true,
        trialUsed: false,
      },
    };
    const bot2 = new Telegraf("12345:TEST");
    bot2.botInfo = {
      id: 1,
      is_bot: true,
      username: "test_bot",
      first_name: "t",
    };
    createAdmin({
      bot: bot2,
      admins: [ADMIN],
      db: makeFakeDb({
        findUsersByQuery: async () => [user],
        findUserById: async () => user,
      }),
      adapters,
    }).attachBot();

    await bot2.handleUpdate(textUpdate(ADMIN, "/admin"));
    await bot2.handleUpdate(textUpdate(ADMIN, "👥 Пользователи"));
    await bot2.handleUpdate(textUpdate(ADMIN, "5"));

    const profile = sentTexts().find((t) => t.includes("Профиль пользователя"));
    expect(profile).toBeTruthy();
    expect(profile).toContain("Пробная: Да");
    expect(profile).toContain("Пробная использована: Нет");
  });

  it("продление подписки текстом не выдаёт ложную ошибку (A4)", async () => {
    const user = {
      userId: 5,
      username: "vasya",
      firstName: "V",
      createdAt: new Date(),
      active: true,
    };
    const extendSubscription = vi.fn(async () => true);
    const bot2 = new Telegraf("12345:TEST");
    bot2.botInfo = {
      id: 1,
      is_bot: true,
      username: "test_bot",
      first_name: "t",
    };
    createAdmin({
      bot: bot2,
      admins: [ADMIN],
      db: makeFakeDb({
        findUsersByQuery: async () => [user],
        findUserById: async () => user,
        extendSubscription,
      }),
      adapters,
    }).attachBot();

    await bot2.handleUpdate(textUpdate(ADMIN, "/admin"));
    await bot2.handleUpdate(textUpdate(ADMIN, "👥 Пользователи"));
    await bot2.handleUpdate(textUpdate(ADMIN, "5")); // -> профиль
    await bot2.handleUpdate(cbUpdate(ADMIN, "extend_subscription")); // -> сцена
    calls = [];
    await bot2.handleUpdate(textUpdate(ADMIN, "15")); // ручной ввод дней

    expect(extendSubscription).toHaveBeenCalledWith(5, 15);
    expect(sentTexts().some((t) => /Ошибка при продлении/i.test(t))).toBe(
      false,
    );
    expect(sentTexts().some((t) => /успешно продлена на 15/i.test(t))).toBe(
      true,
    );
  });

  it("навигация по списку редактирует сообщение, а не плодит новые (B3)", async () => {
    await bot.handleUpdate(textUpdate(ADMIN, "/admin"));
    await bot.handleUpdate(textUpdate(ADMIN, "📢 Рассылки"));
    calls = [];
    await bot.handleUpdate(cbUpdate(ADMIN, "filter_pending"));

    const methods = calls.map((c) => c.method);
    expect(methods).toContain("editMessageText");
    expect(methods).not.toContain("sendMessage");
  });

  it("в admin-сессии хранится только id пользователя, не весь объект (B4)", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const user = {
      userId: 7,
      username: "u7",
      firstName: "СемьТест",
      createdAt: new Date(),
      active: true,
    };
    const bot2 = new Telegraf("12345:TEST");
    bot2.botInfo = {
      id: 1,
      is_bot: true,
      username: "test_bot",
      first_name: "t",
    };
    createAdmin({
      bot: bot2,
      admins: [ADMIN],
      db: makeFakeDb({
        findUsersByQuery: async () => [user],
        findUserById: async () => user,
      }),
      adapters,
      telegramMenu: {
        session: {
          store: {
            get: (k) => store.get(k),
            set: (k, v) => void store.set(k, v as Record<string, unknown>),
            delete: (k) => void store.delete(k),
          },
        },
      },
    }).attachBot();

    await bot2.handleUpdate(textUpdate(ADMIN, "/admin"));
    await bot2.handleUpdate(textUpdate(ADMIN, "👥 Пользователи"));
    await bot2.handleUpdate(textUpdate(ADMIN, "7")); // -> профиль

    const blob = JSON.stringify([...store.values()]);
    expect(blob).toContain("foundUserId");
    expect(blob).not.toContain("СемьТест"); // весь объект пользователя не осел в сессии
  });
});

describe("createAdmin — изоляция сессии хоста", () => {
  it("не перезаписывает ctx.session хоста admin-блобом", async () => {
    const bot = new Telegraf("12345:TEST");
    bot.botInfo = {
      id: 1,
      is_bot: true,
      username: "test_bot",
      first_name: "t",
    };

    const hostStore = new Map<string, Record<string, unknown>>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bot as any).use(async (ctx: any, next: () => Promise<void>) => {
      const key = String(ctx.from?.id);
      ctx.session = hostStore.get(key) ?? { hostValue: 42 };
      await next();
      hostStore.set(key, ctx.session);
    });

    createAdmin({
      bot,
      admins: [111],
      db: makeFakeDb(),
      adapters,
    }).attachBot();

    await bot.handleUpdate(textUpdate(111, "/admin"));

    expect(hostStore.get("111")).toEqual({ hostValue: 42 });
  });
});
