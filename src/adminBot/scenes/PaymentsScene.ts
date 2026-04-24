import { Scenes, Markup } from "telegraf";
import type { AdminServices, AdminBotContext } from "../../types";
import { safeReply } from "../utils";

export function getAdminPaymentsScene(services: AdminServices) {
  const scene = new Scenes.BaseScene<AdminBotContext>("AdminPaymentsScene");

  scene.enter(async (ctx) => {
    await showPaymentsStats(ctx, services);
  });

  scene.action("show_payments_list", async (ctx) => {
    await ctx.answerCbQuery();
    await showPaymentsList(ctx, services);
  });

  scene.action("payments_back_to_stats", async (ctx) => {
    await ctx.answerCbQuery();
    await showPaymentsStats(ctx, services);
  });

  scene.action("back_to_menu", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter("MainAdminMenuScene");
  });

  return scene;
}

async function showPaymentsStats(ctx: AdminBotContext, services: AdminServices) {
  try {
    const stats = await services.paymentService.getStats();

    let msg = "💰 <b>Платежи</b>\n\n";
    msg += `📅 <b>Текущий месяц:</b>\n`;
    msg += `• Платежей: ${stats.currentMonth.count}\n`;
    msg += `• Сумма: ${stats.currentMonth.totalAmount} / доход: ${stats.currentMonth.totalIncomeAmount}\n\n`;
    msg += `📅 <b>Прошлый месяц:</b>\n`;
    msg += `• Платежей: ${stats.lastMonth.count}\n`;
    msg += `• Сумма: ${stats.lastMonth.totalAmount} / доход: ${stats.lastMonth.totalIncomeAmount}\n`;

    await safeReply(ctx, msg, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("📋 Список платежей", "show_payments_list")],
        [Markup.button.callback("« В меню", "back_to_menu")],
      ]),
    });
  } catch (error) {
    console.error("Error loading payment stats:", error);
    await safeReply(
      ctx,
      "⚠️ Ошибка при загрузке статистики платежей",
      Markup.inlineKeyboard([
        [Markup.button.callback("« В меню", "back_to_menu")],
      ])
    );
  }
}

async function showPaymentsList(ctx: AdminBotContext, services: AdminServices) {
  try {
    const payments = await services.paymentService.getAllPayments();

    if (!payments || payments.length === 0) {
      await safeReply(
        ctx,
        "💰 Платежей пока нет",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "payments_back_to_stats")],
        ])
      );
      return;
    }

    const recent = payments.slice(0, 20);
    let msg = `💰 <b>Платежи (${payments.length}):</b>\n\n`;
    for (const p of recent) {
      const date = new Date(p.date).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      msg += `• ${p.username || p.chatId} — ${p.amount} ${p.currency} (${date})\n`;
    }
    if (payments.length > 20) {
      msg += `\n... и ещё ${payments.length - 20}`;
    }

    await safeReply(ctx, msg, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("« Назад", "payments_back_to_stats")],
        [Markup.button.callback("« В меню", "back_to_menu")],
      ]),
    });
  } catch (error) {
    console.error("Error loading payments list:", error);
    await safeReply(
      ctx,
      "⚠️ Ошибка при загрузке платежей",
      Markup.inlineKeyboard([
        [Markup.button.callback("« Назад", "payments_back_to_stats")],
      ])
    );
  }
}
