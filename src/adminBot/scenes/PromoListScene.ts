// ./scenes/AdminPromoListScene.ts
import { log } from "../../logger";
import { Scenes, Markup } from "telegraf";
import { renderView } from "../utils";
import type {
  AdminServices,
  AdminBotConfig,
  AdminBotContext,
} from "../../types";

export function getAdminPromoListScene(
  services: AdminServices,
  _config: AdminBotConfig,
) {
  const scene = new Scenes.BaseScene<AdminBotContext>("AdminPromoListScene");

  scene.enter(async (ctx) => {
    await showPromoList(ctx, services);
  });

  // Создать новый промокод
  scene.action("create_promo", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter("AdminPromoCreateScene");
  });

  // Удалить промокод
  scene.action(/^delete_promo_(.+)$/, async (ctx) => {
    const promoCode = ctx.match[1];

    try {
      await services.promocodeService.delete(promoCode);
      await ctx.answerCbQuery("✅ Промокод удален");

      // Обновляем список
      await showPromoList(ctx, services);
    } catch (error) {
      log.error("Error deleting promo:", error);
      await ctx.answerCbQuery("⚠️ Ошибка при удалении");
    }
  });

  // Просмотр деталей промокода
  scene.action(/^view_promo_(.+)$/, async (ctx) => {
    const promoCode = ctx.match[1];
    await ctx.answerCbQuery();
    await showPromoDetails(ctx, services, promoCode);
  });

  // Назад к списку из деталей
  scene.action("back_to_list", async (ctx) => {
    await ctx.answerCbQuery();
    await showPromoList(ctx, services);
  });

  // Возврат в главное меню
  scene.action("back_to_menu", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter("MainAdminMenuScene");
  });

  scene.command("cancel", (ctx) => {
    ctx.scene.enter("MainAdminMenuScene");
  });

  return scene;
}

// Функция отображения списка промокодов
async function showPromoList(ctx: AdminBotContext, services: AdminServices) {
  try {
    const promos = await services.promocodeService.getAll();

    if (!promos || promos.length === 0) {
      await renderView(
        ctx,
        "🎁 Промокоды\n\n📭 Промокодов пока нет",
        Markup.inlineKeyboard([
          [Markup.button.callback("➕ Создать промокод", "create_promo")],
          [Markup.button.callback("« В меню", "back_to_menu")],
        ]),
      );
      return;
    }

    const activeCount = promos.filter((p) => p.isActive).length;
    const inactiveCount = promos.length - activeCount;

    let message = `🎁 Промокоды (${promos.length})\n\n`;
    message += `✅ Активных: ${activeCount}\n`;
    message += `⏸️ Неактивных: ${inactiveCount}\n`;

    const buttons = promos.slice(0, 20).map((promo) => {
      const statusIcon = promo.isActive ? "✅" : "⏸️";
      const dateInfo = promo.activeTo
        ? ` до ${new Date(promo.activeTo).toLocaleDateString("ru")}`
        : "";

      return [
        Markup.button.callback(
          `${statusIcon} ${promo.code} (${promo.discountPercent}%)${dateInfo}`,
          `view_promo_${promo.code}`,
        ),
      ];
    });

    buttons.push(
      [Markup.button.callback("➕ Создать промокод", "create_promo")],
      [Markup.button.callback("« В меню", "back_to_menu")],
    );

    await renderView(ctx, message, Markup.inlineKeyboard(buttons));
  } catch (error) {
    log.error("Error loading promos:", error);
    await renderView(
      ctx,
      "⚠️ Ошибка при загрузке промокодов",
      Markup.inlineKeyboard([
        [Markup.button.callback("« В меню", "back_to_menu")],
      ]),
    );
  }
}

// Функция отображения деталей промокода
async function showPromoDetails(
  ctx: AdminBotContext,
  services: AdminServices,
  promoCode: string,
) {
  try {
    const promos = await services.promocodeService.getAll();
    const promo = promos.find((item) => item.code === promoCode);
    if (!promo) {
      await renderView(
        ctx,
        "❌ Промокод не найден",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_list")],
        ]),
      );
      return;
    }

    const details = [
      `🎁 Промокод: ${promo.code}`,
      ``,
      `Описание: ${promo.description || "—"}`,
      `Скидка: ${promo.discountPercent}%`,
      `Цена: ${promo.price || "—"} ₽`,
      `Статус: ${promo.isActive ? "✅ Активен" : "⏸️ Неактивен"}`,
      ``,
      `Активен с: ${
        promo.activeFrom
          ? new Date(promo.activeFrom).toLocaleDateString("ru")
          : "—"
      }`,
      `Активен до: ${
        promo.activeTo ? new Date(promo.activeTo).toLocaleDateString("ru") : "—"
      }`,
    ];

    if (promo.segments && promo.segments.length > 0) {
      details.push(``, `Сегменты: ${promo.segments.join(", ")}`);
    }

    const buttons = [
      [Markup.button.callback("🗑 Удалить", `delete_promo_${promo.code}`)],
      [Markup.button.callback("« К списку", "back_to_list")],
      [Markup.button.callback("« В меню", "back_to_menu")],
    ];

    await renderView(ctx, details.join("\n"), Markup.inlineKeyboard(buttons));
  } catch (error) {
    log.error("Error showing promo details:", error);
    await ctx.answerCbQuery("⚠️ Ошибка");
  }
}
