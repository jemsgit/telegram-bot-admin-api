// ./scenes/AdminUserProfileScene.ts
import { Scenes, Markup } from "telegraf";
import type {
  AdminServices,
  AdminBotConfig,
  AdminBotSessionData,
  AdminBotContext,
} from "../../types";
import { safeReply } from "../utils";

type Ctx = AdminBotContext;

export function getAdminUserProfileScene(
  services: AdminServices,
  config: AdminBotConfig
) {
  const scene = new Scenes.BaseScene<Ctx>("AdminUserProfileScene");

  scene.enter(async (ctx) => {
    console.log(ctx.session.admin);
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    console.log(ctx.session.admin);
    const user = ctx.session.admin?.foundUser;

    if (!user) {
      await safeReply(ctx, "⚠️ Данные пользователя не найдены");
      return ctx.scene.enter("MainAdminMenuScene");
    }

    const info: string[] = [
      `👤 Профиль пользователя`,
      ``,
      `ID: ${user.userId}`,
      `Username: ${user.username ? "@" + user.username : "—"}`,
      `Имя: ${user.firstName || ""} ${user.lastName || ""}`.trim() || "—",
      `Создан: ${
        user.createdAt ? new Date(user.createdAt).toLocaleDateString("ru") : "—"
      }`,
      `Активен: ${user.active ? "✅" : "❌"}`,
    ];

    if (config.subscriptions) {
      info.push(
        ``,
        `📅 Подписка:`,
        `До: ${
          user.subscription &&
          typeof user.subscription !== "string" &&
          user.subscription.subscriptionToDate
            ? new Date(user.subscription.subscriptionToDate).toLocaleDateString(
                "ru"
              )
            : "—"
        }`,
        `Демо: ${
          user.subscription &&
          typeof user.subscription !== "string" &&
          user.subscription?.isDemoSubscription
            ? "Да"
            : "Нет"
        }`,
        `Демо использовано: ${
          user.subscription &&
          typeof user.subscription !== "string" &&
          user.subscription?.demoUsed
            ? "Да"
            : "Нет"
        }`
      );
    }

    if (user.promoCode) info.push(``, `🎁 Промокод: ${user.promoCode}`);

    const buttons: any[] = [];

    if (config.subscriptions) {
      buttons.push([
        Markup.button.callback("📅 Продлить подписку", "extend_subscription"),
      ]);
    }

    if (config.promocodes) {
      buttons.push([
        Markup.button.callback("🎁 Выдать промокод", "assign_promo"),
      ]);
    }

    if (config.reports) {
      buttons.push([Markup.button.callback("💬 Обращения", "view_reports")]);
    }

    buttons.push(
      [Markup.button.callback("🔍 Найти другого", "search_another")],
      [Markup.button.callback("« В меню", "back_to_menu")]
    );

    await safeReply(ctx, info.join("\n"), Markup.inlineKeyboard(buttons));
  });

  scene.action("extend_subscription", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter("AdminExtendSubscriptionScene");
  });

  scene.action("assign_promo", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter("AdminAssignPromoScene");
  });

  scene.action("view_reports", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter("AdminUserReportsScene");
  });

  scene.action("search_another", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.admin = ctx.session.admin || {};
    ctx.session.admin.foundUser = undefined;

    await ctx.scene.enter("AdminUserSearchScene");
  });

  scene.action("back_to_menu", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.admin = ctx.session.admin || {};
    ctx.session.admin.foundUser = undefined;

    await ctx.scene.enter("MainAdminMenuScene");
  });

  return scene;
}
