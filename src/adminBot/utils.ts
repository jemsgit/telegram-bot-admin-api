import { AdminBotContext } from "../types";
import type { UserService } from "../services/user";
import type { AdminSession, AdminUser, UserId } from "../types";
import { log } from "../logger";

type ReplyExtra = Parameters<AdminBotContext["reply"]>[1];

/**
 * `ctx.reply`, который не роняет хендлер, если Telegram вернул ошибку
 * (юзер заблокировал бота, битая разметка, «message is not modified» и т.п.).
 * Ошибка не глотается молча — уходит в лог на уровень `warn`.
 */
export async function safeReply(
  ctx: AdminBotContext,
  text: string,
  markup?: ReplyExtra,
) {
  try {
    await ctx.reply(text, markup);
  } catch (err) {
    log.warn("safeReply: не удалось отправить сообщение", err);
  }
}

/**
 * Показ экрана меню: если апдейт пришёл по нажатию инлайн-кнопки — редактируем
 * то же сообщение (не плодим новые), иначе шлём новое. Если правка не удалась
 * («message is not modified», сообщение слишком старое, не текстовое) — тоже
 * отправляем новое.
 */
export async function renderView(
  ctx: AdminBotContext,
  text: string,
  extra?: ReplyExtra,
): Promise<void> {
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(
        text,
        extra as Parameters<AdminBotContext["editMessageText"]>[1],
      );
      return;
    } catch {
      // упадём в отправку нового сообщения ниже
    }
  }
  await safeReply(ctx, text, extra);
}

export function ensureAdminSession(ctx: AdminBotContext): AdminSession {
  if (!ctx.session.admin) {
    ctx.session.admin = {};
  }
  return ctx.session.admin;
}

/**
 * «Текущего» пользователя держим в сессии только по id — сам объект перечитываем
 * из стора (свежие данные + не раздуваем сессию).
 */
export function setFoundUser(ctx: AdminBotContext, id?: UserId | null): void {
  ensureAdminSession(ctx).foundUserId = id ?? undefined;
}

export async function getFoundUser(
  ctx: AdminBotContext,
  userService: UserService,
): Promise<AdminUser | null> {
  const id = ctx.session.admin?.foundUserId;
  if (id === undefined || id === null) return null;
  return userService.getById(id);
}
