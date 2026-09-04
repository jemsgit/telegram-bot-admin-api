# Changelog

## 0.1.0

Полный редизайн API. **Ломающие изменения** — старый API (`new AdminBot(...)`,
`createAdminServer(...)`, `BotApp`, `TypedDB`) удалён.

### Добавлено
- **`createAdmin(config)`** — единая точка подключения. Возвращает
  `{ services, attachBot(), startHttp(), stopHttp() }`.
- **Сторы по фичам** (`stores.ts`): `UserStore` (обязателен) + `BroadcastStore` /
  `PromoStore` / `ReportStore` / `PaymentStore` / `ReferralStore` /
  `SubscriptionStore` / `PostContentStore`. Бот реализует только то, что использует.
- **`validateStore(db, features)`** — проверка контракта на старте со списком
  недостающих методов.
- **Адаптеры по фичам** (`adapters.ts`): `BroadcastScheduler`, `BroadcastAdapter`,
  `ReportsAdapter`. Фича без адаптера тихо отключается с предупреждением.
- **`AdminUser<Extra>`** — универсальная модель пользователя; всё бот-специфичное
  в `extra`. `UserSubscription` в нейтральных терминах
  (`activeUntil` / `isTrial` / `trialUsed`).
- **Feature-дескрипторы** (`features/index.ts`): сцены, меню и HTTP-роуты каждой
  фичи в одном месте; `/api/config` и клавиатура меню генерятся из них.
- **`createMemoryStore()`** — in-memory реализация всех сторов для прототипов и тестов.
- **Логгер** (`logger.ts`): leveled, без зависимостей, префикс
  `[telegraf-admin-for-bots]`. Подмена через `AdminConfig.logger` (winston/pino/
  свой), уровень — `AdminConfig.logLevel`. Экспорт `createConsoleLogger`,
  `setLogger`, `log`. Все `console.*` внутри модуля переведены на него;
  `safeReply` больше не глотает ошибки молча (лог на `warn`).
- Фолбэк на «повисшие» `callback_query` внутри активной admin-сцены — гасит
  «часики» у устаревших инлайн-кнопок.
- `renderView` — экраны меню редактируют одно сообщение (по инлайн-кнопке),
  а не плодят новые.
- В admin-сессии — только `foundUserId` (не весь объект пользователя);
  `AssignPromoScene` не кэширует список промокодов.
- Кастомные HTTP-роуты теперь монтируются под `/api` и под `apiAuth` (раньше — по
  `path` дословно, мимо авторизации, если не начинался с `/api`). Префикс `/api/`
  в `path` можно писать или опускать. Добавлено поле `CustomRoute.validate` —
  express-миддлвары до хендлера.
- HTTP: `HttpError`, единый обработчик ошибок, `/health`, graceful shutdown
  (`stopHttp` / `AdminServer.stop`), fail-fast без токена, CORS-allowlist из конфига.
- Собственная изолированная сессия admin-меню (не перезаписывает `ctx.session` хоста).
- ACL: весь admin-flow под проверкой `ctx.from.id ∈ admins`.
- `GET /api/referrals` (был `/api/reffers`, оставлен как алиас).
- Сборка через `tsup` (cjs + esm + d.ts), рабочий ESM-entry.
- Тесты (`vitest`), CI.

### Удалено
- `AdminBot` (класс), `createAdminServer`, `BotApp`, `AdminBotConfig` (как отдельный
  тип — теперь алиас `ResolvedFeatures`), `TypedDB`, `User` (→ `AdminUser`).
- Чтение `process.env.ADMIN_API_TOKEN` модулем — токен только через `http.token`.

### Миграция с 0.0.x
`new AdminBot(...)` + `createAdminServer(...)` → один `createAdmin({ bot, admins, db,
features, adapters, telegramMenu, http })`. `BotApp` → `bot: Telegraf` + `adapters`
по фичам. `TypedDB` → сторы включённых фич. Поля `zodiak` / `bithdate` / ... в `User`
→ `AdminUser.extra`. См. README.
