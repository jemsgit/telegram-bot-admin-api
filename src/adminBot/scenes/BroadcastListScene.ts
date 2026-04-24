// ./scenes/AdminBroadcastListScene.ts
import { Scenes, Markup } from "telegraf";
import type {
  AdminServices,
  AdminBotConfig,
  AdminBotContext,
} from "../../types";
import { safeReply } from "../utils";

export function getAdminBroadcastListScene(
  services: AdminServices,
  config: AdminBotConfig,
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
      console.error("Error deleting broadcast:", error);
      await ctx.answerCbQuery("⚠️ Ошибка при удалении");
    }
  });

  scene.action(/^run_test_(.+)$/, async (ctx) => {
    const broadcastId = ctx.match[1];

    try {
      await services.broadcastService.sendTest(broadcastId);
      await ctx.answerCbQuery("✅ Рассылка Отправлена");
    } catch (error) {
      console.error("Error deleting broadcast:", error);
      await ctx.answerCbQuery("⚠️ Ошибка при отправлке");
    }
  });

  scene.action("back_to_list", async (ctx) => {
    await ctx.answerCbQuery();
    await showBroadcastsList(ctx, services);
  });

  // Отменить рассылку
  scene.action(/^cancel_broadcast_(.+)$/, async (ctx) => {
    const broadcastId = ctx.match[1];

    try {
      await services.broadcastService.delete(broadcastId);
      await ctx.answerCbQuery("❌ Рассылка отменена");

      // Показываем обновленные детали
      await showBroadcastDetails(ctx, services, broadcastId);
    } catch (error) {
      console.error("Error cancelling broadcast:", error);
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
      await safeReply(
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
      const statusIcon = getStatusIcon(broadcast.status);
      const typeIcon = getTypeIcon(broadcast.type);
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

    await safeReply(ctx, message, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    console.error("Error loading broadcasts:", error);
    await safeReply(
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
      await ctx.editMessageText(
        "❌ Рассылка не найдена",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_list")],
        ]),
      );
      return;
    }

    const statusIcon = getStatusIcon(broadcast.status);
    const typeIcon = getTypeIcon(broadcast.type);

    const details = [
      `📢 Рассылка: ${broadcast.title || "Без названия"}`,
      "",
      `ID: ${broadcast.id}`,
      `Тип: ${typeIcon} ${broadcast.type}`,
      `Статус: ${statusIcon} ${getStatusText(broadcast.status)}`,
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
        Markup.button.callback(
          "🗑 Удалить",
          `delete_broadcast_${broadcast.id}`,
        ),
      ]);
    }

    buttons.push(
      [Markup.button.callback("Запустить тест", `run_test_${broadcast.id}`)],
      [Markup.button.callback("« К списку", "back_to_list")],
      [Markup.button.callback("« В меню", "back_to_menu")],
    );

    await ctx.editMessageText(
      details.join("\n"),
      Markup.inlineKeyboard(buttons),
    );
  } catch (error) {
    console.error("Error showing broadcast details:", error);
    await ctx.answerCbQuery("⚠️ Ошибка");
  }
}

// Вспомогательные функции
function getStatusIcon(status: string): string {
  switch (status) {
    case "pending":
      return "⏳";
    case "progress":
      return "🔄";
    case "done":
      return "✅";
    case "cancelled":
      return "❌";
    default:
      return "❓";
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case "pending":
      return "Ожидает";
    case "progress":
      return "В процессе";
    case "done":
      return "Завершено";
    case "cancelled":
      return "Отменено";
    default:
      return "Неизвестно";
  }
}

function getTypeIcon(type: string): string {
  switch (type) {
    case "text":
      return "📝";
    case "photo":
      return "🖼";
    case "video":
      return "🎬";
    default:
      return "❓";
  }
}
