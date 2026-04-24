// ./scenes/AdminPromoCreateScene.ts
import { Scenes, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { safeReply } from "../utils";
import { ensureAdminSession } from "../utils";
import type {
  AdminServices,
  AdminBotConfig,
  AdminBotContext,
  Promo,
} from "../../types";

export function getAdminPromoCreateScene(
  services: AdminServices,
  _config: AdminBotConfig
) {
  const scene = new Scenes.BaseScene<AdminBotContext>("AdminPromoCreateScene");

  // Инициализация при входе
  scene.enter(async (ctx) => {
    const session = ensureAdminSession(ctx);
    session.promoDraft = {}; // Очищаем черновик

    await safeReply(
      ctx,
      "➕ Создание промокода\n\n" +
        "Шаг 1/5: Введите код промокода (например: SALE20):",
      Markup.inlineKeyboard([
        [Markup.button.callback("« Отмена", "cancel_create")],
      ])
    );

    session.promoCreateStep = "code";
  });

  // Обработка текстового ввода
  scene.on(message("text"), async (ctx) => {
    const session = ensureAdminSession(ctx);
    const text = ctx.message.text.trim();

    if (!session.promoCreateStep) {
      return;
    }

    switch (session.promoCreateStep) {
      case "code": {
        // Проверяем уникальность кода
        const promos = await services.promocodeService.getAll();
        const existing = promos.find((item) => item.code === text);
        if (existing) {
          await safeReply(
            ctx,
            "❌ Промокод с таким кодом уже существует. Введите другой код:",
            Markup.inlineKeyboard([
              [Markup.button.callback("« Отмена", "cancel_create")],
            ])
          );
          return;
        }

        session.promoDraft!.code = text.toUpperCase();
        session.promoCreateStep = "discount";

        await safeReply(
          ctx,
          `✅ Код: ${session.promoDraft!.code}\n\n` +
            "Шаг 2/5: Введите процент скидки (например: 20):",
          Markup.inlineKeyboard([
            [Markup.button.callback("« Отмена", "cancel_create")],
          ])
        );
        break;
      }

      case "discount": {
        const discount = parseInt(text);
        if (isNaN(discount) || discount <= 0 || discount > 100) {
          await safeReply(
            ctx,
            "❌ Введите корректное число от 1 до 100:",
            Markup.inlineKeyboard([
              [Markup.button.callback("« Отмена", "cancel_create")],
            ])
          );
          return;
        }

        session.promoDraft!.discountPercent = discount;
        session.promoCreateStep = "price";

        await safeReply(
          ctx,
          `✅ Скидка: ${discount}%\n\n` +
            "Шаг 3/5: Введите цену в рублях (или 0 если бесплатно):",
          Markup.inlineKeyboard([
            [Markup.button.callback("« Отмена", "cancel_create")],
          ])
        );
        break;
      }

      case "price": {
        const price = parseFloat(text);
        if (isNaN(price) || price < 0) {
          await safeReply(
            ctx,
            "❌ Введите корректное число (0 или больше):",
            Markup.inlineKeyboard([
              [Markup.button.callback("« Отмена", "cancel_create")],
            ])
          );
          return;
        }

        session.promoDraft!.price = price;
        session.promoCreateStep = "description";

        await safeReply(
          ctx,
          `✅ Цена: ${price} ₽\n\n` + "Шаг 4/5: Введите описание промокода:",
          Markup.inlineKeyboard([
            [Markup.button.callback("⏭ Пропустить", "skip_description")],
            [Markup.button.callback("« Отмена", "cancel_create")],
          ])
        );
        break;
      }

      case "description":
        session.promoDraft!.description = text;
        session.promoCreateStep = "dates";

        await askForDates(ctx, session);
        break;

      case "activeFrom":
        try {
          const dateFrom = parseDate(text);
          session.promoDraft!.activeFrom = dateFrom;
          session.promoCreateStep = "activeTo";

          await safeReply(
            ctx,
            `✅ Активен с: ${dateFrom.toLocaleDateString("ru")}\n\n` +
              "Введите дату окончания (ДД.ММ.ГГГГ):",
            Markup.inlineKeyboard([
              [Markup.button.callback("⏭ Без ограничения", "skip_activeTo")],
              [Markup.button.callback("« Отмена", "cancel_create")],
            ])
          );
        } catch {
          await safeReply(
            ctx,
            "❌ Неверный формат даты. Используйте ДД.ММ.ГГГГ (например: 01.12.2025):",
            Markup.inlineKeyboard([
              [Markup.button.callback("« Отмена", "cancel_create")],
            ])
          );
        }
        break;

      case "activeTo":
        try {
          const dateTo = parseDate(text);
          session.promoDraft!.activeTo = dateTo;

          await showConfirmation(ctx, session, services);
        } catch {
          await safeReply(
            ctx,
            "❌ Неверный формат даты. Используйте ДД.ММ.ГГГГ (например: 31.12.2025):",
            Markup.inlineKeyboard([
              [Markup.button.callback("⏭ Без ограничения", "skip_activeTo")],
              [Markup.button.callback("« Отмена", "cancel_create")],
            ])
          );
        }
        break;
    }
  });

  // Пропуск описания
  scene.action("skip_description", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    session.promoCreateStep = "dates";
    await askForDates(ctx, session);
  });

  // Пропуск даты начала
  scene.action("skip_activeFrom", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    session.promoDraft!.activeFrom = new Date();
    session.promoCreateStep = "activeTo";

    await safeReply(
      ctx,
      "✅ Активен с: сейчас\n\n" + "Введите дату окончания (ДД.ММ.ГГГГ):",
      Markup.inlineKeyboard([
        [Markup.button.callback("⏭ Без ограничения", "skip_activeTo")],
        [Markup.button.callback("« Отмена", "cancel_create")],
      ])
    );
  });

  // Пропуск даты окончания
  scene.action("skip_activeTo", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    await showConfirmation(ctx, session, services);
  });

  // Подтверждение создания
  scene.action("confirm_create", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);

    try {
      const promo = session.promoDraft!;
      promo.isActive = true;
      promo.segments = [];

      await services.promocodeService.create(promo as Promo);

      await safeReply(
        ctx,
        `✅ Промокод "${promo.code}" успешно создан!`,
        Markup.inlineKeyboard([
          [Markup.button.callback("« К списку", "back_to_list")],
          [Markup.button.callback("« В меню", "back_to_menu")],
        ])
      );

      // Очищаем черновик
      session.promoDraft = undefined;
      session.promoCreateStep = undefined;
    } catch {
      console.error("Error creating promo:", error);
      await safeReply(
        ctx,
        "⚠️ Ошибка при создании промокода",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Отмена", "cancel_create")],
        ])
      );
    }
  });

  // Отмена создания
  scene.action("cancel_create", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    session.promoDraft = undefined;
    session.promoCreateStep = undefined;
    await ctx.scene.enter("AdminPromoListScene");
  });

  // Возврат к списку
  scene.action("back_to_list", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter("AdminPromoListScene");
  });

  // Возврат в меню
  scene.action("back_to_menu", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    session.promoDraft = undefined;
    session.promoCreateStep = undefined;
    await ctx.scene.enter("MainAdminMenuScene");
  });

  scene.command("cancel", (ctx) => {
    const session = ensureAdminSession(ctx);
    session.promoDraft = undefined;
    session.promoCreateStep = undefined;
    ctx.scene.enter("AdminPromoListScene");
  });

  return scene;
}

// Вспомогательные функции
async function askForDates(ctx: AdminBotContext, session: any) {
  await safeReply(
    ctx,
    `✅ Описание: ${session.promoDraft!.description || "—"}\n\n` +
      "Шаг 5/5: Введите дату начала действия (ДД.ММ.ГГГГ, например: 01.12.2025):",
    Markup.inlineKeyboard([
      [Markup.button.callback("⏭ С текущего момента", "skip_activeFrom")],
      [Markup.button.callback("« Отмена", "cancel_create")],
    ])
  );
  session.promoCreateStep = "activeFrom";
}

async function showConfirmation(
  ctx: AdminBotContext,
  session: any,
  _services: AdminServices
) {
  const promo = session.promoDraft!;

  const summary = [
    "📋 Подтверждение создания промокода:",
    "",
    `Код: ${promo.code}`,
    `Скидка: ${promo.discountPercent}%`,
    `Цена: ${promo.price} ₽`,
    `Описание: ${promo.description || "—"}`,
    `Активен с: ${
      promo.activeFrom
        ? new Date(promo.activeFrom).toLocaleDateString("ru")
        : "сейчас"
    }`,
    `Активен до: ${
      promo.activeTo
        ? new Date(promo.activeTo).toLocaleDateString("ru")
        : "без ограничения"
    }`,
  ];

  await safeReply(
    ctx,
    summary.join("\n"),
    Markup.inlineKeyboard([
      [Markup.button.callback("✅ Создать", "confirm_create")],
      [Markup.button.callback("❌ Отмена", "cancel_create")],
    ])
  );

  session.promoCreateStep = undefined;
}

function parseDate(dateString: string): Date {
  const parts = dateString.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid date format");
  }

  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1; // месяцы с 0
  const year = parseInt(parts[2]);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error("Invalid date format");
  }

  const date = new Date(year, month, day);

  if (
    date.getDate() !== day ||
    date.getMonth() !== month ||
    date.getFullYear() !== year
  ) {
    throw new Error("Invalid date");
  }

  return date;
}
