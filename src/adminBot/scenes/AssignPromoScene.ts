// ./scenes/AdminAssignPromoScene.ts
import { Scenes, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { safeReply } from "../utils";
import type { PromocodeService } from "../../services/promocode";
import type { UserService } from "../../services/user";
import type {
  AdminServices,
  AdminBotConfig,
  AdminBotContext,
} from "../../types";

const PROMOS_PER_PAGE = 5;

export function getAdminAssignPromoScene(
  services: AdminServices,
  _: AdminBotConfig
) {
  const promocodeService: PromocodeService = services.promocodeService;
  const userService: UserService = services.userService;

  const scene = new Scenes.BaseScene<AdminBotContext>("AdminAssignPromoScene");

  // === ENTER ===
  scene.enter(async (ctx) => {
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }

    // Инициализируем страницу
    ctx.session.admin.promoPage = 0;

    const promoCodes = await promocodeService.getAll();

    if (!promoCodes || promoCodes.length === 0) {
      await safeReply(
        ctx,
        "⚠️ Нет доступных промокодов",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_profile")],
        ])
      );
      return;
    }

    // Сохраняем список промокодов в сессию
    ctx.session.admin.promoList = promoCodes;

    await showPromoPage(ctx, promoCodes, 0);
  });

  // === HANDLER: выбор промокода ===
  scene.action(/^assign_promo_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const promoCode = ctx.match[1];
    await assignPromo(ctx, promoCode);
  });

  // === HANDLER: ручной ввод ===
  scene.action("manual_promo", async (ctx) => {
    await ctx.answerCbQuery();
    await safeReply(
      ctx,
      "Введите код промокода:",
      Markup.inlineKeyboard([
        [Markup.button.callback("« Отмена", "back_to_profile")],
      ])
    );

    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    ctx.session.admin.waitingForPromoInput = true;
  });

  // === HANDLER: текстовый ввод промокода ===
  scene.on(message("text"), async (ctx) => {
    if (ctx.session.admin?.waitingForPromoInput) {
      const promoCode = ctx.message.text.trim();
      ctx.session.admin.waitingForPromoInput = false;

      await assignPromo(ctx, promoCode);
    }
  });

  // === HANDLER: пагинация - следующая страница ===
  scene.action("promo_next_page", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ctx.session.admin;

    if (!session || !session.promoList) return;

    const currentPage = session.promoPage || 0;
    const totalPages = Math.ceil(session.promoList.length / PROMOS_PER_PAGE);

    if (currentPage < totalPages - 1) {
      session.promoPage = currentPage + 1;
      await showPromoPage(ctx, session.promoList, session.promoPage);
    }
  });

  // === HANDLER: пагинация - предыдущая страница ===
  scene.action("promo_prev_page", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ctx.session.admin;

    if (!session || !session.promoList) return;

    const currentPage = session.promoPage || 0;

    if (currentPage > 0) {
      session.promoPage = currentPage - 1;
      await showPromoPage(ctx, session.promoList, session.promoPage);
    }
  });

  // === HANDLER: назад к профилю ===
  scene.action("back_to_profile", async (ctx) => {
    await ctx.answerCbQuery();

    if (ctx.session.admin) {
      ctx.session.admin.waitingForPromoInput = false;
      ctx.session.admin.promoList = undefined;
      ctx.session.admin.promoPage = undefined;
    }

    await ctx.scene.enter("AdminUserProfileScene");
  });

  // === HANDLER: назад в меню ===
  scene.action("back_to_menu", async (ctx) => {
    await ctx.answerCbQuery();

    if (ctx.session.admin) {
      ctx.session.admin.foundUser = undefined;
      ctx.session.admin.promoList = undefined;
      ctx.session.admin.promoPage = undefined;
    }

    await ctx.scene.enter("MainAdminMenuScene");
  });

  // === INTERNAL: показать страницу промокодов ===
  async function showPromoPage(
    ctx: AdminBotContext,
    promoCodes: any[],
    page: number
  ) {
    const totalPages = Math.ceil(promoCodes.length / PROMOS_PER_PAGE);
    const start = page * PROMOS_PER_PAGE;
    const end = start + PROMOS_PER_PAGE;
    const pagePromos = promoCodes.slice(start, end);

    let message = `🎁 Выберите промокод для выдачи пользователю\n\n`;
    message += `Страница ${page + 1} из ${totalPages}`;

    const buttons = pagePromos.map((promo) => {
      const activeIcon = promo.isActive ? "✅" : "⏸️";
      const dateInfo = promo.activeTo
        ? ` до ${new Date(promo.activeTo).toLocaleDateString("ru")}`
        : "";

      return [
        Markup.button.callback(
          `${activeIcon} ${promo.code} (${promo.discountPercent}%)${dateInfo}`,
          `assign_promo_${promo.code}`
        ),
      ];
    });

    // Кнопки навигации
    const navButtons = [];
    if (page > 0) {
      navButtons.push(Markup.button.callback("⬅️ Назад", "promo_prev_page"));
    }
    if (page < totalPages - 1) {
      navButtons.push(Markup.button.callback("Вперёд ➡️", "promo_next_page"));
    }

    if (navButtons.length > 0) {
      buttons.push(navButtons);
    }

    // Дополнительные кнопки
    buttons.push([
      Markup.button.callback("✍️ Ввести код вручную", "manual_promo"),
    ]);
    buttons.push([Markup.button.callback("« Назад", "back_to_profile")]);

    // Используем editMessageText если это callback, иначе reply
    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, Markup.inlineKeyboard(buttons));
      } else {
        await safeReply(ctx, message, Markup.inlineKeyboard(buttons));
      }
    } catch {
      // Если не удалось отредактировать, отправляем новое сообщение
      await safeReply(ctx, message, Markup.inlineKeyboard(buttons));
    }
  }

  // === INTERNAL: присвоение промокода ===
  async function assignPromo(ctx: AdminBotContext, promoCode: string) {
    const user = ctx.session.admin?.foundUser;

    if (!user) {
      await safeReply(ctx, "⚠️ Пользователь не найден");
      return ctx.scene.enter("MainAdminMenuScene");
    }

    try {
      const allPromo = await promocodeService.getAll();
      const promo = allPromo.find((p) => p.code === promoCode);

      if (!promo) {
        await safeReply(
          ctx,
          `❌ Промокод "${promoCode}" не найден`,
          Markup.inlineKeyboard([
            [Markup.button.callback("« Назад", "back_to_profile")],
          ])
        );
        return;
      }

      // Проверяем, активен ли промокод
      if (!promo.isActive) {
        await safeReply(
          ctx,
          `⚠️ Промокод "${promoCode}" неактивен. Всё равно выдать?`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "✅ Да, выдать",
                `force_assign_${promoCode}`
              ),
            ],
            [Markup.button.callback("❌ Отмена", "back_to_profile")],
          ])
        );
        return;
      }

      await userService.addPromocode(user.userId.toString(), promoCode);

      // Обновляем данные пользователя в сессии
      const updatedUser = await userService.getById(user.userId.toString());
      if (updatedUser) {
        ctx.session.admin!.foundUser = updatedUser;
      }

      await safeReply(
        ctx,
        `✅ Промокод "${promoCode}" успешно выдан пользователю ${
          user.username ? "@" + user.username : user.userId
        }`,
        Markup.inlineKeyboard([
          [Markup.button.callback("« К профилю", "back_to_profile")],
          [Markup.button.callback("« В меню", "back_to_menu")],
        ])
      );

      // Очищаем временные данные
      if (ctx.session.admin) {
        ctx.session.admin.promoList = undefined;
        ctx.session.admin.promoPage = undefined;
      }
    } catch (err) {
      console.error("Error assigning promo:", err);
      await safeReply(
        ctx,
        "⚠️ Ошибка при выдаче промокода",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_profile")],
        ])
      );
    }
  }

  // === HANDLER: принудительное присвоение неактивного промокода ===
  scene.action(/^force_assign_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const promoCode = ctx.match[1];
    const user = ctx.session.admin?.foundUser;

    if (!user) {
      await safeReply(ctx, "⚠️ Пользователь не найден");
      return ctx.scene.enter("MainAdminMenuScene");
    }

    try {
      await userService.addPromocode(user.userId.toString(), promoCode);

      // Обновляем данные пользователя
      const updatedUser = await userService.getById(user.userId.toString());
      if (updatedUser) {
        ctx.session.admin!.foundUser = updatedUser;
      }

      await safeReply(
        ctx,
        `✅ Промокод "${promoCode}" выдан пользователю ${
          user.username ? "@" + user.username : user.userId
        }`,
        Markup.inlineKeyboard([
          [Markup.button.callback("« К профилю", "back_to_profile")],
          [Markup.button.callback("« В меню", "back_to_menu")],
        ])
      );

      // Очищаем временные данные
      if (ctx.session.admin) {
        ctx.session.admin.promoList = undefined;
        ctx.session.admin.promoPage = undefined;
      }
    } catch (err) {
      console.error("Error force assigning promo:", err);
      await safeReply(
        ctx,
        "⚠️ Ошибка при выдаче промокода",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_profile")],
        ])
      );
    }
  });

  return scene;
}
