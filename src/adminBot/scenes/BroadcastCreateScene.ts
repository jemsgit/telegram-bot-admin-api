// ./scenes/AdminBroadcastCreateScene.ts
import { Scenes, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { safeReply } from "../utils";
import type {
  AdminServices,
  AdminBotConfig,
  AdminBotContext,
} from "../../types";

export function getAdminBroadcastCreateScene(
  services: AdminServices,
  config: AdminBotConfig
) {
  const scene = new Scenes.BaseScene<AdminBotContext>(
    "AdminBroadcastCreateScene"
  );

  // Инициализация при входе
  scene.enter(async (ctx) => {
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    const session = ctx.session.admin;
    session.broadcastDraft = {
      type: "text",
      excludePaid: false,
      linkButtons: [],
    };
    session.broadcastStep = "title";

    await safeReply(
      ctx,
      "📢 Создание рассылки\n\n" +
        "Шаг 1/6: Введите название рассылки (для внутреннего использования):",
      Markup.inlineKeyboard([
        [Markup.button.callback("« Отмена", "cancel_broadcast")],
      ])
    );
  });

  // Обработка текстового ввода
  scene.on(message("text"), async (ctx) => {
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    const session = ctx.session.admin;
    const text = ctx.message.text.trim();

    if (!session.broadcastStep) {
      return;
    }

    switch (session.broadcastStep) {
      case "title":
        session.broadcastDraft!.title = text;
        session.broadcastStep = "type";

        await safeReply(
          ctx,
          `✅ Название: ${text}\n\n` + "Шаг 2/6: Выберите тип рассылки:",
          Markup.inlineKeyboard([
            [Markup.button.callback("📝 Текст", "type_text")],
            [Markup.button.callback("🖼 Фото", "type_photo")],
            [Markup.button.callback("🎬 Видео", "type_video")],
            [Markup.button.callback("« Отмена", "cancel_broadcast")],
          ])
        );
        break;

      case "text":
        session.broadcastDraft!.text = text;
        session.broadcastStep = "schedule";

        await askForSchedule(ctx, session);
        break;

      case "mediaUrl":
        // Проверяем URL
        if (!isValidUrl(text)) {
          await safeReply(
            ctx,
            "❌ Неверный формат URL. Введите корректную ссылку:",
            Markup.inlineKeyboard([
              [Markup.button.callback("« Отмена", "cancel_broadcast")],
            ])
          );
          return;
        }

        session.broadcastDraft!.mediaUrl = text;
        session.broadcastStep = "text";

        await safeReply(
          ctx,
          `✅ Медиа: ${text}\n\n` +
            "Шаг 4/6: Введите текст сообщения (подпись к медиа):",
          Markup.inlineKeyboard([
            [Markup.button.callback("⏭ Без текста", "skip_text")],
            [Markup.button.callback("« Отмена", "cancel_broadcast")],
          ])
        );
        break;

      case "scheduledAt":
        try {
          const scheduledDate = parseDateTime(text);

          if (scheduledDate < new Date()) {
            await safeReply(
              ctx,
              "❌ Дата и время не могут быть в прошлом. Введите корректные данные:",
              Markup.inlineKeyboard([
                [Markup.button.callback("⏭ Отправить сейчас", "send_now")],
                [Markup.button.callback("« Отмена", "cancel_broadcast")],
              ])
            );
            return;
          }

          session.broadcastDraft!.scheduledAt = scheduledDate;
          session.broadcastStep = "excludePaid";

          await askForExcludePaid(ctx, session);
        } catch (error) {
          await safeReply(
            ctx,
            "❌ Неверный формат даты/времени. Используйте формат: ДД.ММ.ГГГГ ЧЧ:ММ\n" +
              "Например: 25.12.2025 15:30",
            Markup.inlineKeyboard([
              [Markup.button.callback("⏭ Отправить сейчас", "send_now")],
              [Markup.button.callback("« Отмена", "cancel_broadcast")],
            ])
          );
        }
        break;

      case "linkButton":
        // Формат: "Текст кнопки|https://example.com"
        const parts = text.split("|");

        if (parts.length !== 2 || !isValidUrl(parts[1].trim())) {
          await safeReply(
            ctx,
            "❌ Неверный формат. Используйте:\nТекст кнопки|https://example.com\n\n" +
              "Например:\nПерейти на сайт|https://example.com",
            Markup.inlineKeyboard([
              [Markup.button.callback("⏭ Без кнопок", "skip_buttons")],
              [Markup.button.callback("« Отмена", "cancel_broadcast")],
            ])
          );
          return;
        }

        const buttonText = parts[0].trim();
        const buttonUrl = parts[1].trim();

        session.broadcastDraft!.linkButtons =
          session.broadcastDraft!.linkButtons || [];
        session.broadcastDraft!.linkButtons.push({
          text: buttonText,
          url: buttonUrl,
        });

        await safeReply(
          ctx,
          `✅ Кнопка добавлена: "${buttonText}"\n\n` +
            `Всего кнопок: ${session.broadcastDraft!.linkButtons.length}\n\n` +
            "Добавить ещё кнопку или завершить?",
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "➕ Добавить ещё кнопку",
                "add_more_button"
              ),
            ],
            [
              Markup.button.callback(
                "✅ Завершить добавление",
                "finish_buttons"
              ),
            ],
            [Markup.button.callback("« Отмена", "cancel_broadcast")],
          ])
        );
        break;
    }
  });

  // Обработка фото
  scene.on(message("photo"), async (ctx) => {
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }

    const session = ctx.session.admin;

    if (
      session.broadcastStep === "mediaUrl" &&
      session.broadcastDraft?.type === "photo"
    ) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileId = photo.file_id;

      // Сохраняем file_id вместо URL
      session.broadcastDraft!.mediaUrl = fileId;
      session.broadcastStep = "text";

      await safeReply(
        ctx,
        "✅ Фото получено\n\n" +
          "Шаг 4/6: Введите текст сообщения (подпись к фото):",
        Markup.inlineKeyboard([
          [Markup.button.callback("⏭ Без текста", "skip_text")],
          [Markup.button.callback("« Отмена", "cancel_broadcast")],
        ])
      );
    }
  });

  // Обработка видео
  scene.on(message("video"), async (ctx) => {
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    const session = ctx.session.admin;

    if (
      session.broadcastStep === "mediaUrl" &&
      session.broadcastDraft?.type === "video"
    ) {
      const video = ctx.message.video;
      const fileId = video.file_id;

      session.broadcastDraft!.mediaUrl = fileId;
      session.broadcastStep = "text";

      await safeReply(
        ctx,
        "✅ Видео получено\n\n" +
          "Шаг 4/6: Введите текст сообщения (подпись к видео):",
        Markup.inlineKeyboard([
          [Markup.button.callback("⏭ Без текста", "skip_text")],
          [Markup.button.callback("« Отмена", "cancel_broadcast")],
        ])
      );
    }
  });

  // Выбор типа рассылки
  scene.action("type_text", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    const session = ctx.session.admin;
    session.broadcastDraft!.type = "text";
    session.broadcastStep = "text";

    await safeReply(
      ctx,
      "✅ Тип: Текст\n\n" + "Шаг 3/6: Введите текст сообщения:",
      Markup.inlineKeyboard([
        [Markup.button.callback("« Отмена", "cancel_broadcast")],
      ])
    );
  });

  scene.action("type_photo", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    const session = ctx.session.admin;
    session.broadcastDraft!.type = "photo";
    session.broadcastStep = "mediaUrl";

    await safeReply(
      ctx,
      "✅ Тип: Фото\n\n" + "Шаг 3/6: Отправьте фото или ссылку на изображение:",
      Markup.inlineKeyboard([
        [Markup.button.callback("« Отмена", "cancel_broadcast")],
      ])
    );
  });

  scene.action("type_video", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    const session = ctx.session.admin;
    session.broadcastDraft!.type = "video";
    session.broadcastStep = "mediaUrl";

    await safeReply(
      ctx,
      "✅ Тип: Видео\n\n" + "Шаг 3/6: Отправьте видео или ссылку на видеофайл:",
      Markup.inlineKeyboard([
        [Markup.button.callback("« Отмена", "cancel_broadcast")],
      ])
    );
  });

  // Пропуск текста для медиа
  scene.action("skip_text", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    const session = ctx.session.admin;
    session.broadcastDraft!.text = "";
    session.broadcastStep = "schedule";

    await askForSchedule(ctx, session);
  });

  // Отправить сейчас
  scene.action("send_now", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    const session = ctx.session.admin;
    session.broadcastDraft!.scheduledAt = new Date();
    session.broadcastStep = "excludePaid";

    await askForExcludePaid(ctx, session);
  });

  // Исключить платных пользователей
  scene.action("exclude_paid_yes", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    const session = ctx.session.admin;
    session.broadcastDraft!.excludePaid = true;
    session.broadcastStep = "linkButton";

    await askForLinkButtons(ctx, session);
  });

  scene.action("exclude_paid_no", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    const session = ctx.session.admin;
    session.broadcastDraft!.excludePaid = false;
    session.broadcastStep = "linkButton";

    await askForLinkButtons(ctx, session);
  });

  // Кнопки
  scene.action("skip_buttons", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ctx.session.admin;
    await showConfirmation(ctx, session, services);
  });

  scene.action("add_more_button", async (ctx) => {
    await ctx.answerCbQuery();
    await safeReply(
      ctx,
      "Введите данные кнопки в формате:\nТекст кнопки|https://example.com",
      Markup.inlineKeyboard([
        [Markup.button.callback("✅ Завершить добавление", "finish_buttons")],
        [Markup.button.callback("« Отмена", "cancel_broadcast")],
      ])
    );
  });

  scene.action("finish_buttons", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ctx.session.admin;
    await showConfirmation(ctx, session, services);
  });

  // Подтверждение создания
  scene.action("confirm_broadcast", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    const session = ctx.session.admin;

    try {
      const broadcast = {
        title: session.broadcastDraft!.title,
        type: session.broadcastDraft!.type || "text",
        text: session.broadcastDraft!.text || "",
        mediaUrl: session.broadcastDraft!.mediaUrl,
        scheduledAt: session.broadcastDraft!.scheduledAt?.toISOString(),
        status: "pending",
        excludePaid: session.broadcastDraft!.excludePaid,
        linkButtons: session.broadcastDraft!.linkButtons || [],
        sentUsers: [],
      };

      await services.broadcastService.create(broadcast);

      const isNow =
        new Date(broadcast.scheduledAt!).getTime() - Date.now() < 60000;
      const statusMessage = isNow
        ? "✅ Рассылка запущена!"
        : `✅ Рассылка запланирована на ${new Date(
            broadcast.scheduledAt!
          ).toLocaleString("ru")}`;

      await safeReply(
        ctx,
        statusMessage,
        Markup.inlineKeyboard([
          [Markup.button.callback("« К списку рассылок", "back_to_broadcasts")],
          [Markup.button.callback("« В меню", "back_to_menu")],
        ])
      );

      // Очищаем черновик
      session.broadcastDraft = undefined;
      session.broadcastStep = undefined;
    } catch (error) {
      console.error("Error creating broadcast:", error);
      await safeReply(
        ctx,
        "⚠️ Ошибка при создании рассылки",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Отмена", "cancel_broadcast")],
        ])
      );
    }
  });

  // Отмена создания
  scene.action("cancel_broadcast", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    const session = ctx.session.admin;
    session.broadcastDraft = undefined;
    session.broadcastStep = undefined;
    await ctx.scene.enter("AdminBroadcastListScene");
  });

  // Возврат к списку
  scene.action("back_to_broadcasts", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter("AdminBroadcastListScene");
  });

  // Возврат в меню
  scene.action("back_to_menu", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    const session = ctx.session.admin;
    session.broadcastDraft = undefined;
    session.broadcastStep = undefined;
    await ctx.scene.enter("MainAdminMenuScene");
  });

  scene.command("cancel", (ctx) => {
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    const session = ctx.session.admin;

    session.broadcastDraft = undefined;
    session.broadcastStep = undefined;
    ctx.scene.enter("AdminBroadcastListScene");
  });

  return scene;
}

// Вспомогательные функции
async function askForSchedule(ctx: AdminBotContext, session: any) {
  await safeReply(
    ctx,
    `✅ Текст сообщения сохранен\n\n` +
      "Шаг 5/6: Когда отправить рассылку?\n\n" +
      "Введите дату и время в формате: ДД.ММ.ГГГГ ЧЧ:ММ\n" +
      "Например: 25.12.2025 15:30",
    Markup.inlineKeyboard([
      [Markup.button.callback("📤 Отправить сейчас", "send_now")],
      [Markup.button.callback("« Отмена", "cancel_broadcast")],
    ])
  );
  session.broadcastStep = "scheduledAt";
}

async function askForExcludePaid(ctx: AdminBotContext, session: any) {
  const scheduleText = session.broadcastDraft!.scheduledAt
    ? new Date(session.broadcastDraft!.scheduledAt).toLocaleString("ru")
    : "сейчас";

  await safeReply(
    ctx,
    `✅ Время отправки: ${scheduleText}\n\n` +
      "Шаг 6/6: Исключить пользователей с активной подпиской?",
    Markup.inlineKeyboard([
      [
        Markup.button.callback("✅ Да, исключить", "exclude_paid_yes"),
        Markup.button.callback("❌ Нет, всем", "exclude_paid_no"),
      ],
      [Markup.button.callback("« Отмена", "cancel_broadcast")],
    ])
  );
}

async function askForLinkButtons(ctx: AdminBotContext, session: any) {
  await safeReply(
    ctx,
    "Хотите добавить кнопки со ссылками?\n\n" +
      "Формат: Текст кнопки|https://example.com\n" +
      "Например: Перейти на сайт|https://example.com",
    Markup.inlineKeyboard([
      [Markup.button.callback("➕ Добавить кнопку", "add_more_button")],
      [Markup.button.callback("⏭ Без кнопок", "skip_buttons")],
      [Markup.button.callback("« Отмена", "cancel_broadcast")],
    ])
  );
}

async function showConfirmation(
  ctx: AdminBotContext,
  session: any,
  services: AdminServices
) {
  const draft = session.broadcastDraft!;

  const typeEmoji =
    draft.type === "text" ? "📝" : draft.type === "photo" ? "🖼" : "🎬";
  const scheduleText = draft.scheduledAt
    ? new Date(draft.scheduledAt).toLocaleString("ru")
    : "сейчас";

  const summary = [
    "📋 Подтверждение создания рассылки:",
    "",
    `Название: ${draft.title}`,
    `Тип: ${typeEmoji} ${draft.type}`,
    `Текст: ${
      draft.text
        ? draft.text.substring(0, 100) + (draft.text.length > 100 ? "..." : "")
        : "—"
    }`,
    draft.mediaUrl
      ? `Медиа: ${draft.mediaUrl.startsWith("http") ? "URL" : "Прикреплено"}`
      : "",
    `Отправка: ${scheduleText}`,
    `Исключить платных: ${draft.excludePaid ? "Да" : "Нет"}`,
  ];

  if (draft.linkButtons && draft.linkButtons.length > 0) {
    summary.push("", `Кнопок: ${draft.linkButtons.length}`);
    draft.linkButtons.forEach((btn: any, i: number) => {
      summary.push(`  ${i + 1}. ${btn.text} → ${btn.url}`);
    });
  }

  await safeReply(
    ctx,
    summary.filter(Boolean).join("\n"),
    Markup.inlineKeyboard([
      [Markup.button.callback("✅ Создать рассылку", "confirm_broadcast")],
      [Markup.button.callback("❌ Отмена", "cancel_broadcast")],
    ])
  );

  session.broadcastStep = undefined;
}

function parseDateTime(dateTimeString: string): Date {
  // Формат: ДД.ММ.ГГГГ ЧЧ:ММ
  const parts = dateTimeString.trim().split(" ");

  if (parts.length !== 2) {
    throw new Error("Invalid format");
  }

  const dateParts = parts[0].split(".");
  const timeParts = parts[1].split(":");

  if (dateParts.length !== 3 || timeParts.length !== 2) {
    throw new Error("Invalid format");
  }

  const day = parseInt(dateParts[0]);
  const month = parseInt(dateParts[1]) - 1;
  const year = parseInt(dateParts[2]);
  const hours = parseInt(timeParts[0]);
  const minutes = parseInt(timeParts[1]);

  if (
    isNaN(day) ||
    isNaN(month) ||
    isNaN(year) ||
    isNaN(hours) ||
    isNaN(minutes)
  ) {
    throw new Error("Invalid format");
  }

  const date = new Date(year, month, day, hours, minutes);

  if (
    date.getDate() !== day ||
    date.getMonth() !== month ||
    date.getFullYear() !== year ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes
  ) {
    throw new Error("Invalid date");
  }

  return date;
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}
