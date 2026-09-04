import { AdminBotContext } from "../types";
import type { UserService } from "../services/user";
import type { AdminUser, UserId } from "../types";
import { log } from "../logger";

/**
 * `ctx.reply`, который не роняет хендлер, если Telegram вернул ошибку
 * (юзер заблокировал бота, битая разметка, «message is not modified» и т.п.).
 * Ошибка не глотается молча — уходит в лог на уровень `warn`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safeReply(ctx: any, text: string, markup?: any) {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra?: any,
): Promise<void> {
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, extra);
      return;
    } catch {
      // упадём в отправку нового сообщения ниже
    }
  }
  await safeReply(ctx, text, extra);
}

export function ensureAdminSession(ctx: AdminBotContext) {
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
