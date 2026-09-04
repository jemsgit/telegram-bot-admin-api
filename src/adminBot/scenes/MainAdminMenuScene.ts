// ./scenes/MainAdminMenuScene.ts
import { Markup, Scenes } from "telegraf";
import { message } from "telegraf/filters";
import { safeReply } from "../utils";
import type { AdminBotContext, CustomScene } from "../../types";
import type { MenuEntry } from "../../features";
import {
  EXIT_BUTTON,
  getMainGlobalMessageHandler,
} from "./globalMessageHandler";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function getMainAdminMenuScene(
  customScenes: CustomScene[],
  menuEntries: MenuEntry[],
) {
  const scene = new Scenes.BaseScene<AdminBotContext>("MainAdminMenuScene");
  const textHandler = getMainGlobalMessageHandler(menuEntries, customScenes);

  const menuButtonSet = new Set(menuEntries.map((e) => e.button));
  const customButtons = customScenes
    .map((c) => c.buttonText)
    .filter((x): x is string => !!x && !menuButtonSet.has(x));

  scene.enter(async (ctx) => {
    if (!ctx.session.admin) ctx.session.admin = {};

    const keyboard: string[][] = chunk(
      menuEntries.map((e) => e.button),
      2,
    );
    if (customButtons.length) keyboard.push(customButtons);
    keyboard.push([EXIT_BUTTON]);

    await ctx.reply("🏠 Админ панель\n\nВыберите раздел:", {
      reply_markup: {
        keyboard,
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    });
  });

  scene.on(message("text"), textHandler);

  scene.command("cancel", (ctx) => ctx.scene.enter("MainAdminMenuScene"));
  scene.command("exit", async (ctx) => {
    await ctx.scene.leave();
    await safeReply(
      ctx,
      "👤 Вернулись в режим пользователя",
      Markup.removeKeyboard(),
    );
  });

  return scene;
}
