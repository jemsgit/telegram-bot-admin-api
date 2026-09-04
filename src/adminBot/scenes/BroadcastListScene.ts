// ./scenes/AdminBroadcastListScene.ts
import { log } from "../../logger";
import { Scenes, Markup } from "telegraf";
import type {
  AdminServices,
  AdminBotConfig,
  AdminBotContext,
} from "../../types";
import { renderView } from "../utils";
import {
  broadcastStatusIcon,
  broadcastStatusText,
  broadcastTypeIcon,
} from "../labels";

export function getAdminBroadcastListScene(
  services: AdminServices,
  _config: AdminBotConfig,
) {
  const scene = new Scenes.BaseScene<AdminBotContext>(
    "AdminBroadcastListScene",
  );

  scene.enter(async (ctx) => {
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }

    await showBroadcastsList(ctx, services);
  });

  // Создать новую рассылку
  scene.action("create_broadcast", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter("AdminBroadcastCreateScene");
  });

  // Просмотр конкретной рассылки
  scene.action(/^view_broadcast_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const broadcastId = ctx.match[1];
    await showBroadcastDetails(ctx, services, broadcastId);
  });

  // Удалить рассылку
  scene.action(/^delete_broadcast_(.+)$/, async (ctx) => {
    const broadcastId = ctx.match[1];

    try {
      await services.broadcastService.delete(broadcastId);
      await ctx.answerCbQuery("✅ Рассылка удалена");

      // Обновляем список
      await showBroadcastsList(ctx, services);
    } catch (error) {
      log.error("Error deleting broadcast:", error);
      await ctx.answerCbQuery("⚠️ Ошибка при удалении");
    }
  });

  scene.action(/^run_test_(.+)$/, async (ctx) => {
    const broadcastId = ctx.match[1];

    try {
      await services.broadcastService.sendTest(broadcastId);
      await ctx.answerCbQuery("✅ Рассылка Отправлена");
    } catch (error) {
      log.error("Error deleting broadcast:", error);
      await ctx.answerCbQuery("⚠️ Ошибка при отправлке");
    }
  });

  scene.action("back_to_list", async (ctx) => {
    await ctx.answerCbQuery();
    await showBroadcastsList(ctx, services);
  });

  // Отменить рассылку (сейчас = удаление записи, поэтому возвращаемся к списку —
  // деталей у удалённой рассылки уже нет).
  scene.action(/^cancel_broadcast_(.+)$/, async (ctx) => {
    const broadcastId = ctx.match[1];

    try {
      await services.broadcastService.delete(broadcastId);
      await ctx.answerCbQuery("❌ Рассылка отменена");

      await showBroadcastsList(ctx, services);
    } catch (error) {
      log.error("Error cancelling broadcast:", error);
      await ctx.answerCbQuery("⚠️ Ошибка");
    }
  });

  // Фильтр по статусу
  scene.action(/^filter_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const status = ctx.match[1] === "all" ? null : ctx.match[1];
    await showBroadcastsList(ctx, services, status);
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

// Функция отображения списка рассылок
async function showBroadcastsList(
  ctx: AdminBotContext,
  services: AdminServices,
  status: string | null = null,
) {
  try {
    const broadcasts = await services.broadcastService.list(status);

    // Кнопки фильтров
    const filterButtons = [
      Markup.button.callback(status === null ? "• Все" : "Все", "filter_all"),
      Markup.button.callback(
        status === "pending" ? "• Ожидают" : "Ожидают",
        "filter_pending",
      ),
      Markup.button.callback(
        status === "done" ? "• Завершено" : "Завершено",
        "filter_done",
      ),
    ];

    if (!broadcasts || broadcasts.length === 0) {
      await renderView(
        ctx,
        "📢 Рассылки\n\n📭 Рассылок пока нет",
        Markup.inlineKeyboard([
          filterButtons,
          [Markup.button.callback("➕ Создать рассылку", "create_broadcast")],
          [Markup.button.callback("« В меню", "back_to_menu")],
        ]),
      );
      return;
    }

    // Подсчет по статусам
    const pendingCount = broadcasts.filter(
      (b) => b.status === "pending",
    ).length;
    const progressCount = broadcasts.filter(
      (b) => b.status === "progress",
    ).length;
    const doneCount = broadcasts.filter((b) => b.status === "done").length;
    const cancelledCount = broadcasts.filter(
      (b) => b.status === "cancelled",
    ).length;

    let message = `📢 Рассылки (${broadcasts.length})\n\n`;
    message += `⏳ Ожидают: ${pendingCount}\n`;
    message += `🔄 В процессе: ${progressCount}\n`;
    message += `✅ Завершено: ${doneCount}\n`;
    message += `❌ Отменено: ${cancelledCount}\n`;

    // Кнопки для рассылок
    const buttons = broadcasts.slice(0, 15).map((broadcast) => {
      const statusIcon = broadcastStatusIcon(broadcast.status);
      const typeIcon = broadcastTypeIcon(broadcast.type);
      const timeText = broadcast.scheduledAt
        ? new Date(broadcast.scheduledAt).toLocaleString("ru", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "сейчас";

      const title = broadcast.title || "Без названия";
      const buttonText = `${statusIcon} ${typeIcon} ${title} (${timeText})`;

      return [
        Markup.button.callback(
          buttonText.substring(0, 60),
          `view_broadcast_${broadcast.id}`,
        ),
      ];
    });

    const keyboard = [
      filterButtons,
      ...buttons,
      [Markup.button.callback("➕ Создать рассылку", "create_broadcast")],
      [Markup.button.callback("« В меню", "back_to_menu")],
    ];

    await renderView(ctx, message, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    log.error("Error loading broadcasts:", error);
    await renderView(
      ctx,
      "⚠️ Ошибка при загрузке рассылок",
      Markup.inlineKeyboard([
        [Markup.button.callback("« В меню", "back_to_menu")],
      ]),
    );
  }
}

// Функция отображения деталей рассылки
async function showBroadcastDetails(
  ctx: AdminBotContext,
  services: AdminServices,
  broadcastId: string,
) {
  try {
    const broadcast = await services.broadcastService.get(broadcastId);

    if (!broadcast) {
      await renderView(
        ctx,
        "❌ Рассылка не найдена",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_list")],
        ]),
      );
      return;
    }

    const statusIcon = broadcastStatusIcon(broadcast.status);
    const typeIcon = broadcastTypeIcon(broadcast.type);

    const details = [
      `📢 Рассылка: ${broadcast.title || "Без названия"}`,
      "",
      `ID: ${broadcast.id}`,
      `Тип: ${typeIcon} ${broadcast.type}`,
      `Статус: ${statusIcon} ${broadcastStatusText(broadcast.status)}`,
      "",
      `Текст: ${
        broadcast.text
          ? broadcast.text.substring(0, 200) +
            (broadcast.text.length > 200 ? "..." : "")
          : "—"
      }`,
    ];

    if (broadcast.mediaUrl) {
      details.push(
        `Медиа: ${
          broadcast.mediaUrl.startsWith("http") ? "URL" : "Прикреплено"
        }`,
      );
    }

    details.push(
      "",
      `Запланировано: ${
        broadcast.scheduledAt
          ? new Date(broadcast.scheduledAt).toLocaleString("ru")
          : "сейчас"
      }`,
      `Создано: ${new Date(broadcast.createdAt).toLocaleString("ru")}`,
      `Исключить платных: ${broadcast.excludePaid ? "Да" : "Нет"}`,
    );

    if (broadcast.sentUsers && broadcast.sentUsers.length > 0) {
      details.push(`Отправлено: ${broadcast.sentUsers.length} пользователям`);
    }

    if (broadcast.linkButtons && broadcast.linkButtons.length > 0) {
      details.push("", `Кнопки (${broadcast.linkButtons.length}):`);
      broadcast.linkButtons.forEach((btn, i) => {
        details.push(`  ${i + 1}. ${btn.text} → ${btn.url}`);
      });
    }

    const buttons = [];

    // Кнопка отмены только для pending
    if (broadcast.status === "pending") {
      buttons.push([
        Markup.button.callback(
          "❌ Отменить рассылку",
          `cancel_broadcast_${broadcast.id}`,
        ),
      ]);
    }

    // Кнопка удаления для cancelled и done
    if (broadcast.status === "cancelled" || broadcast.status === "done") {
      buttons.push([
        Markup.button.callback("🗑 Удалить", `delete_broadcast_${broadcast.id}`),
      ]);
    }

    buttons.push(
      [Markup.button.callback("Запустить тест", `run_test_${broadcast.id}`)],
      [Markup.button.callback("« К списку", "back_to_list")],
      [Markup.button.callback("« В меню", "back_to_menu")],
    );

    await renderView(ctx, details.join("\n"), Markup.inlineKeyboard(buttons));
  } catch (error) {
    log.error("Error showing broadcast details:", error);
    await ctx.answerCbQuery("⚠️ Ошибка");
  }
}
