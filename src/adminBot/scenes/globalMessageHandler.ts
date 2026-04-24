// Основной обработчик сообщений

import { Markup } from "telegraf";
import { AdminBotConfig, AdminServices, CustomScene } from "../../types";
import { safeReply } from "../utils";

export const buttons = {
  statistics: "📊 Статистика",
  users: "👥 Пользователи",
  broadcasts: "📢 Рассылки",
  reports: "📝 Обращения",
  postcontent: "📈 Инлайн реклама",
  promocodes: "🎁 Промокоды",
  payments: "💰 Платежи",
  exit: "🚪 Выйти",
};

export async function mainMessageHandler(
  ctx: any,
  services: AdminServices,
  config: AdminBotConfig,
  customScenes: Record<string, string>,
  next?: () => void
) {
  const text = ctx.update.message?.text;
  if (!text) return;

  if (customScenes[text]) {
    await ctx.scene.enter(customScenes[text]);
    return;
  }
  switch (text) {
    case buttons.users:
      await ctx.scene.enter("AdminUserSearchScene");
      break;

    case buttons.broadcasts:
      if (config.broadcast) {
        await ctx.scene.enter("AdminBroadcastListScene");
      } else {
        await safeReply(ctx, "⚠️ Модуль рассылок отключен");
      }
      break;

    case buttons.reports:
      if (config.reports) {
        await ctx.scene.enter("AdminReportsListScene");
      } else {
        await safeReply(ctx, "⚠️ Модуль обращений отключен");
      }
      break;

    case buttons.postcontent:
      if (config.postcontentAd) {
        await ctx.scene.enter("AdminPostContentAdListScene");
      } else {
        await safeReply(ctx, "⚠️ Модуль иналайн рекламы отключен");
      }
      break;

    case buttons.promocodes:
      if (config.promocodes) {
        await ctx.scene.enter("AdminPromoListScene");
      } else {
        await safeReply(ctx, "⚠️ Модуль промокодов отключен");
      }
      break;

    case buttons.payments:
      if (config.payments) {
        await ctx.scene.enter("AdminPaymentsScene");
      } else {
        await safeReply(ctx, "⚠️ Модуль платежей отключен");
      }
      break;

    case buttons.statistics:
      await ctx.scene.enter("AdminStatisticsScene");
      break;

    case buttons.exit:
      await ctx.scene.leave();
      await safeReply(
        ctx,
        "👤 Вернулись в режим пользователя",
        Markup.removeKeyboard()
      );
      // Можно перейти в основную сцену пользователя
      // await ctx.scene.enter("mainScene");
      break;

    default:
      // Игнорируем неизвестные команды в админ-меню
      next?.();
      break;
  }
}

export function getMainGlobalMessageHandler(
  services: AdminServices,
  config: AdminBotConfig,
  customScenes: CustomScene[]
) {
  const scenesMatcher = customScenes.reduce((acc, cur) => {
    if (cur.buttonText) {
      acc[cur.buttonText] = cur.name;
    }
    return acc;
  }, {} as Record<string, string>);
  return async function mainGlobalMessageHandler(
    ctx: any,
    next: () => Promise<void>
  ) {
    await mainMessageHandler(ctx, services, config, scenesMatcher, next);
  };
}
