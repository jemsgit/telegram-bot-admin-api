// ./scenes/AdminUserReportsScene.ts
import { Scenes, Markup } from "telegraf";
import { message } from "telegraf/filters";
import type {
  AdminServices,
  AdminBotConfig,
  AdminBotSessionData,
  AdminBotContext,
} from "../../types";

export function getAdminUserReportsScene(
  services: AdminServices,
  config: AdminBotConfig
) {
  const scene = new Scenes.BaseScene<AdminBotContext>("AdminUserReportsScene");

  // При входе — показать список обращений
  scene.enter(async (ctx) => {
    if (!ctx.session.admin) {
      ctx.session.admin = {};
    }
    const user = ctx.session.admin.foundUser;

    if (!user) {
      await ctx.reply("⚠️ Пользователь не найден");
      return ctx.scene.enter("MainAdminMenuScene");
    }

    const reportService = services.reportService;

    try {
      const all = await reportService.getAll();
      const reports = all.filter((it) => it.userId === user.userId);

      if (!reports.length) {
        await ctx.reply(
          `📭 У пользователя ${
            user.username ? "@" + user.username : user.userId
          } нет обращений`,
          Markup.inlineKeyboard([
            [Markup.button.callback("« Назад", "back_to_profile")],
          ])
        );
        return;
      }

      let msg = `💬 Обращения пользователя ${
        user.username ? "@" + user.username : user.userId
      }\n\n`;

      reports.forEach((r, i) => {
        const status = r.done ? "✅" : "⏳";
        msg += `${status} ${i + 1}. ${r.message.substring(0, 50)}${
          r.message.length > 50 ? "..." : ""
        }\n`;
      });

      const buttons = reports.map((r, i) => [
        Markup.button.callback(
          `${r.done ? "✅" : "⏳"} Обращение ${i + 1}`,
          `view_report_${r._id}`
        ),
      ]);

      buttons.push([Markup.button.callback("« Назад", "back_to_profile")]);

      await ctx.reply(msg, Markup.inlineKeyboard(buttons));
    } catch (e) {
      console.error("Error fetching reports:", e);
      await ctx.reply(
        "⚠️ Ошибка при загрузке обращений",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_profile")],
        ])
      );
    }
  });

  // Открытие одного обращения
  scene.action(/^view_report_(.+)$/, async (ctx) => {
    const reportId = ctx.match[1];
    const reportService = services.reportService;

    try {
      const report = await reportService.getById(reportId);
      if (!report) {
        await ctx.answerCbQuery("❌ Обращение не найдено");
        return;
      }

      await ctx.answerCbQuery();

      const text = [
        `💬 Обращение`,
        ``,
        `Сообщение: ${report.message}`,
        `Статус: ${report.done ? "✅ Обработано" : "⏳ Ожидает"}`,
      ];

      if (report.adminReply) {
        text.push("", `Ответ: ${report.adminReply}`);
      }

      await ctx.reply(
        text.join("\n"),
        Markup.inlineKeyboard([
          ...(report.done
            ? []
            : [
                [
                  Markup.button.callback(
                    "✍️ Ответить",
                    `reply_report_${reportId}`
                  ),
                ],
              ]),
          [Markup.button.callback("« К списку", "back_to_list")],
        ])
      );
    } catch (e) {
      console.error("Error viewing report:", e);
      await ctx.answerCbQuery("⚠️ Ошибка");
    }
  });

  // Начать ввод ответа
  scene.action(/^reply_report_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.admin = ctx.session.admin || {};
    ctx.session.admin.replyingToReport = ctx.match[1];

    await ctx.reply(
      "✍️ Введите ответ на обращение:",
      Markup.inlineKeyboard([
        [Markup.button.callback("« Отмена", "back_to_list")],
      ])
    );
  });

  // Ввод текста ответа
  scene.on(message("text"), async (ctx) => {
    const reportId = ctx.session.admin?.replyingToReport;
    if (!reportId) return;

    const reply = ctx.message.text.trim();
    const reportService = services.reportService;

    const report = await reportService.getById(reportId);
    if (!report) return;

    try {
      await reportService.reply(report, reply);

      await ctx.reply(
        "✅ Ответ отправлен",
        Markup.inlineKeyboard([
          [Markup.button.callback("« К списку", "back_to_list")],
          [Markup.button.callback("« К профилю", "back_to_profile")],
        ])
      );
      ctx.session.admin = ctx.session.admin || {};
      ctx.session.admin.replyingToReport = null;
    } catch (e) {
      console.error("Error replying:", e);
      await ctx.reply("⚠️ Ошибка при отправке ответа");
    }
  });

  // Назад к списку
  scene.action("back_to_list", async (ctx) => {
    ctx.session.admin = ctx.session.admin || {};
    ctx.session.admin.replyingToReport = null;
    await ctx.answerCbQuery();
    await ctx.scene.reenter();
  });

  // Назад к профилю
  scene.action("back_to_profile", async (ctx) => {
    ctx.session.admin = ctx.session.admin || {};
    ctx.session.admin.replyingToReport = null;
    await ctx.answerCbQuery();
    await ctx.scene.enter("AdminUserProfileScene");
  });

  return scene;
}
