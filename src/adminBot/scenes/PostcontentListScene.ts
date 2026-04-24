// ./scenes/AdminPostContentAdListScene.ts
import { Scenes, Markup } from "telegraf";
import type {
  AdminServices,
  AdminBotConfig,
  AdminBotContext,
  PostContentAd,
} from "../../types";
import { safeReply } from "../utils";

export function getAdminPostContentAdListScene(
  services: AdminServices,
  config: AdminBotConfig,
) {
  const scene = new Scenes.BaseScene<AdminBotContext>(
    "AdminPostContentAdListScene",
  );

  scene.enter(async (ctx) => {
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }

    await showAdsList(ctx, services);
  });

  // Создать новую рекламу
  scene.action("create_ad", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter("AdminPostContentAdCreateScene");
  });

  // Просмотр конкретной рекламы
  scene.action(/^view_ad_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const adId = ctx.match[1];
    await showAdDetails(ctx, services, adId);
  });

  // Удалить рекламу
  scene.action(/^delete_ad_(.+)$/, async (ctx) => {
    const adId = ctx.match[1];

    try {
      await services.postContentService.delete(adId);
      await ctx.answerCbQuery("✅ Реклама удалена");

      // Обновляем список
      await showAdsList(ctx, services);
    } catch (error) {
      console.error("Error deleting ad:", error);
      await ctx.answerCbQuery("⚠️ Ошибка при удалении");
    }
  });

  // Активировать/деактивировать рекламу
  scene.action(/^toggle_ad_(.+)$/, async (ctx) => {
    const adId = ctx.match[1];

    try {
      const ad = await services.postContentService.get(adId);

      if (!ad) {
        await ctx.answerCbQuery("❌ Реклама не найдена");
        return;
      }

      await services.postContentService.update(adId, {
        isActive: !ad.isActive,
      });

      await ctx.answerCbQuery(
        ad.isActive ? "⏸️ Реклама деактивирована" : "▶️ Реклама активирована",
      );

      // Показываем обновленные детали
      await showAdDetails(ctx, services, adId);
    } catch (error) {
      console.error("Error toggling ad:", error);
      await ctx.answerCbQuery("⚠️ Ошибка");
    }
  });

  // Фильтр по статусу
  scene.action(/^filter_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const filter = ctx.match[1];

    let filterValue: boolean | null = null;
    if (filter === "active") filterValue = true;
    if (filter === "inactive") filterValue = false;

    await showAdsList(ctx, services, filterValue);
  });

  // Тест рекламы — отправить себе
  scene.action(/^test_ad_(.+)$/, async (ctx) => {
    const adId = ctx.match[1];

    try {
      const ad = await services.postContentService.get(adId);

      if (!ad) {
        await ctx.answerCbQuery("❌ Реклама не найдена");
        return;
      }

      await ctx.telegram.sendMessage(ctx.from.id, `это тест\n\n${ad.text}`);
      await ctx.answerCbQuery("✅ Тест отправлен");
    } catch (error) {
      console.error("Error sending ad test:", error);
      await ctx.answerCbQuery("⚠️ Ошибка при отправке теста");
    }
  });

  // Назад к списку из деталей
  scene.action("back_to_list", async (ctx) => {
    await ctx.answerCbQuery();
    await showAdsList(ctx, services);
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

// Функция отображения списка рекламы
async function showAdsList(
  ctx: AdminBotContext,
  services: AdminServices,
  isActive: boolean | null = null,
) {
  try {
    let ads = await services.postContentService.list();

    // Фильтруем по активности если нужно
    if (isActive !== null) {
      ads = ads.filter((ad) => ad.isActive === isActive);
    }

    if (!ads || ads.length === 0) {
      const noAdsFilterButtons = [
        Markup.button.callback(
          isActive === null ? "• Все" : "Все",
          "filter_all",
        ),
        Markup.button.callback(
          isActive === true ? "• Активные" : "Активные",
          "filter_active",
        ),
        Markup.button.callback(
          isActive === false ? "• Неактивные" : "Неактивные",
          "filter_inactive",
        ),
      ];
      await safeReply(
        ctx,
        "📣 Реклама в постах\n\n📭 Рекламы пока нет",
        Markup.inlineKeyboard([
          noAdsFilterButtons,
          [Markup.button.callback("➕ Создать рекламу", "create_ad")],
          [Markup.button.callback("« В меню", "back_to_menu")],
        ]),
      );
      return;
    }

    // Подсчет по статусам
    const activeCount = ads.filter((a) => a.isActive).length;
    const inactiveCount = ads.length - activeCount;
    const totalViews = ads.reduce((sum, ad) => sum + (ad.views || 0), 0);

    let message = `📣 Реклама в постах (${ads.length})\n\n`;
    message += `✅ Активных: ${activeCount}\n`;
    message += `⏸️ Неактивных: ${inactiveCount}\n`;
    message += `👁 Всего показов: ${totalViews}\n`;

    // Кнопки фильтров
    const filterButtons = [
      Markup.button.callback(isActive === null ? "• Все" : "Все", "filter_all"),
      Markup.button.callback(
        isActive === true ? "• Активные" : "Активные",
        "filter_active",
      ),
      Markup.button.callback(
        isActive === false ? "• Неактивные" : "Неактивные",
        "filter_inactive",
      ),
    ];

    // Кнопки для рекламы
    const buttons = ads.slice(0, 15).map((ad) => {
      const statusIcon = ad.isActive ? "✅" : "⏸️";
      const textPreview =
        ad.text.substring(0, 30) + (ad.text.length > 30 ? "..." : "");
      const viewsText = ad.maxViews
        ? `${ad.views}/${ad.maxViews}`
        : `${ad.views}`;

      const buttonText = `${statusIcon} ${textPreview} (👁 ${viewsText})`;

      return [
        Markup.button.callback(
          buttonText.substring(0, 60),
          `view_ad_${ad._id}`,
        ),
      ];
    });

    const keyboard = [
      filterButtons,
      ...buttons,
      [Markup.button.callback("➕ Создать рекламу", "create_ad")],
      [Markup.button.callback("« В меню", "back_to_menu")],
    ];

    await safeReply(ctx, message, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    console.error("Error loading ads:", error);
    await safeReply(
      ctx,
      "⚠️ Ошибка при загрузке рекламы",
      Markup.inlineKeyboard([
        [Markup.button.callback("« В меню", "back_to_menu")],
      ]),
    );
  }
}

// Функция отображения деталей рекламы
async function showAdDetails(
  ctx: AdminBotContext,
  services: AdminServices,
  adId: string,
) {
  try {
    const ad = await services.postContentService.get(adId);

    if (!ad) {
      await ctx.editMessageText(
        "❌ Реклама не найдена",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_list")],
        ]),
      );
      return;
    }

    const statusIcon = ad.isActive ? "✅" : "⏸️";

    const details = [
      `📣 Реклама в постах`,
      "",
      `ID: ${ad._id}`,
      `Статус: ${statusIcon} ${ad.isActive ? "Активна" : "Неактивна"}`,
      "",
      `Текст: ${ad.text}`,
      "",
      `Показов: ${ad.views || 0}${ad.maxViews ? ` из ${ad.maxViews}` : ""}`,
      `Приоритет: ${ad.priority}`,
      `Лимит на пользователя: ${ad.perUserLimit}`,
    ];

    // Типы контента
    if (ad.showFor && ad.showFor.length > 0) {
      const types = ad.showFor
        .map((t) => getShowForIcon(t) + " " + getShowForText(t))
        .join(", ");
      details.push("", `Показывать для: ${types}`);
    }

    // Даты
    if (ad.startsAt) {
      details.push("", `Начало: ${new Date(ad.startsAt).toLocaleString("ru")}`);
    }
    if (ad.endsAt) {
      details.push(`Конец: ${new Date(ad.endsAt).toLocaleString("ru")}`);
    }

    details.push(
      "",
      `Создано: ${new Date(ad.createdAt).toLocaleString("ru")}`,
      `Обновлено: ${new Date(ad.updatedAt).toLocaleString("ru")}`,
    );

    const buttons = [];

    // Кнопка активации/деактивации
    buttons.push([
      Markup.button.callback(
        ad.isActive ? "⏸️ Деактивировать" : "▶️ Активировать",
        `toggle_ad_${ad._id}`,
      ),
    ]);

    // Кнопка удаления
    buttons.push([Markup.button.callback("🗑 Удалить", `delete_ad_${ad._id}`)]);

    buttons.push(
      [Markup.button.callback("🧪 Тест", `test_ad_${ad._id}`)],
      [Markup.button.callback("« К списку", "back_to_list")],
      [Markup.button.callback("« В меню", "back_to_menu")],
    );

    await ctx.editMessageText(
      details.join("\n"),
      Markup.inlineKeyboard(buttons),
    );
  } catch (error) {
    console.error("Error showing ad details:", error);
    await ctx.answerCbQuery("⚠️ Ошибка");
  }
}

// Вспомогательные функции
function getShowForIcon(type: string): string {
  switch (type) {
    case "image":
      return "🖼";
    case "video":
      return "🎬";
    case "audio":
      return "🎵";
    case "text":
      return "📝";
    case "any":
      return "🌐";
    default:
      return "❓";
  }
}

function getShowForText(type: string): string {
  switch (type) {
    case "image":
      return "Изображения";
    case "video":
      return "Видео";
    case "audio":
      return "Аудио";
    case "text":
      return "Текст";
    case "any":
      return "Любой";
    default:
      return "Неизвестно";
  }
}
