// ./scenes/MainAdminMenuScene.ts
import { Markup, Scenes } from "telegraf";
import { message } from "telegraf/filters";
import { safeReply } from "../utils";
import type {
  AdminBotConfig,
  AdminBotContext,
  AdminServices,
  CustomScene,
} from "../../types";
import { buttons, getMainGlobalMessageHandler } from "./globalMessageHandler";

export function getMainAdminMenuScene(
  services: AdminServices,
  config: AdminBotConfig,
  customScenes: CustomScene[]
) {
  const customScenesButtons = customScenes
    .filter((item) => !!item.buttonText)
    .map((item) => item.buttonText);

  const mainMessageHandler = getMainGlobalMessageHandler(
    services,
    config,
    customScenes
  );
  const MainAdminMenuScene = new Scenes.BaseScene<AdminBotContext>(
    "MainAdminMenuScene"
  );

  MainAdminMenuScene.enter(async (ctx) => {
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    // Формируем клавиатуру динамически на основе конфига
    const keyboard: string[][] = [];
    const row: string[] = [];

    // Пользователи всегда доступны
    row.push(buttons.users);
    row.push(buttons.statistics);

    if (config.broadcast) {
      row.push(buttons.broadcasts);
    }

    if (row.length > 0) {
      keyboard.push([...row]);
    }

    // Вторая строка
    const row2: string[] = [];

    if (config.postcontentAd) {
      row2.push(buttons.postcontent);
    }

    if (config.promocodes) {
      row2.push(buttons.promocodes);
    }

    if (row2.length > 0) {
      keyboard.push([...row2]);
    }

    // Третья строка
    const row3: string[] = [];

    if (config.reports) {
      row3.push(buttons.reports);
    }

    if (config.payments) {
      row3.push(buttons.payments);
    }

    if (row3.length > 0) {
      keyboard.push([...row3]);
    }
    if (customScenesButtons.length) {
      keyboard.push(customScenesButtons as string[]);
    }

    // Четвертая строка - выход
    keyboard.push([buttons.exit]);

    await ctx.reply("🏠 Админ панель\n\nВыберите раздел:", {
      reply_markup: {
        keyboard: keyboard,
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    });
  });

  // Обработчик текстовых сообщений в сцене
  MainAdminMenuScene.on(message("text"), mainMessageHandler);

  // Команда отмены - возврат в главное меню
  MainAdminMenuScene.command("cancel", (ctx) =>
    ctx.scene.enter("MainAdminMenuScene")
  );

  // Команда выхода из админки
  MainAdminMenuScene.command("exit", async (ctx) => {
    await ctx.scene.leave();
    await safeReply(
      ctx,
      "👤 Вернулись в режим пользователя",
      Markup.removeKeyboard()
    );
  });

  return MainAdminMenuScene;
}
