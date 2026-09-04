// ./scenes/AdminPostContentAdCreateScene.ts
import { log } from "../../logger";
import { Scenes, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { safeReply } from "../utils";
import { ensureAdminSession } from "../utils";
import { parseDateTime } from "../dateInput";
import { showForIcon, showForText } from "../labels";
import type {
  AdminServices,
  AdminBotConfig,
  AdminBotContext,
} from "../../types";

export function getAdminPostContentAdCreateScene(
  services: AdminServices,
  _config: AdminBotConfig,
) {
  const scene = new Scenes.BaseScene<AdminBotContext>(
    "AdminPostContentAdCreateScene",
  );

  // Инициализация при входе
  scene.enter(async (ctx) => {
    const session = ensureAdminSession(ctx);
    session.adDraft = {
      isActive: true,
      showFor: ["any"],
      priority: 1,
      perUserLimit: 1,
    };
    session.adCreateStep = "text";

    await safeReply(
      ctx,
      "📣 Создание рекламы\n\n" +
        "Шаг 1/6: Введите текст рекламного сообщения:",
      Markup.inlineKeyboard([
        [Markup.button.callback("« Отмена", "cancel_ad")],
      ]),
    );
  });

  // Команды — до текстового обработчика, иначе `.on(message("text"))` перехватит
  // `/cancel` и запишет её как значение текущего шага визарда.
  scene.command("cancel", (ctx) => {
    const session = ensureAdminSession(ctx);
    session.adDraft = undefined;
    session.adCreateStep = undefined;
    ctx.scene.enter("AdminPostContentAdListScene");
  });

  // Обработка текстового ввода
  scene.on(message("text"), async (ctx) => {
    const session = ensureAdminSession(ctx);
    const text = ctx.message.text.trim();

    if (!session.adCreateStep) {
      return;
    }

    switch (session.adCreateStep) {
      case "text":
        session.adDraft!.text = text;
        session.adCreateStep = "showFor";

        await safeReply(
          ctx,
          `✅ Текст: ${text.substring(0, 100)}${
            text.length > 100 ? "..." : ""
          }\n\n` + "Шаг 2/6: Для каких типов контента показывать рекламу?",
          Markup.inlineKeyboard([
            [Markup.button.callback("🌐 Любой контент", "showfor_any")],
            [
              Markup.button.callback("🖼 Изображения", "showfor_image"),
              Markup.button.callback("🎬 Видео", "showfor_video"),
            ],
            [
              Markup.button.callback("🎵 Аудио", "showfor_audio"),
              Markup.button.callback("📝 Текст", "showfor_text"),
            ],
            [
              Markup.button.callback(
                "✅ Выбрать несколько",
                "showfor_multiple",
              ),
            ],
            [Markup.button.callback("« Отмена", "cancel_ad")],
          ]),
        );
        break;

      case "maxViews":
        if (text.toLowerCase() === "безлимит" || text === "0") {
          session.adDraft!.maxViews = null;
        } else {
          const maxViews = parseInt(text);
          if (isNaN(maxViews) || maxViews < 0) {
            await safeReply(
              ctx,
              "❌ Введите корректное число или '0' для безлимита:",
              Markup.inlineKeyboard([
                [Markup.button.callback("« Отмена", "cancel_ad")],
              ]),
            );
            return;
          }
          session.adDraft!.maxViews = maxViews;
        }

        session.adCreateStep = "priority";
        await safeReply(
          ctx,
          `✅ Макс. показов: ${session.adDraft!.maxViews || "безлимит"}\n\n` +
            "Шаг 4/6: Введите приоритет (1-10, по умолчанию 1):",
          Markup.inlineKeyboard([
            [Markup.button.callback("⏭ Пропустить (1)", "skip_priority")],
            [Markup.button.callback("« Отмена", "cancel_ad")],
          ]),
        );
        break;

      case "priority": {
        const priority = parseInt(text);
        if (isNaN(priority) || priority < 1 || priority > 10) {
          await safeReply(
            ctx,
            "❌ Введите число от 1 до 10:",
            Markup.inlineKeyboard([
              [Markup.button.callback("⏭ Пропустить (1)", "skip_priority")],
              [Markup.button.callback("« Отмена", "cancel_ad")],
            ]),
          );
          return;
        }

        session.adDraft!.priority = priority;
        session.adCreateStep = "perUserLimit";

        await safeReply(
          ctx,
          `✅ Приоритет: ${priority}\n\n` +
            "Шаг 5/6: Введите лимит показов на одного пользователя (по умолчанию 1):",
          Markup.inlineKeyboard([
            [Markup.button.callback("⏭ Пропустить (1)", "skip_per_user")],
            [Markup.button.callback("« Отмена", "cancel_ad")],
          ]),
        );
        break;
      }

      case "perUserLimit": {
        const perUserLimit = parseInt(text);
        if (isNaN(perUserLimit) || perUserLimit < 1) {
          await safeReply(
            ctx,
            "❌ Введите положительное число:",
            Markup.inlineKeyboard([
              [Markup.button.callback("⏭ Пропустить (1)", "skip_per_user")],
              [Markup.button.callback("« Отмена", "cancel_ad")],
            ]),
          );
          return;
        }

        session.adDraft!.perUserLimit = perUserLimit;
        session.adCreateStep = "dates";

        await askForDates(ctx, session);
        break;
      }

      case "startsAt":
        try {
          const startsAt = parseDateTime(text);
          session.adDraft!.startsAt = startsAt.toISOString();
          session.adCreateStep = "endsAt";

          await safeReply(
            ctx,
            `✅ Начало: ${startsAt.toLocaleString("ru")}\n\n` +
              "Введите дату окончания (ДД.ММ.ГГГГ ЧЧ:ММ):",
            Markup.inlineKeyboard([
              [Markup.button.callback("⏭ Без ограничения", "skip_endsAt")],
              [Markup.button.callback("« Отмена", "cancel_ad")],
            ]),
          );
        } catch {
          await safeReply(
            ctx,
            "❌ Неверный формат. Используйте: ДД.ММ.ГГГГ ЧЧ:ММ",
            Markup.inlineKeyboard([
              [Markup.button.callback("« Отмена", "cancel_ad")],
            ]),
          );
        }
        break;

      case "endsAt":
        try {
          const endsAt = parseDateTime(text);
          session.adDraft!.endsAt = endsAt.toISOString();

          await showConfirmation(ctx, session, services);
        } catch {
          await safeReply(
            ctx,
            "❌ Неверный формат. Используйте: ДД.ММ.ГГГГ ЧЧ:ММ",
            Markup.inlineKeyboard([
              [Markup.button.callback("⏭ Без ограничения", "skip_endsAt")],
              [Markup.button.callback("« Отмена", "cancel_ad")],
            ]),
          );
        }
        break;
    }
  });

  // Выбор типов контента
  scene.action("showfor_any", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    session.adDraft!.showFor = ["any"];
    session.adCreateStep = "maxViews";

    await askForMaxViews(ctx, session);
  });

  scene.action(/^showfor_(image|video|audio|text)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    const type = ctx.match[1] as "image" | "video" | "audio" | "text";
    session.adDraft!.showFor = [type];
    session.adCreateStep = "maxViews";

    await askForMaxViews(ctx, session);
  });

  scene.action("showfor_multiple", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    session.adDraft!.showFor = [];
    session.adDraft!.selectingMultiple = true;

    await safeReply(
      ctx,
      "Выберите типы контента (можно несколько):",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("🖼 Изображения", "toggle_image"),
          Markup.button.callback("🎬 Видео", "toggle_video"),
        ],
        [
          Markup.button.callback("🎵 Аудио", "toggle_audio"),
          Markup.button.callback("📝 Текст", "toggle_text"),
        ],
        [Markup.button.callback("✅ Готово", "done_showfor")],
        [Markup.button.callback("« Отмена", "cancel_ad")],
      ]),
    );
  });

  // Переключение типов при множественном выборе
  scene.action(/^toggle_(image|video|audio|text)$/, async (ctx) => {
    const session = ensureAdminSession(ctx);
    const type = ctx.match[1] as "image" | "video" | "audio" | "text";

    if (!session.adDraft!.showFor) {
      session.adDraft!.showFor = [];
    }

    const index = session.adDraft!.showFor.indexOf(type);
    if (index > -1) {
      session.adDraft!.showFor.splice(index, 1);
    } else {
      session.adDraft!.showFor.push(type);
    }

    const selected = session
      .adDraft!.showFor.map((t) => showForIcon(t))
      .join(" ");

    await ctx.answerCbQuery(`Выбрано: ${selected || "нет"}`);
  });

  scene.action("done_showfor", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);

    if (!session.adDraft!.showFor || session.adDraft!.showFor.length === 0) {
      await ctx.answerCbQuery("⚠️ Выберите хотя бы один тип");
      return;
    }

    session.adCreateStep = "maxViews";
    delete session.adDraft!.selectingMultiple;

    await askForMaxViews(ctx, session);
  });

  // Пропуск полей
  scene.action("skip_priority", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    session.adDraft!.priority = 1;
    session.adCreateStep = "perUserLimit";

    await safeReply(
      ctx,
      "✅ Приоритет: 1\n\n" +
        "Шаг 5/6: Введите лимит показов на одного пользователя:",
      Markup.inlineKeyboard([
        [Markup.button.callback("⏭ Пропустить (1)", "skip_per_user")],
        [Markup.button.callback("« Отмена", "cancel_ad")],
      ]),
    );
  });

  scene.action("skip_per_user", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    session.adDraft!.perUserLimit = 1;
    session.adCreateStep = "dates";

    await askForDates(ctx, session);
  });

  scene.action("skip_startsAt", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    session.adDraft!.startsAt = null;
    session.adCreateStep = "endsAt";

    await safeReply(
      ctx,
      "✅ Начало: с текущего момента\n\n" +
        "Введите дату окончания (ДД.ММ.ГГГГ ЧЧ:ММ):",
      Markup.inlineKeyboard([
        [Markup.button.callback("⏭ Без ограничения", "skip_endsAt")],
        [Markup.button.callback("« Отмена", "cancel_ad")],
      ]),
    );
  });

  scene.action("skip_endsAt", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    session.adDraft!.endsAt = null;

    await showConfirmation(ctx, session, services);
  });

  // Подтверждение создания
  scene.action("confirm_ad", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);

    try {
      const adData = {
        text: session.adDraft!.text!,
        isActive: session.adDraft!.isActive,
        showFor: session.adDraft!.showFor,
        maxViews: session.adDraft!.maxViews,
        priority: session.adDraft!.priority,
        perUserLimit: session.adDraft!.perUserLimit,
        startsAt: session.adDraft!.startsAt,
        endsAt: session.adDraft!.endsAt,
      };

      await services.postContentService.create(adData);

      await safeReply(
        ctx,
        "✅ Реклама успешно создана!",
        Markup.inlineKeyboard([
          [Markup.button.callback("« К списку", "back_to_list")],
          [Markup.button.callback("« В меню", "back_to_menu")],
        ]),
      );

      // Очищаем черновик
      session.adDraft = undefined;
      session.adCreateStep = undefined;
    } catch (error) {
      log.error("Error creating ad:", error);
      await safeReply(
        ctx,
        "⚠️ Ошибка при создании рекламы",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Отмена", "cancel_ad")],
        ]),
      );
    }
  });

  // Отмена создания
  scene.action("cancel_ad", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    session.adDraft = undefined;
    session.adCreateStep = undefined;
    await ctx.scene.enter("AdminPostContentAdListScene");
  });

  // Возврат к списку
  scene.action("back_to_list", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter("AdminPostContentAdListScene");
  });

  // Возврат в меню
  scene.action("back_to_menu", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    session.adDraft = undefined;
    session.adCreateStep = undefined;
    await ctx.scene.enter("MainAdminMenuScene");
  });

  return scene;
}

// Вспомогательные функции
async function askForMaxViews(ctx: AdminBotContext, session: any) {
  await safeReply(
    ctx,
    `✅ Типы: ${session
      .adDraft!.showFor.map((t: string) => showForIcon(t))
      .join(" ")}\n\n` +
      "Шаг 3/6: Введите максимальное количество показов (или 0 для безлимита):",
    Markup.inlineKeyboard([[Markup.button.callback("« Отмена", "cancel_ad")]]),
  );
  session.adCreateStep = "maxViews";
}

async function askForDates(ctx: AdminBotContext, session: any) {
  await safeReply(
    ctx,
    `✅ Лимит на пользователя: ${session.adDraft!.perUserLimit}\n\n` +
      "Шаг 6/6: Введите дату начала показа (ДД.ММ.ГГГГ ЧЧ:ММ):",
    Markup.inlineKeyboard([
      [Markup.button.callback("⏭ С текущего момента", "skip_startsAt")],
      [Markup.button.callback("« Отмена", "cancel_ad")],
    ]),
  );
  session.adCreateStep = "startsAt";
}

async function showConfirmation(
  ctx: AdminBotContext,
  session: any,
  _services: AdminServices,
) {
  const draft = session.adDraft!;

  const summary = [
    "📋 Подтверждение создания рекламы:",
    "",
    `Текст: ${draft.text}`,
    `Типы: ${draft.showFor
      .map((t: string) => showForIcon(t) + " " + showForText(t))
      .join(", ")}`,
    `Макс. показов: ${draft.maxViews || "безлимит"}`,
    `Приоритет: ${draft.priority}`,
    `Лимит на пользователя: ${draft.perUserLimit}`,
  ];

  if (draft.startsAt) {
    summary.push(
      ``,
      `Начало: ${new Date(draft.startsAt).toLocaleString("ru")}`,
    );
  }
  if (draft.endsAt) {
    summary.push(`Конец: ${new Date(draft.endsAt).toLocaleString("ru")}`);
  }

  await safeReply(
    ctx,
    summary.join("\n"),
    Markup.inlineKeyboard([
      [Markup.button.callback("✅ Создать", "confirm_ad")],
      [Markup.button.callback("❌ Отмена", "cancel_ad")],
    ]),
  );

  session.adCreateStep = undefined;
}
