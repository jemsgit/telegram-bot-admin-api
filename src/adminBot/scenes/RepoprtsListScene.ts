// ./scenes/AdminReportsListScene.ts
import { log } from "../../logger";
import { Scenes, Markup } from "telegraf";
import { message } from "telegraf/filters";
import type { AdminServices, AdminBotContext } from "../../types";
import { renderView, ensureAdminSession, setFoundUser } from "../utils";

type Ctx = AdminBotContext;

export function getAdminReportsListScene(services: AdminServices) {
  const scene = new Scenes.BaseScene<Ctx>("AdminReportsListScene");

  const reportService = services.reportService;
  const userService = services.userService;

  scene.enter(async (ctx) => {
    // состояние ответа держим в изолированной admin-сессии (как в UserReportsScene);
    // сбрасываем на входе, чтобы «недописанный» ответ не утёк на следующий текст.
    ensureAdminSession(ctx).replyingToReport = null;
    try {
      const reports = await reportService.getAll();

      if (!reports || reports.length === 0) {
        await renderView(
          ctx,
          "📭 Обращений пока нет",
          Markup.inlineKeyboard([
            [Markup.button.callback("« В меню", "back_to_menu")],
          ]),
        );
        return;
      }

      const pendingCount = reports.filter((r) => !r.done).length;
      const doneCount = reports.filter((r) => r.done).length;

      let msg = `📝 Обращения пользователей\n\n`;
      msg += `⏳ Ожидают ответа: ${pendingCount}\n`;
      msg += `✅ Обработано: ${doneCount}\n\n`;

      await renderView(
        ctx,
        msg,
        Markup.inlineKeyboard([
          [
            Markup.button.callback("⏳ Необработанные", "filter_pending"),
            Markup.button.callback("✅ Обработанные", "filter_done"),
          ],
          [Markup.button.callback("📋 Все обращения", "show_all")],
          [Markup.button.callback("« В меню", "back_to_menu")],
        ]),
      );
    } catch (e) {
      log.error("reports scene error", e);
      await renderView(
        ctx,
        "⚠️ Ошибка при загрузке обращений",
        Markup.inlineKeyboard([
          [Markup.button.callback("« В меню", "back_to_menu")],
        ]),
      );
    }
  });

  // Фильтры
  scene.action("filter_pending", async (ctx) => {
    await ctx.answerCbQuery();
    await showReportsList(ctx, false);
  });

  scene.action("filter_done", async (ctx) => {
    await ctx.answerCbQuery();
    await showReportsList(ctx, true);
  });

  scene.action("show_all", async (ctx) => {
    await ctx.answerCbQuery();
    await showReportsList(ctx, null);
  });

  async function showReportsList(ctx: Ctx, done: boolean | null) {
    try {
      let reports = await reportService.getAll();
      if (done !== null) reports = reports.filter((r) => r.done === done);

      if (reports.length === 0) {
        await renderView(
          ctx,
          "📭 Обращений не найдено",
          Markup.inlineKeyboard([
            [Markup.button.callback("« Назад", "back_to_main_reports")],
          ]),
        );
        return;
      }

      const buttons = reports.slice(0, 15).map((report) => {
        const status = report.done ? "✅" : "⏳";
        const label = `${status} ${report.userId}: ${report.message.substring(
          0,
          30,
        )}...`;
        return [
          Markup.button.callback(label, `view_full_report_${report._id}`),
        ];
      });

      buttons.push([Markup.button.callback("« Назад", "back_to_main_reports")]);

      await renderView(
        ctx,
        `📝 Обращения (${reports.length}):\n\n`,
        Markup.inlineKeyboard(buttons),
      );
    } catch (e) {
      log.error("reports scene error", e);
      await ctx.answerCbQuery("⚠️ Ошибка при загрузке");
    }
  }

  // Просмотр обращения
  scene.action(/^view_full_report_(.+)$/, async (ctx) => {
    const id = ctx.match[1];

    try {
      const report = await reportService.getById(id);
      if (!report) return ctx.answerCbQuery("❌ Обращение не найдено");

      await ctx.answerCbQuery();

      const text = [
        `💬 Обращение от ${report.userId}`,
        ``,
        `Сообщение: ${report.message}`,
        `Статус: ${report.done ? "✅ Обработано" : "⏳ Ожидает"}`,
      ];

      if (report.adminReply)
        text.push(``, `Ответ админа: ${report.adminReply}`);

      const buttons: ReturnType<typeof Markup.button.callback>[][] = [];

      if (!report.done) {
        buttons.push([
          Markup.button.callback("✍️ Ответить", `reply_to_report_${id}`),
        ]);
      }

      buttons.push(
        [
          Markup.button.callback(
            "👤 Профиль пользователя",
            `go_to_user_${report.userId}`,
          ),
        ],
        [Markup.button.callback("« К списку", "show_all")],
      );

      await renderView(ctx, text.join("\n"), Markup.inlineKeyboard(buttons));
    } catch (e) {
      log.error("reports scene error", e);
      await ctx.answerCbQuery("⚠️ Ошибка");
    }
  });

  // Ответ пользователю
  scene.action(/^reply_to_report_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    ensureAdminSession(ctx).replyingToReport = ctx.match[1];

    await ctx.reply(
      "✍️ Введите ответ:",
      Markup.inlineKeyboard([
        [Markup.button.callback("« Отмена", "cancel_reply")],
      ]),
    );
  });

  scene.on(message("text"), async (ctx) => {
    const reportId = ctx.session.admin?.replyingToReport;
    if (!reportId) return;

    try {
      const report = await reportService.getById(reportId);
      if (!report) {
        await ctx.reply("❌ Обращение не найдено");
        ensureAdminSession(ctx).replyingToReport = null;
        return;
      }
      await reportService.reply(report, ctx.message.text.trim());

      await ctx.reply(
        "✅ Ответ отправлен",
        Markup.inlineKeyboard([
          [Markup.button.callback("« К списку", "show_all")],
          [Markup.button.callback("« В меню", "back_to_menu")],
        ]),
      );

      ensureAdminSession(ctx).replyingToReport = null;
    } catch (e) {
      log.error("reports scene error", e);
      await ctx.reply("⚠️ Ошибка при отправке ответа");
    }
  });

  // Переход в профиль пользователя
  scene.action(/^go_to_user_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.match[1];
    const user = await userService.getById(userId);

    if (user) {
      setFoundUser(ctx, user.userId);
      await ctx.scene.enter("AdminUserProfileScene");
    } else {
      await ctx.answerCbQuery("❌ Пользователь не найден");
    }
  });

  scene.action("cancel_reply", async (ctx) => {
    await ctx.answerCbQuery();
    ensureAdminSession(ctx).replyingToReport = null;

    await ctx.reply(
      "❌ Отменено",
      Markup.inlineKeyboard([
        [Markup.button.callback("« К списку", "show_all")],
      ]),
    );
  });

  scene.action("back_to_main_reports", async (ctx) => {
    await ctx.answerCbQuery();
    ensureAdminSession(ctx).replyingToReport = null;
    await ctx.scene.reenter();
  });

  scene.action("back_to_menu", async (ctx) => {
    await ctx.answerCbQuery();
    ensureAdminSession(ctx).replyingToReport = null;
    await ctx.scene.enter("MainAdminMenuScene");
  });

  return scene;
}
