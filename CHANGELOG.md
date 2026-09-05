# Changelog

## Unreleased

### Добавлено
- **`ui-schema.ts`** — типизированная схема кастомных HTTP-роутов для внешней
  панели (см. `docs/CUSTOMIZABLE_ADMIN_UI.md`, вариант A): `FieldType`
  (`text|textarea|number|boolean|date|datetime|select|lookup`), `FieldSchema`,
  `RouteUi` (`kind: "form"|"list"|"action"`, `columns`, `confirm`,
  `successMessage`). `CustomRouteWithUi.ui.fields` был `unknown[]` — теперь
  типизирован.
- **`validateRouteUi(routes)`** — fail-fast проверка схемы кастомных роутов на
  старте (тот же паттерн, что `validateStore`): падает с полным списком
  проблем (неизвестный `type`, `select` без `options`, `lookup` без
  `lookup.route`, дублирующиеся имена полей). Вызывается внутри `createAdmin()`.
- **`resolveRouteUi(route)`** / **`resolveRouteUiKind(method, fields)`** —
  выводят `kind` для роута, если бот не указал его явно (`GET` без полей →
  `list`, есть поля → `form`, иначе → `action`). Используется при сборке
  `GET /api/config` → `customRoutesConfig`.
- Новые типы экспортированы из `index.ts`: `FieldType`, `FieldOption`,
  `FieldLookup`, `FieldValidation`, `FieldSchema`, `RouteUiKind`, `RouteUi`.
- **`ui/`** — standalone-веб-интерфейс (React + Vite + Mantine), не входит в
  публикуемый `lib/index.*`, собирается отдельно в `lib/ui/` (см.
  `docs/CUSTOMIZABLE_ADMIN_UI.md`). `AutoForm`/`AutoTable`/`ConfirmButton`/
  `LookupField`/`GenericRouteScreen` рендерят `customRoutesConfig` из
  `GET /api/config` без бот-специфичного кода; `TokenGate` — логин по
  существующему `ADMIN_API_TOKEN`, токен только в памяти вкладки (не
  `localStorage`/`sessionStorage`).
- **`http.ui.enabled`** (`AdminConfig.http.ui`) — `createAdmin()` отдаёт
  собранный standalone-UI тем же портом, что и `/api/*`
  (`src/http/uiStatic.ts` → `resolveUiDir()` + `express.static`). Проверено
  на реально собранном пакете в обоих форматах (CJS `lib/index.js` и ESM
  `lib/index.mjs`).
- **`http.ui.auth: { username, password }`** — логин в UI по паре полей
  вместо одного токена (`src/http/uiAuth.ts`). Новые эндпоинты `GET /ui/config`
  (режим логина для фронта) и `POST /ui/login` — без токена, монтируются до
  `/api`-авторизации только при `ui.enabled`. Оба поля сверяются constant-time
  (`crypto.timingSafeEqual` по sha256), с троттлингом неудачных попыток
  (5/IP + 20 суммарно за 15 мин → `429` + `Retry-After`, задержка 400 мс на
  неверный ответ). При успехе `/ui/login` возвращает `http.token` — `/api/*`
  не меняется, любой клиент по-прежнему ходит туда с этим токеном. Без
  `ui.auth` — прежний вход по одному `http.token` (тоже через `/ui/login`,
  тоже с троттлингом). `apiAuth` (`/api/*`) переведён на `timingSafeEqual`
  вместо `!==` (см. IMPROVEMENTS.md #4).
- `tsup.config.ts`: `shims: true` (нужен `__dirname`-шим для `resolveUiDir()`
  в ESM-сборке).
- **`GET /api/openapi.json`** — OpenAPI 3.0 документ core+feature роутов
  (`src/http/openapi.ts`, `buildOpenApiDocument`), под тем же токеном, что и
  остальной `/api/*`. Не включает `customRoutes` бота (см. `ui-schema.ts` —
  они уже описаны отдельно). `src/http/joiToSchema.ts` — конвертер
  joi-схемы → OpenAPI Schema через `schema.describe()` (официальный API
  joi для интроспекции), покрывает string/number/boolean/date/array/object/
  `.valid()`/`.default()`/базовые rules/`alternatives().conditional()`.
  `RouteDef` получил опциональные `summary`/`tags`/`bodySchema`; сырые
  joi-схемы (`daysSchema`, `reportReplySchema`, `promoCodeSchema`,
  `promoCreateSchema`) экспортированы из `validators/index.ts` (были только
  их validate-миддлвары). `buildOpenApiDocument`/`joiSchemaToOpenApi`
  экспортированы из `index.ts`. `scripts/generate-openapi.js` + `yarn openapi`
  — статический `openapi.json` для кодогенерации типизированного клиента.
- **Встроенные экраны** (`ui/src/screens/`) — `UsersScreen` (core, всегда в
  меню: поиск/список пользователей + деталь с продлением/промо-подпиской/
  удалением подписки, выдачей промокода, списком обращений — по включённым
  фичам), `BroadcastsScreen` (список + фильтр по статусу + создание/
  редактирование + тестовая отправка + удаление), `PromocodesScreen` (список +
  создание + удаление), `ReportsScreen` (список + ответ на обращение),
  `PaymentsScreen` (статистика + список, read-only — HTTP API не даёт мутаций),
  `ReferralScreen` (поиск по ссылке / все), `PostContentAdScreen` (список +
  создание/редактирование + удаление). Переиспользуют `AutoForm`/`AutoTable`/
  `ConfirmButton` из шага 2; для этого `AutoForm` получил `initialValues`
  (редактирование существующей записи), `AutoTable` — `onRowClick`/
  `rowActions`. `routeRequest.ts` получил `serializeFormValues()` — та же
  Date/select-сериализация, что у кастомных роутов, но без раскладки по
  path/query (путь у встроенных экранов зашит в коде). Известное упрощение:
  поля-массивы (`linkButtons` у рассылок, `showFor`/`segments`) не
  редактируются в форме — `FieldSchema` их не поддерживает.
- **`telegraf-admin-for-bots/ui-kit`** — библиотечный под-путь пакета:
  `AutoForm`/`AutoTable`/`ConfirmButton`/`FieldInput`/`LookupField`/
  `GenericRouteScreen`, все 7 встроенных экранов, API-клиент
  (`createApiClient`/`ApiClientProvider`/`useApiClient`), типы схемы,
  `serializeFormValues`/`buildRouteRequest` — для [[central-panel-gateway]]
  (`docs/ADMIN_PANEL_APP.md`), которая их только импортирует, не переписывает.
  `ui/src/ui-kit.ts` (новый entry, без `App`/`main`/`TokenGate`) +
  `ui/vite.config.lib.ts` (library mode, ESM+CJS, `vite-plugin-dts`);
  `react`/`react-dom`/`@mantine/*` — externals, не бандлятся. Корневой
  `package.json`: под-путь `"./ui-kit"` в `exports`, `react`/`react-dom`/
  `@mantine/*` добавлены в `peerDependencies` как **опциональные**
  (`peerDependenciesMeta.optional: true` — не задевают потребителей, которым
  нужен только `createAdmin()`).

### Изменено / миграция с 0.1.0
- `ui.fields[].type` в кастомных роутах: имена приведены к финальному набору
  `text|textarea|number|boolean|date|datetime|select|lookup`. В 0.1.0 поле
  было `unknown[]` без проверки, а пример в README использовал `numberInput`/
  `textInput`/`dateInput` — теперь `validateRouteUi` на старте **бросает** на
  неизвестном `type`. Переименовать: `numberInput→number`, `textInput→text`,
  `dateInput→date`.

### Исправлено
- `ui/` (standalone-бандл и `ui-kit`) не собиралась в `prepublishOnly` —
  публикация версии ушла бы без `lib/ui`/`lib/ui-kit`. Теперь `prepublishOnly`
  и `pack` = `yarn build:all` (`clean` → `tsup` → `cd ui && npm run
  build:all`).
- `tsup` при `dts: true` **безусловно** сносил все `.d.ts` под `lib/`
  (`cleanDtsFiles`, негации из `clean: []` там не применяются) — типы
  `ui-kit` не попадали в тарболл. `tsup.config.ts` → `clean: false`, чистка
  вынесена в отдельный npm-скрипт `clean` (`rm -rf lib`), который бежит
  перед сборкой в `build:all`/`prepublishOnly`. Плейн `yarn build` больше не
  трогает `lib/ui`/`lib/ui-kit` (важно для локального dev-линка).

### Типы
- Убраны все `no-explicit-any`, которые eslint флагал в `src/` (было 15,
  стало 0): `session: any` в визард-сценах → новый `AdminSession =
  NonNullable<SessionData["admin"]>`; `buttons: any[]` →
  `ReturnType<typeof Markup.button.callback>[][]`; `users: any[]` →
  `AdminUser[]`; `safeReply(ctx: any, markup?: any)` → `AdminBotContext` +
  `Parameters<AdminBotContext["reply"]>[1]`; `type Ctx = any` в
  `globalMessageHandler` → `AdminBotContext`; `StatisticsScene` — локальный
  `StatsShape`; `joiToSchema.ts`/`openapi.ts` — `Record<string, any>` →
  точечные `JoiDescribe`/`OpenApiOperation`/`Record<string, unknown>`.
  Всплывшие при этом незакрытые `undefined` (draft-поля визардов) закрыты
  `?? []` / `ensureAdminSession`. Осознанно оставлены (с `eslint-disable`):
  `Telegraf<any>` в точках приёма бота хоста (контекст-агностично) и
  `(ctx as any).session/.services/.config` в `createAdminBot` — это
  IMPROVEMENTS.md #3, отдельная задача.

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
