import { Scenes, Markup } from "telegraf";
import type {
  AdminServices,
  AdminBotConfig,
  AdminBotContext,
} from "../../types";
import { safeReply } from "../utils";
type Ctx = AdminBotContext;

/**
 * Сцена статистики
 */
export function getStatsScene(services: AdminServices, config: AdminBotConfig) {
  const scene = new Scenes.BaseScene<Ctx>("AdminStatisticsScene");

  scene.enter(async (ctx) => {
    try {
      const stats = await services.userService.getStats();
      const { currentMonth, lastMonth } = stats.payments ?? {};

      const now = new Date();
      const timeStr = now.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const message =
        `📊 <b>Статистика бота</b>\n\n` +
        `👥 <b>Пользователи:</b>\n` +
        `• Всего: ${stats.totalUsers ?? 0}\n` +
        `• Активных: ${stats.activeUsers ?? 0}\n` +
        `• С подпиской: ${stats.paidUsers ?? 0}\n\n` +
        `📝 <b>Обращения:</b>\n` +
        `• Всего: ${stats.totalReports ?? 0}\n\n` +
        `💰 <b>Платежи (текущий месяц):</b>\n` +
        `• Количество: ${currentMonth?.count ?? 0}\n` +
        `• Сумма: ${currentMonth?.totalAmount ?? 0} ₽\n\n` +
        `💰 <b>Платежи (прошлый месяц):</b>\n` +
        `• Количество: ${lastMonth?.count ?? 0}\n` +
        `• Сумма: ${lastMonth?.totalAmount ?? 0} ₽\n\n` +
        `⏰ Обновлено: ${timeStr}`;

      await ctx.reply(message, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🏠 На главную", "stats_back")],
        ]),
      });
    } catch (error) {
      console.error("Ошибка получения статистики:", error);
      await safeReply(
        ctx,
        "❌ Ошибка при загрузке статистики. Попробуйте позже.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🏠 На главную", "stats_back")],
        ])
      );
    }
  });

  // Вернуться на главную
  scene.action("stats_back", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await ctx.scene.enter("MainAdminMenuScene");
  });

  return scene;
}
