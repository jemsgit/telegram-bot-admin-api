# Рефакторинг `telegraf-admin-for-bots`

Статус: план. Цель — довести модуль до состояния «универсальная админка для telegraf-ботов,
подключается по одному паттерну». Ведём по фазам, каждая фаза — отдельный самодостаточный
шаг, после которого `astro-bot` продолжает работать (через deprecated-обёртки).

- [Часть 1. Проблемы текущей версии (0.0.7)](#часть-1-проблемы-текущей-версии-007)
- [Часть 2. Целевая архитектура](#часть-2-целевая-архитектура)
- [Часть 3. План по фазам](#часть-3-план-по-фазам)

---

## Часть 1. Проблемы текущей версии (0.0.7)

### A. Поверхность подключения

| # | Проблема | Последствие |
|---|----------|-------------|
| A1 | Контракт подключения неявный: хост обязан заранее смонтировать `session()` и `bot.use(stage.middleware())`, отдать свой `Scenes.Stage`. Нигде не типизировано. | Другой бот не подключит без чтения исходников. Обёртка в astro-bot лезет в приватное `this.userBot.stage`. |
| A2 | `AdminBot.attach()` вызывает `mainStage.use(ctx => ctx.services = …)` **после** того, как хост уже сделал `bot.use(stage.middleware())`. По исходникам telegraf 4.16 этот `.use()` попадает в `handler` после снапшота и **не выполняется**. | Документированный `ctx.services` внутри кастомных сцен по факту `undefined`. Встроенные сцены спасаются тем, что замыкают `services` напрямую. |
| A3 | `AdminBot` создаёт `this.stage` в конструкторе, но `initStage()` не вызывается никогда, этот stage никуда не монтируется. | Мёртвый код, вводит в заблуждение по модели исполнения. |
| A4 | ACL (`Composer.acl(admins, …)`) висит только на композере `AdminBot` (команды `/admin`, `/user`, текст). Сами admin-сцены зарегистрированы в общем stage хоста без гейта. | Граница безопасности разорвана: попадание в admin-сцену «сбоку» (кастомная сцена, восстановление `__scenes` из сессии) не проверяет права. |
| A5 | `Composer.acl` помечен deprecated в telegraf ≥ 4.12. | Отвалится в будущих версиях peer-зависимости. |
| A6 | Хост-специфика в `BotApp`: `sendTestBroadcast`, `replyToUserReport(userId, message, text)` — обязательны даже при выключенных `broadcast`/`reports`. Тип `void` вместо `Promise<void>` (вызывающий код всё равно `await`-ит). | Лишние обязательные адаптеры, неверные типы. |

### B. Конфигурация

| # | Проблема | Последствие |
|---|----------|-------------|
| B1 | Два типа под одно понятие: `FeaturesConfig` (все `boolean?`) для сервера и `AdminBotConfig` (все `boolean` required) — одинаковые 7 ключей. | Дублирование, рассинхрон. |
| B2 | `AdminServer` дефолтит все фичи в `true`, `AdminBot` дефолтов не применяет — пропущенный ключ молча выключает фичу. | Разное поведение при неполном конфиге. |
| B3 | Конфиг задаётся у потребителя дважды: `admin-server.js` и `admin-bot.js` независимо перечисляют одни и те же флаги. | Рассинхрон вопрос времени. |
| B4 | Источник конфига несогласован: `AdminBot` берёт `admins` аргументом, `AdminServer` сам читает `process.env.ADMIN_API_TOKEN`. | Модуль читает env приложения; невозможно сконфигурировать программно. |
| B5 | `scheduler: any` — фактически обязательная зависимость с формой `{ scheduleBroadcast, rescheduleBroadcast, cancelBroadcast }`, без интерфейса. | `broadcast: true` + неполный планировщик = краш в рантайме. |
| B6 | `customRoutes` (поведение) и `customRoutesConfig` (UI-схема для внешней панели) — два массива, синхронизируются руками. В astro-bot каждый роут описан дважды. | Ошибки синхронизации, дублирование `url`/`method`. |
| B7 | Дрейф README ↔ код: README описывает опцию `baseUrl` (нет в `CreateAdminServerOptions`) и сигнатуру `new AdminBot(bot, config, [ID], db, scheduler, [])` (в коде порядок другой). | Дока не соответствует коду. |
| B8 | `createAdminServer` мёржит `customRoutesConfig` внутрь `featuresConfig`: `{ ...features, customRoutesConfig }`, дальше `GET /api/config` отдаёт всё вместе. | Смешение UI-схемы и флагов фич в одном объекте, тип `any[]`. |

### C. Контракт с БД и доменная модель

| # | Проблема | Последствие |
|---|----------|-------------|
| C1 | `TypedDB` — один интерфейс на 25 методов. Бот, которому нужны «юзеры + рассылки», обязан реализовать/заглушить промокоды, рекламу, рефералов, платежи. | Главный барьер переиспользования. |
| C2 | Доменная модель astro-bot протекла в общий `User`: `zodiak`, `bithdate` (+опечатка), `demoUsed`, `localTimeShift`, `notificationTime`. | `User` не универсален. |
| C3 | `Subscription` = `{ demoUsed, isDemoSubscription, subscriptionToDate }` — конкретная бизнес-модель «демо + платная подписка». Методы `extendSubscription` / `activatePromoSubscription` / `deleteSubscription` предполагают наличие подписок у бота. | Подписки должны быть опциональным сабмодулем, не ядром. |
| C4 | `any` в публичном контракте: `getUserStats(): Promise<any>`, `getRefferals(): Promise<any[]>`, `countRefferalsByRefLink(): Promise<any>`. | Нет типовой поддержки там, где она важнее всего. |
| C5 | Нет эталонной in-memory реализации `TypedDB` и contract-теста для потребителя. | Каждый потребитель проверяет свою реализацию вручную. |
| C6 | `UserService` — `constructor(private db: any)`, остальные сервисы типизированы. | Потеря типов в user-слое. |

### D. Упаковка и сборка

| # | Проблема | Последствие |
|---|----------|-------------|
| D1 | `src/index.ts` и `src/index.cjs.ts` — руками поддерживаемые дубли, уже разъехались (типы и `PostContentAd*` есть только в `.ts`; `PostContentService` не экспортируется как значение нигде). | Дрейф экспортов. |
| D2 | ESM-сборка нерабочая: `tsc --module preserve` кладёт `import/export`-синтаксис в `.js`, но нет ни `lib/esm/package.json` с `"type":"module"`, ни `"type"` в корне → Node грузит как CJS → `SyntaxError` у ESM-потребителя. | Работает только `require`. |
| D3 | Сборка = 3× `tsc` + `babel` вместо одного прогона (`tsup`/`unbuild`). | Медленно, хрупко, `dev:build` не совпадает с `build`. |
| D4 | Версия `0.0.7` публикуется руками, CI/тестов нет. | Нет регресс-защиты. |

### E. Код-левел (замечено попутно; полное ревью — пункт 3)

| # | Файл | Проблема |
|---|------|----------|
| E1 | `services/broadcast.ts:38` | `crypto.randomUUID()` без импорта. Глобальный `crypto` стабилен только с Node 20; babel-таргет — node 18 → возможен `ReferenceError`. Нужен `import { randomUUID } from "node:crypto"`. |
| E2 | `adminBot/adminBot.ts:132` | `console.log(this.mainBot)` — дамп всего инстанса Telegraf в лог. Плюс `console.log("here")`, `"im here"` (`services/report.ts`), `console.log(broadcast)` (`services/broadcast.ts`). |
| E3 | `AdminServer.ts` | `apiAuth` при отсутствии токена отвечает 500 на каждый запрос вместо fail-fast при старте. |
| E4 | `AdminServer.ts:82` | CORS отражает любой `origin` + `credentials: true`. Для admin-API нужен allowlist из конфига. |
| E5 | `AdminServer.ts` | Каждый роут — свой `try/catch` с одинаковым телом. Нужен async-wrapper + централизованный error-middleware (сократит файл вдвое). |
| E6 | `AdminServer.ts:613` | Роут рефералов — `/api/reffers`, README обещает `/api/referrals`. |
| E7 | `services/broadcast.ts:80` | `Object.assign(broadcast, restPatch, { updatedAt: new Date() })` — поля `updatedAt` нет в типе `Broadcast`. |
| E8 | `services/postcontent.ts:52` | Собирает `Partial<PostContentAd>` и кастует `as PostContentAd`. |
| E9 | `AdminServer.ts` | `app.listen` без host, не возвращает `http.Server`, нет `/health`, нет graceful shutdown. |
| E10 | `types/index.ts` | `AdminBotSessionData` не используется; `SessionData.admin` — огромный ручной union шагов (`promoCreateStep`, `broadcastStep`, `adCreateStep`). Wizard-сцены убрали бы это. |
| E11 | `adminBot/adminBot.ts:101` | `ctx.scene.enter("mainScene")` — хардкод имени пользовательской сцены хоста. |
| E12 | `services/reffer.ts:10` | `countByLink(): Promise<number>`, а `db.countRefferalsByRefLink` возвращает `any` (в astro — объект). |

---

## Часть 2. Целевая архитектура

### Единый вход

```ts
import { createAdmin } from "telegraf-admin-for-bots";

const admin = createAdmin({
  bot,                                  // Telegraf-инстанс
  admins: [Number(process.env.ADMIN_ID)],
  features: { broadcast: true, reports: true, promocodes: true /* остальное по дефолту */ },

  db,                                   // реализует сторы только включённых фич

  adapters: {                           // сгруппированы по фиче, нужны только для включённых
    broadcast: { scheduler, sendTest: (b) => bot.sendTestBroadcast(b) },
    reports:   { replyToUser: (userId, originalText, replyText) => { /* ... */ } },
  },

  telegramMenu: { enabled: true, session: "own" },   // "own" | "host"
  http: {
    enabled: true,
    port: 3010,
    token: process.env.ADMIN_API_TOKEN,             // читает приложение, не модуль
    cors: { origins: ["https://panel.example.com"] },
  },

  customScenes: [ /* CustomScene[] */ ],
  customRoutes: [ { method, path, handler, ui?: { description, fields } } ],  // один массив
});

admin.attachBot();      // монтирует в Telegraf в правильном порядке
admin.startHttp();      // -> http.Server
admin.services;         // доступ к сервисам
```

`createAdminServer` и `new AdminBot(...)` остаются как `@deprecated`-обёртки поверх `createAdmin`.

### Feature-модуль как единица

Каждая фича — папка `src/features/<name>/` с дескриптором:

```ts
interface FeatureModule<S = unknown> {
  name: FeatureName;
  storeContract: string[];              // методы стора, обязательные для проверки на старте
  requiredAdapters?: string[];
  createService(deps: FeatureDeps): S;
  http?(services: AdminServices, cfg: ResolvedConfig): RouteDef[];
  scenes?(services: AdminServices, cfg: ResolvedConfig): SceneDef[];
  menu?: { button: string; enter: string; row?: number };
}
```

`createAdmin` берёт дескрипторы по флагам, один раз строит сервисы, раздаёт в `AdminBot`-раннер
и `AdminServer`-раннер. `/api/config` и клавиатура меню генерятся из дескрипторов.
Добавить фичу = добавить папку, ядро не трогается.

### Разбиение стора

```ts
type IdLike = number | string;

interface AdminUser<Extra = Record<string, unknown>> {
  id: IdLike;
  username?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  createdAt?: Date;
  extra?: Extra;                        // поля конкретного бота (zodiak, birthdate, ...)
}

interface UserStore   { findUsersByQuery; findUserById; getUsers; getUserStats }  // всегда
interface BroadcastStore { /* ... */ }  // если features.broadcast
interface PromoStore     { /* ... */ }
interface ReportStore    { /* ... */ }
interface PaymentStore   { /* ... */ }
interface ReferralStore  { /* ... */ }
interface SubscriptionStore { /* ... */ }
interface PostContentStore  { /* ... */ }

// Прагматично: пересечение обязательной части + опциональные
type AdminStore = UserStore & Partial<BroadcastStore & PromoStore & /* ... */>;
```

`createAdmin` на старте проверяет, что для каждой включённой фичи стор реализует её `storeContract`,
и кидает понятную ошибку со списком недостающих методов.

### Сервер: инфраструктура

- `asyncHandler(fn)` + единый error-middleware, единый формат ошибки `{ error, details? }`.
- CORS allowlist из `http.cors.origins`.
- Fail-fast: нет токена при `http.enabled` → бросить при старте.
- `/health`, возврат `http.Server`, `admin.stopHttp()` для graceful shutdown.

---

## Часть 3. План по фазам

Каждая фаза заканчивается: `yarn build` зелёный, `astro-bot` стартует (через симлинк, см. `DEVELOPMENT.md`), коммит.

### Фаза 0 — сборка и каркас тестов (без изменения поведения) ✅
- [x] Заменить 3×tsc+babel на `tsup` (cjs + esm + dts за один прогон, корректный `exports`). `tsup.config.ts`.
- [x] Убрать `src/index.cjs.ts`, оставить один `src/index.ts`. Удалены `.babelrc`, `tsconfig.cjs.json`.
- [x] Починить ESM: `lib/index.mjs` + `exports.import`, проверено `import * from ...` работает.
- [x] `dev:build` = `tsup --watch`. `DEVELOPMENT.md` обновлён.
- [x] `vitest@^3` + `test/smoke.test.ts` (проверка публичной поверхности). `yarn test` зелёный.
- [x] `astro-bot` резолвит модуль по симлинку (`main` → `lib/index.js`).

Примечание: vitest 5 / vite 8 (rolldown) требуют Node ≥ 20.12 (`node:util` styleText) — откатились на стабильный `vitest@3`, работает на Node 18/20.

### Фаза 1 — единый вход `createAdmin()` ✅
Решения: своя изолированная сессия внутри; полные deprecated-шимы; свой Stage под ACL целиком.

- [x] `config.ts`: `FEATURE_NAMES` / `DEFAULT_FEATURES` / `resolveFeatures()` — дефолты фич в одном месте. `AdminConfig` / `HttpConfig` / `TelegramMenuConfig`.
- [x] `createAdmin()` (`src/createAdmin.ts`) строит сервисы один раз (`buildAdminServices`), отдаёт `{ services, attachBot, startHttp, stopHttp }`.
- [x] `src/adminBot/createAdminBot.ts`: собственный `Scenes.Stage`, инъекция `ctx.services` / `ctx.config` до сцен (чинит A2).
- [x] Весь admin-flow под `Composer.optional(ctx => admins.includes(ctx.from.id), …)` (чинит A4, A5 — без `Composer.acl`).
- [x] Изоляция сессии: собственный middleware save/restore `ctx.session` + `SessionStore` (`MemorySessionStore` по умолчанию). Тест: сессия хоста не перезаписывается.
- [x] `createAdmin` не читает env; `AdminServer` — env-fallback только с deprecation-warn (B4).
- [x] Удалён мёртвый `initStage()` (A3), дебажные `console.log` (E2), дубли scene-импортов.
- [x] `createAdminServer` / `AdminBot` — `@deprecated`-шимы; `AdminBot.attach(mainStage)` игнорирует аргумент (self-contained). Тесты `test/legacy.test.ts` зелёные.
- [x] astro-bot остаётся на deprecated-путях до Фазы 8 (не трогаем).
- [x] Тесты: `test/adminBot.test.ts` (гейт прав, меню, состояние сцены, изоляция сессии), `test/http.test.ts` (401/200, throw без token), `test/legacy.test.ts`. Всего 10, зелёные.

Осталось на потом (не блокирует): `AdminServer` внутри всё ещё сам инстанцирует сервисы (не через `buildAdminServices`) — уберётся в Фазе 5 при переходе на дескрипторы.

### Фаза 2 — типизация контрактов хоста ✅
- [x] `src/adapters.ts`: `BroadcastScheduler`, `BroadcastAdapter`, `ReportsAdapter`, `AdminAdapters`.
- [x] `AdminConfig.adapters` вместо `botApp` + `scheduler`. `BroadcastService(db, adapter?)`, `ReportService(db, adapter?)` берут только свой адаптер.
- [x] `applyAdapterGating()` — `broadcast`/`reports` без адаптера гасятся с warn; `createAdmin` вызывает при сборке.
- [x] `BotApp` → `@deprecated`. `src/legacy.ts` `adaptLegacyBotApp()` мапит `BotApp` + `scheduler` → `AdminAdapters` (сохраняя старый порядок `replyToUserReport(userId, original, reply)`).
- [x] Адаптеры принимают `Promise<void> | void`. `ReportsAdapter.replyToUser(userId, replyText, originalText)` — явный порядок.
- [x] `AdminServer` больше не строит сервисы и не принимает `BotApp`/`scheduler` — инъекция `services` + `Telegraf`; конструктор `@internal`.
- [x] `CustomRoute.handler` 4-й аргумент: `Telegraf` вместо `BotApp` (astro-bot его игнорит). Добавлен метод `patch`.
- [x] Попутно: **E1** `randomUUID` из `node:crypto`, **E2** дебаг-логи в `broadcast`/`report`, **E7** `Broadcast.updatedAt?` в тип.
- [x] Тесты `test/adapters.test.ts` (7). Всего 17, зелёные. Deprecated-шимы (`test/legacy.test.ts`) зелёные. astro-bot не трогаем.

### Фаза 3 — разбиение `TypedDB` по фичам ✅
- [x] `src/stores.ts`: `UserStore` (всегда) + `SubscriptionStore` / `BroadcastStore` / `PromoStore` / `ReportStore` / `PaymentStore` / `ReferralStore` / `PostContentStore`. `AdminStore = UserStore & Partial<остальное>`.
- [x] `STORE_CONTRACT` (метод→фича) + `validateStore(db, features)` — бросает со списком недостающих методов. `createAdmin` вызывает на старте.
- [x] `TypedDB` = пересечение всех сторов, `@deprecated` alias.
- [x] Каждый сервис принимает свой store (`BroadcastService(db: BroadcastStore)` и т.д.); `UserService` — `UserStore & Partial<Subscription/Report/Promo Store>` (C6, был `any`).
- [x] C4: `getUserStats(): Promise<UserStats>` (`Record<string, unknown>`), `getRefferals(): Promise<RefferalCount[]>`, `countRefferalsByRefLink(): Promise<RefferalCount | number>`, `PaymentStore.getPaymentsStats(): Promise<PaymentStats>`.
- [x] `AdminConfig.db: AdminStore`, `CustomRoute.handler` db-аргумент → `AdminStore`.
- [x] Тесты `test/stores.test.ts` (5): минимальный db, список недостающих методов, «бот только с пользователями», падение при фиче без стора. Всего 22, зелёные.
- [x] Deprecated-шимы `validateStore` не вызывают (лениво) — регрессий у astro-bot нет.

### Фаза 4 — чистка доменной модели ✅
- [x] `AdminUser<Extra>`: `userId`, `username`, `firstName`, `lastName`, `createdAt`, `active`, `promoCode`, `subscription`, `extra`. Убраны из ядра `zodiak` / `bithdate` / `localTimeShift` / `notificationTime` / `demoUsed` / `name` / `refLink` (C2).
- [x] `UserSubscription` в нейтральных терминах: `activeUntil` / `isTrial` / `trialUsed` (было `subscriptionToDate` / `isDemoSubscription` / `demoUsed`). `AdminUser.subscription?: UserSubscription | null` (C3).
- [x] `User` / `Subscription` — `@deprecated` алиасы; `User = AdminUser & { …бывшие astro-поля }` для обратной совместимости.
- [x] `UserStore`, `UserService`, `SessionData.foundUser` → `AdminUser`. `UserProfileScene` переписан под новые поля, убраны `console.log` и `typeof !== "string"`-костыли.
- [x] astro-bot: `src/admin-bot/admin-db.js` (`createAdminDb` / `toAdminUser`) маппит модель бота → `AdminUser` (подписка через `getUser(id, true)` с populate), бот-поля → `extra`. Подключён в `src/main.js`.
- [x] Тест `test/adminBot.test.ts`: профиль рендерит `subscription` в нейтральных терминах. Всего 23, зелёные.

Примечание: полноценный вынос `subscriptions` в отдельный feature-модуль (дескриптор) — в Фазе 5.

### Фаза 5 — feature-модули (дескрипторы)
Разбита на 5b (HTTP) и 5a (сцены/меню).

#### 5b — HTTP-роуты через дескрипторы ✅
- [x] `src/http/http.ts`: `HttpError`, `asyncRoute` (возвращённое значение → JSON, ошибки → `next`), `errorMiddleware` (единый `{ error, details? }`) — **E5**.
- [x] `src/http/routes.ts`: `coreRoutes` + `featureRoutes: Record<FeatureName, (services) => RouteDef[]>` — все ~30 роутов как декларативные `RouteDef`.
- [x] `src/http/register.ts`: `collectRoutes` (по включённым фичам) + `mountRoutes` (роуты + `/api/config` + кастомные).
- [x] `AdminServer` ужат с ~680 до ~110 строк: только express-каркас (cors, auth, mount, error-mw, listen). Приватные поля сервисов и 30 `try/catch` удалены.
- [x] Выключенная фича не регистрирует свои роуты (404), а не «пустой ответ».
- [x] Кастомные роуты: `CustomRouteWithUi` c `ui?: { description, fields }`; `createAdmin` собирает `customRoutesConfig` для `/api/config` из `ui` (B6/B8 на новом пути; legacy `createAdminServer` всё ещё принимает отдельный `customRoutesConfig`).
- [x] `validators/*` — сняты жёсткие дженерики `Request<Record<string, never>, …>` (не совместимы с `RequestHandler`).
- [x] `HttpError` / `RouteDef` / `RouteContext` экспортируются для авторов кастомных роутов.
- [x] Тесты `test/httpRoutes.test.ts` (7): core-роуты, гейтинг (404), 201, 400+details, 404 из хендлера, 500, кастомный роут + `/api/config`. Всего 30, зелёные.

#### 5a — сцены/меню через дескрипторы ✅
- [x] `src/features/index.ts`: `FeatureModule` (`name`, `menu?: MenuEntry`, `scenes()`, `httpRoutes()`), массив `FEATURE_MODULES` (7 фич), `CORE_SCENES` / `CORE_MENU` (пользователи + статистика, всегда).
- [x] Хелперы: `selectEnabledFeatures`, `buildAdminScenes`, `buildMenuEntries`, `buildHttpRoutes` — всё по одному реестру.
- [x] `globalMessageHandler` (97→55): `switch` на 60 строк заменён на `Map<button, sceneId>` из дескрипторов + кастомных сцен. Ветки «фича отключена» не нужны — выключенной фичи просто нет в меню.
- [x] `MainAdminMenuScene` (114→60): клавиатура строится из `buildMenuEntries` (чанки по 2) + кастомные кнопки (дедуп против меню) + выход.
- [x] `stageFactory.ts` и `scenes/index.ts` удалены; `createAdminBot` собирает Stage из `getMainAdminMenuScene` + `buildAdminScenes` + кастомных.
- [x] `http/register.ts` берёт роуты из `buildHttpRoutes` — тот же реестр, что и сцены.
- [x] **E6**: `/api/referrals` (по README) + `/api/reffers` как алиас; поддержан и `?link=`.
- [x] `FEATURE_MODULES` / `selectEnabledFeatures` / `buildMenuEntries` + типы экспортированы.
- [x] Тесты `test/adminBot.test.ts` +3 (меню из дескрипторов, выключенная фича без кнопки, кнопка→сцена), `test/httpRoutes.test.ts` +1 (`/referrals` + алиас). Всего 34, зелёные.
- [ ] (опц., отложено) `*CreateScene` → `WizardScene` (**E10**), `STORE_CONTRACT` физически в `features` (сейчас в `stores.ts`, фичи на него ссылаются — один источник де-факто).

### Фаза 6 — сервер: инфраструктура ✅
- [x] `asyncHandler` + централизованный error-middleware, единый формат `{ error, details? }` (E5) — сделано в 5b.
- [x] CORS allowlist из `http.cors.origins` (E4) — с фазы 2.
- [x] Fail-fast: `AdminServer` бросает в конструкторе без токена (E3), `apiAuth` больше не отдаёт 500.
- [x] `GET /health` (без авторизации), `AdminServer.start()` → `http.Server`, `AdminServer.stop()` / `handle.stopHttp()` — graceful (закрывает сокеты, таймаут 5с) (E9).
- [x] `GET /api/referrals` (README) + `/api/reffers` алиас (E6) — в 5a.
- [x] Тесты `test/httpRoutes.test.ts` +2 (`/health` без токена, throw без токена).

### Фаза 7 — тесты, дока, релиз ✅
- [x] `src/memoryStore.ts` `createMemoryStore(seed)` — in-memory реализация всех сторов (C5). Экспортирован.
- [x] `test/memoryStore.test.ts` (3): контракт всех фич, работа как `db` в `createAdmin` (HTTP+бот), мутация подписки.
- [x] Smoke уже покрыт (35 тестов): HTTP 401/200/404/500, гейт не-админа, меню из дескрипторов.
- [x] README переписан под `createAdmin` (сторы, адаптеры, `AdminUser`, HTTP-таблица, кастомные сцены/роуты, таблица миграции). `CHANGELOG.md`.
- [x] `.github/workflows/ci.yml` — lint + typecheck + test + build на Node 20.
- [x] `typecheck` теперь `tsc -p tsconfig.test.json` (проверяет и `test/`).
- [x] Bump `0.1.0`.

### Фаза 8 — удаление старого API ✅
- [x] Удалены: `src/adminBot/adminBot.ts` (`AdminBot`), `src/createAdminServer.ts`, `src/legacy.ts` (`adaptLegacyBotApp`), `src/types/db.ts` (`TypedDB`), `test/legacy.test.ts`.
- [x] `BotApp`, `Bot` — удалены. `AdminBotConfig` → алиас `= ResolvedFeatures` (B1: один тип). `User` → удалён (везде `AdminUser`). `Subscription` оставлен (тип строки списка подписок).
- [x] `AdminServer` больше не читает `process.env.ADMIN_API_TOKEN` и не варнит — токен только через `http.token`.
- [x] `src/index.ts` — экспорты старого API убраны.
- [x] **astro-bot мигрирован**: `src/admin-server/admin-server.js` + `src/admin-bot/admin-bot.js` удалены, вместо них `src/admin/setup.js` (`setupAdmin(bot, db, scheduler)` → один `createAdmin`). `src/main.js` обновлён. Wiring проверен симуляцией (`attachBot` + `startHttp` + `/api/config` + кастомный роут + `stopHttp`).
- [x] Версия `0.1.0` (весь редизайн — один pre-1.0 breaking-релиз).

⚠️ astro-bot прогнан только статически (lint, syntax, симуляция wiring). Полный запуск с Mongo + реальным ботом — за пользователем.
