import { Composer, Scenes, Markup } from "telegraf";
import { message } from "telegraf/filters";

import type { AdminBotContext, AdminServices, CustomScene } from "../types";
import type { ResolvedFeatures, TelegramMenuConfig } from "../config";
import { buildAdminScenes, buildMenuEntries } from "../features";
import { getMainAdminMenuScene } from "./scenes/MainAdminMenuScene";
import { getMainGlobalMessageHandler } from "./scenes/globalMessageHandler";
import { MemorySessionStore, type SessionStore } from "./sessionStore";

export interface CreateAdminBotDeps {
  admins: number[];
  services: AdminServices;
  features: ResolvedFeatures;
  menu?: TelegramMenuConfig;
}

/**
 * Собирает admin-меню как self-contained middleware.
 *
 * Отличия от старого `AdminBot.attach`:
 * - собственный `Scenes.Stage` со своими сценами (не пишет в stage хоста);
 * - собственный `session()` — изолирован от сессии хоста;
 * - весь admin-flow (сцены + команды) под единой проверкой `ctx.from.id ∈ admins`;
 * - `ctx.services` / `ctx.config` инъектятся до сцен — работает и в кастомных сценах.
 */
export function createAdminBot({
  admins,
  services,
  features,
  menu,
}: CreateAdminBotDeps): Composer<AdminBotContext> {
  const customScenes: CustomScene[] = menu?.customScenes ?? [];
  const menuEntries = buildMenuEntries(features);

  const stage = new Scenes.Stage<AdminBotContext>([
    getMainAdminMenuScene(customScenes, menuEntries),
    ...buildAdminScenes(services, features),
    ...customScenes.map((c) => c.scene),
  ]);

  // Глобальные команды входа/выхода. Регистрируем на самом Stage: его собственные
  // хендлеры (см. Stage.middleware) выполняются раньше хендлеров активной сцены,
  // поэтому /admin и /user срабатывают и изнутри визардов, где текстовый ввод
  // иначе «съел» бы команду.
  stage.command("admin", (ctx) => ctx.scene.enter("MainAdminMenuScene"));
  stage.command("user", async (ctx) => {
    if (ctx.scene.current) await ctx.scene.leave();
    await ctx.reply(
      "👤 Вернулись в пользовательский режим",
      Markup.removeKeyboard(),
    );
  });

  const globalTextHandler = getMainGlobalMessageHandler(
    menuEntries,
    customScenes,
  );

  const adminOnly = new Composer<AdminBotContext>();

  // 1. изоляция сессии: своя сессия для admin-flow, сохраняем/восстанавливаем
  //    ctx.session хоста, чтобы его session()-middleware не перезаписал чужой блоб.
  const store: SessionStore = menu?.session?.store ?? new MemorySessionStore();
  const getKey =
    menu?.session?.getSessionKey ??
    ((ctx: AdminBotContext) =>
      ctx.from && ctx.chat ? `admin:${ctx.from.id}:${ctx.chat.id}` : undefined);

  adminOnly.use(async (ctx, next) => {
    const key = await getKey(ctx);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outer = (ctx as any).session;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx as any).session = (key && (await store.get(key))) || {};
    try {
      await next();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (key) await store.set(key, (ctx as any).session);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).session = outer;
    }
  });

  // 2. общий доступ к сервисам/конфигу (в т.ч. в кастомных сценах)
  adminOnly.use((ctx, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx as any).services = services;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx as any).config = features;
    return next();
  });

  // 3. сцены (+ глобальные команды /admin, /user — зарегистрированы на stage выше)
  adminOnly.use(stage.middleware());

  // 4. текстовые кнопки меню вне активной сцены
  adminOnly.on(message("text"), globalTextHandler);

  // 5. фолбэк для «повисших» callback_query: если апдейт дошёл сюда, будучи внутри
  //    активной admin-сцены, — ни один `scene.action` его не разобрал (устаревшая
  //    кнопка из старого сообщения / после рестарта). Гасим «часики» у пользователя.
  //    Вне сцены пропускаем дальше — там кнопка может принадлежать хосту.
  adminOnly.on("callback_query", async (ctx, next) => {
    if (ctx.scene?.current) {
      await ctx.answerCbQuery().catch(() => {});
      return;
    }
    return next();
  });

  // гейт прав — оборачивает ВСЁ вышеперечисленное
  const gated = new Composer<AdminBotContext>();
  gated.use(
    Composer.optional(
      (ctx) => !!ctx.from && admins.includes(ctx.from.id),
      adminOnly,
    ),
  );

  return gated;
}
