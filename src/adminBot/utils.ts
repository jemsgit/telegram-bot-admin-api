import { AdminBotContext } from "../types";

export async function safeReply(ctx: any, text: string, markup?: any) {
  try {
    await ctx.reply(text, markup);
  } catch {}
}

export function ensureAdminSession(ctx: AdminBotContext) {
  if (!ctx.session.admin) {
    ctx.session.admin = {};
  }
  return ctx.session.admin;
}
