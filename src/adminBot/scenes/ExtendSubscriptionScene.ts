// ./scenes/AdminExtendSubscriptionScene.ts
import { log } from "../../logger";
import { Scenes, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { safeReply, getFoundUser, setFoundUser } from "../utils";
import type {
  AdminServices,
  AdminBotConfig,
  AdminBotContext,
} from "../../types";

export function getAdminExtendSubscriptionScene(
  services: AdminServices,
  _config: AdminBotConfig,
) {
  const scene = new Scenes.BaseScene<AdminBotContext>(
    "AdminExtendSubscriptionScene",
  );

  scene.enter(async (ctx) => {
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    await safeReply(
      ctx,
      "📅 Продление подписки\n\nВведите количество дней для продления:",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("7 дней", "extend_7"),
          Markup.button.callback("30 дней", "extend_30"),
        ],
        [
          Markup.button.callback("90 дней", "extend_90"),
          Markup.button.callback("365 дней", "extend_365"),
        ],
        [Markup.button.callback("« Назад", "back_to_profile")],
      ]),
    );
  });

  // ============ HANDLER: кнопки быстрого выбора ============
  async function extendSubscription(ctx: AdminBotContext, days: number) {
    const user = await getFoundUser(ctx, services.userService);

    if (!user) {
      await safeReply(ctx, "⚠️ Пользователь не найден");
      return ctx.scene.enter("MainAdminMenuScene");
    }

    try {
      await services.userService.extendSubscription(user.userId, days);

      // `extendSubscription` вызывается и из action-кнопок, и из текстового ввода
      // числа дней — `answerCbQuery` есть смысл звать только в первом случае,
      // иначе Telegram вернёт 400 и мы уйдём в catch с ложной «Ошибкой».
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery("✅ Подписка продлена!").catch(() => {});
      }

      await safeReply(
        ctx,
        `✅ Подписка пользователя ${
          user.username ? "@" + user.username : user.userId
        } успешно продлена на ${days} дней`,
        Markup.inlineKeyboard([
          [Markup.button.callback("« К профилю", "back_to_profile")],
          [Markup.button.callback("« В меню", "back_to_menu")],
        ]),
      );
    } catch (err) {
      log.error("Error extending subscription:", err);
      await safeReply(
        ctx,
        "⚠️ Ошибка при продлении подписки",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_profile")],
        ]),
      );
    }
  }

  scene.action("extend_7", (ctx) => extendSubscription(ctx, 7));
  scene.action("extend_30", (ctx) => extendSubscription(ctx, 30));
  scene.action("extend_90", (ctx) => extendSubscription(ctx, 90));
  scene.action("extend_365", (ctx) => extendSubscription(ctx, 365));

  // Команда — до текстового обработчика, иначе `/cancel` уйдёт в парсер числа дней.
  scene.command("cancel", (ctx) => ctx.scene.enter("AdminUserProfileScene"));

  // ============ HANDLER: ручной ввод количества дней ============
  scene.on(message("text"), async (ctx) => {
    const days = parseInt(ctx.message.text.trim());

    if (isNaN(days) || days <= 0) {
      await safeReply(
        ctx,
        "❌ Введите корректное положительное число дней",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_profile")],
        ]),
      );
      return;
    }

    await extendSubscription(ctx, days);
  });

  // ============ HANDLER: назад ============
  scene.action("back_to_profile", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter("AdminUserProfileScene");
  });

  scene.action("back_to_menu", async (ctx) => {
    await ctx.answerCbQuery();
    setFoundUser(ctx, null);
    await ctx.scene.enter("MainAdminMenuScene");
  });

  return scene;
}
