// ./scenes/AdminAssignPromoScene.ts
import { log } from "../../logger";
import { Scenes, Markup } from "telegraf";
import { message } from "telegraf/filters";
import {
  safeReply,
  renderView,
  ensureAdminSession,
  getFoundUser,
} from "../utils";
import type { PromocodeService } from "../../services/promocode";
import type { UserService } from "../../services/user";
import type {
  AdminServices,
  AdminBotConfig,
  AdminBotContext,
  Promo,
} from "../../types";

const PROMOS_PER_PAGE = 5;

export function getAdminAssignPromoScene(
  services: AdminServices,
  _: AdminBotConfig,
) {
  const promocodeService: PromocodeService = services.promocodeService;
  const userService: UserService = services.userService;

  const scene = new Scenes.BaseScene<AdminBotContext>("AdminAssignPromoScene");

  function resetTemp(ctx: AdminBotContext) {
    const s = ctx.session.admin;
    if (!s) return;
    s.waitingForPromoInput = false;
    s.promoPage = undefined;
  }

  // === ENTER ===
  scene.enter(async (ctx) => {
    ensureAdminSession(ctx).promoPage = 0;
    await showPromoPage(ctx, 0);
  });

  // === HANDLER: выбор промокода ===
  scene.action(/^assign_promo_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await assignPromo(ctx, ctx.match[1], false);
  });

  // === HANDLER: принудительная выдача неактивного ===
  scene.action(/^force_assign_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await assignPromo(ctx, ctx.match[1], true);
  });

  // === HANDLER: ручной ввод ===
  scene.action("manual_promo", async (ctx) => {
    await ctx.answerCbQuery();
    ensureAdminSession(ctx).waitingForPromoInput = true;
    await safeReply(
      ctx,
      "Введите код промокода:",
      Markup.inlineKeyboard([
        [Markup.button.callback("« Отмена", "back_to_profile")],
      ]),
    );
  });

  // Команда — до текстового обработчика, иначе `/cancel` уйдёт в ввод кода промокода.
  scene.command("cancel", (ctx) => {
    resetTemp(ctx);
    return ctx.scene.enter("AdminUserProfileScene");
  });

  // === HANDLER: текстовый ввод промокода ===
  scene.on(message("text"), async (ctx) => {
    if (!ctx.session.admin?.waitingForPromoInput) return;
    ctx.session.admin.waitingForPromoInput = false;
    await assignPromo(ctx, ctx.message.text.trim(), false);
  });

  // === HANDLER: пагинация ===
  scene.action("promo_next_page", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    session.promoPage = (session.promoPage ?? 0) + 1;
    await showPromoPage(ctx, session.promoPage);
  });

  scene.action("promo_prev_page", async (ctx) => {
    await ctx.answerCbQuery();
    const session = ensureAdminSession(ctx);
    session.promoPage = Math.max(0, (session.promoPage ?? 0) - 1);
    await showPromoPage(ctx, session.promoPage);
  });

  // === HANDLER: назад ===
  scene.action("back_to_profile", async (ctx) => {
    await ctx.answerCbQuery();
    resetTemp(ctx);
    await ctx.scene.enter("AdminUserProfileScene");
  });

  scene.action("back_to_menu", async (ctx) => {
    await ctx.answerCbQuery();
    resetTemp(ctx);
    ensureAdminSession(ctx).foundUserId = undefined;
    await ctx.scene.enter("MainAdminMenuScene");
  });

  // === INTERNAL: показать страницу промокодов ===
  async function showPromoPage(ctx: AdminBotContext, page: number) {
    const promoCodes = await promocodeService.getAll();

    if (!promoCodes || promoCodes.length === 0) {
      await renderView(
        ctx,
        "⚠️ Нет доступных промокодов",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_profile")],
        ]),
      );
      return;
    }

    const totalPages = Math.ceil(promoCodes.length / PROMOS_PER_PAGE);
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const start = safePage * PROMOS_PER_PAGE;
    const pagePromos = promoCodes.slice(start, start + PROMOS_PER_PAGE);

    const text =
      `🎁 Выберите промокод для выдачи пользователю\n\n` +
      `Страница ${safePage + 1} из ${totalPages}`;

    const buttons = pagePromos.map((promo) => {
      const activeIcon = promo.isActive ? "✅" : "⏸️";
      const dateInfo = promo.activeTo
        ? ` до ${new Date(promo.activeTo).toLocaleDateString("ru")}`
        : "";
      return [
        Markup.button.callback(
          `${activeIcon} ${promo.code} (${promo.discountPercent}%)${dateInfo}`,
          `assign_promo_${promo.code}`,
        ),
      ];
    });

    const navButtons = [];
    if (safePage > 0) {
      navButtons.push(Markup.button.callback("⬅️ Назад", "promo_prev_page"));
    }
    if (safePage < totalPages - 1) {
      navButtons.push(Markup.button.callback("Вперёд ➡️", "promo_next_page"));
    }
    if (navButtons.length > 0) buttons.push(navButtons);

    buttons.push([
      Markup.button.callback("✍️ Ввести код вручную", "manual_promo"),
    ]);
    buttons.push([Markup.button.callback("« Назад", "back_to_profile")]);

    await renderView(ctx, text, Markup.inlineKeyboard(buttons));
  }

  // === INTERNAL: присвоение промокода ===
  async function assignPromo(
    ctx: AdminBotContext,
    promoCode: string,
    force: boolean,
  ) {
    const user = await getFoundUser(ctx, userService);
    if (!user) {
      await safeReply(ctx, "⚠️ Пользователь не найден");
      return ctx.scene.enter("MainAdminMenuScene");
    }

    try {
      if (!force) {
        const promo = (await promocodeService.getAll()).find(
          (p: Promo) => p.code === promoCode,
        );

        if (!promo) {
          await safeReply(
            ctx,
            `❌ Промокод "${promoCode}" не найден`,
            Markup.inlineKeyboard([
              [Markup.button.callback("« Назад", "back_to_profile")],
            ]),
          );
          return;
        }

        if (!promo.isActive) {
          await safeReply(
            ctx,
            `⚠️ Промокод "${promoCode}" неактивен. Всё равно выдать?`,
            Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "✅ Да, выдать",
                  `force_assign_${promoCode}`,
                ),
              ],
              [Markup.button.callback("❌ Отмена", "back_to_profile")],
            ]),
          );
          return;
        }
      }

      await userService.addPromocode(user.userId, promoCode);
      resetTemp(ctx);

      await safeReply(
        ctx,
        `✅ Промокод "${promoCode}" выдан пользователю ${
          user.username ? "@" + user.username : user.userId
        }`,
        Markup.inlineKeyboard([
          [Markup.button.callback("« К профилю", "back_to_profile")],
          [Markup.button.callback("« В меню", "back_to_menu")],
        ]),
      );
    } catch (err) {
      log.error("Error assigning promo:", err);
      await safeReply(
        ctx,
        "⚠️ Ошибка при выдаче промокода",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_profile")],
        ]),
      );
    }
  }

  return scene;
}
