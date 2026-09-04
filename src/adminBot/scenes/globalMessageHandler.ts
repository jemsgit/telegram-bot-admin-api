// Роутинг текстовых кнопок главного меню -> сцены. Строится из дескрипторов фич
// (MenuEntry) + кастомных сцен. Выключенные фичи в меню не попадают.

import { Markup } from "telegraf";
import type { CustomScene } from "../../types";
import type { MenuEntry } from "../../features";
import { safeReply } from "../utils";

export const EXIT_BUTTON = "🚪 Выйти";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = any;

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
    ctx: Ctx,
    next: () => Promise<void>,
  ) {
    const text: string | undefined = ctx.update?.message?.text;
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
