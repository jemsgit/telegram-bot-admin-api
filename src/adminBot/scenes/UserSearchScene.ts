// ./scenes/AdminUserSearchScene.ts
import { log } from "../../logger";
import { Scenes, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { safeReply, renderView, setFoundUser } from "../utils";
import type {
  AdminServices,
  AdminBotConfig,
  AdminBotContext,
  AdminUser,
} from "../../types";

export function getAdminUserSearchScene(
  services: AdminServices,
  _config: AdminBotConfig,
) {
  const scene = new Scenes.BaseScene<AdminBotContext>("AdminUserSearchScene");

  scene.enter(async (ctx) => {
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    await renderView(
      ctx,
      "🔍 Поиск пользователя\n\n" +
        "Введите username (без @) или ID пользователя:",
      Markup.inlineKeyboard([
        [Markup.button.callback("« Назад", "back_to_menu")],
      ]),
    );
  });

  // Команды регистрируем до текстового обработчика, иначе `.on(message("text"))`
  // перехватит `/cancel` как поисковый запрос.
  scene.command("cancel", (ctx) => {
    ctx.scene.enter("MainAdminMenuScene");
  });

  // Поиск по username / ID
  scene.on(message("text"), async (ctx) => {
    const input = ctx.message.text.trim();
    const userService = services.userService;

    try {
      const users = await userService.search(input);

      if (!users || users.length === 0) {
        await safeReply(
          ctx,
          "❌ Пользователь не найден\n\nПопробуйте ещё раз или вернитесь в меню:",
          Markup.inlineKeyboard([
            [Markup.button.callback("« Назад", "back_to_menu")],
          ]),
        );
        return;
      }

      // Если найден только один пользователь - сразу переходим к профилю
      if (users.length === 1) {
        setFoundUser(ctx, users[0].userId);
        await ctx.scene.enter("AdminUserProfileScene");
        return;
      }

      // Если найдено несколько - показываем список
      await showUsersList(ctx, users);
    } catch (error) {
      log.error("Error searching user:", error);

      await safeReply(
        ctx,
        "⚠️ Ошибка при поиске. Попробуйте снова.",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_menu")],
        ]),
      );
    }
  });

  // Обработка выбора пользователя из списка
  scene.action(/^select_user_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.match[1];

    try {
      const user = await services.userService.getById(userId);

      if (!user) {
        await ctx.answerCbQuery("❌ Пользователь не найден");
        return;
      }

      setFoundUser(ctx, user.userId);

      await ctx.scene.enter("AdminUserProfileScene");
    } catch (error) {
      log.error("Error selecting user:", error);
      await ctx.answerCbQuery("⚠️ Ошибка");
    }
  });

  // Возврат в меню
  scene.action("back_to_menu", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter("MainAdminMenuScene");
  });

  // Добавьте в scene перед return
  scene.action("new_search", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.reenter(); // Перезапускает сцену
  });

  return scene;
}

// Функция отображения списка найденных пользователей
async function showUsersList(ctx: AdminBotContext, users: AdminUser[]) {
  const maxUsers = 10; // Ограничение на количество кнопок
  const displayUsers = users.slice(0, maxUsers);

  let message = `👥 Найдено пользователей: ${users.length}\n\n`;

  if (users.length > maxUsers) {
    message += `⚠️ Показаны первые ${maxUsers} результатов. Уточните запрос для более точного поиска.\n\n`;
  }

  message += "Выберите пользователя:";

  const buttons = displayUsers.map((user) => {
    // Формируем информативную строку для кнопки
    const username = user.username ? `@${user.username}` : "";
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
    const displayName = username || name || `ID: ${user.userId}`;

    // Добавляем дополнительную информацию
    const info = [];
    if (username && name) info.push(name);
    if (user.active === false) info.push("❌");

    const buttonText =
      info.length > 0 ? `${displayName} (${info.join(", ")})` : displayName;

    return [
      Markup.button.callback(
        buttonText.substring(0, 60), // Ограничение длины кнопки
        `select_user_${user.userId}`,
      ),
    ];
  });

  buttons.push([Markup.button.callback("🔍 Новый поиск", "new_search")]);
  buttons.push([Markup.button.callback("« Назад", "back_to_menu")]);

  await safeReply(ctx, message, Markup.inlineKeyboard(buttons));
}
