// Роутинг текстовых кнопок главного меню -> сцены. Строится из дескрипторов фич
// (MenuEntry) + кастомных сцен. Выключенные фичи в меню не попадают.

import { Markup } from "telegraf";
import type { AdminBotContext, CustomScene } from "../../types";
import type { MenuEntry } from "../../features";
import { safeReply } from "../utils";

export const EXIT_BUTTON = "🚪 Выйти";

/**
 * @param menuEntries пункты меню включённых фич
 * @param customScenes кастомные сцены хоста
 */
export function getMainGlobalMessageHandler(
  menuEntries: MenuEntry[],
  customScenes: CustomScene[],
) {
  const byButton = new Map<string, string>();
  for (const e of menuEntries) byButton.set(e.button, e.enter);
  for (const c of customScenes) {
    if (c.buttonText) byButton.set(c.buttonText, c.name);
  }

  return async function mainGlobalMessageHandler(
    ctx: AdminBotContext,
    next: () => Promise<void>,
  ) {
    const msg = ctx.message;
    const text =
      msg && "text" in msg ? (msg.text as string | undefined) : undefined;
    if (!text) return next();

    const sceneId = byButton.get(text);
    if (sceneId) {
      await ctx.scene.enter(sceneId);
      return;
    }

    if (text === EXIT_BUTTON) {
      await ctx.scene.leave();
      await safeReply(
        ctx,
        "👤 Вернулись в режим пользователя",
        Markup.removeKeyboard(),
      );
      return;
    }

    return next();
  };
}
