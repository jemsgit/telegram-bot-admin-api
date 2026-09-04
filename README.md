# telegraf-admin-for-bots

Универсальная админка для Telegram-ботов на [Telegraf](https://telegraf.js.org/).
Подключается к любому боту по одному паттерну и даёт:

- **Telegram-меню администратора** — управление ботом прямо из чата (команда `/admin`);
- **HTTP REST API** — для внешней админ-панели.

Модуль не зависит от БД: вы передаёте объект, реализующий сторы включённых фич.

---

## Содержание

- [Установка](#установка)
- [Быстрый старт](#быстрый-старт)
- [Конфигурация `createAdmin`](#конфигурация-createadmin)
- [Фичи](#фичи)
- [Сторы БД](#сторы-бд)
- [Адаптеры хоста](#адаптеры-хоста)
- [Модель пользователя `AdminUser`](#модель-пользователя-adminuser)
- [HTTP API](#http-api)
- [Кастомные сцены](#кастомные-сцены)
- [Кастомные HTTP-роуты](#кастомные-http-роуты)
- [Миграция с 0.0.x](#миграция-с-00x)

---

## Установка

```bash
npm install telegraf-admin-for-bots
# telegraf — peer dependency
npm install telegraf
```

---

## Быстрый старт

```js
const { Telegraf } = require("telegraf");
const { createAdmin } = require("telegraf-admin-for-bots");

const bot = new Telegraf(process.env.BOT_TOKEN);

const admin = createAdmin({
  bot,
  admins: [123456789], // Telegram ID администраторов
  db, // объект со сторами включённых фич (см. ниже)

  features: {
    broadcast: true,
    reports: true,
    promocodes: true,
    // остальные — по умолчанию включены
  },

  adapters: {
    broadcast: {
      scheduler, // { scheduleBroadcast, rescheduleBroadcast, cancelBroadcast }
      sendTest: (broadcast) => myBot.sendTestBroadcast(broadcast),
    },
    reports: {
      replyToUser: (userId, replyText) =>
        bot.telegram.sendMessage(userId, replyText),
    },
  },

  telegramMenu: { enabled: true },

  http: {
    enabled: true,
    port: 3010,
    token: process.env.ADMIN_API_TOKEN,
  },
});

admin.attachBot(); // монтирует /admin-меню — до bot.launch()
admin.startHttp(); // поднимает HTTP API -> http.Server

bot.launch();
```

Для прототипа сгодится встроенное in-memory хранилище:

```js
const { createMemoryStore } = require("telegraf-admin-for-bots");
const db = createMemoryStore({ users: [{ userId: 1, username: "me", active: true }] });
```

---

## Конфигурация `createAdmin`

```ts
interface AdminConfig {
  bot: Telegraf;               // инстанс бота-хоста
  admins: number[];            // Telegram ID администраторов
  db: AdminStore;              // сторы включённых фич (обязателен UserStore)
  features?: Partial<FeaturesConfig>;   // по умолчанию все включены
  adapters?: AdminAdapters;    // нужны для broadcast / reports
  telegramMenu?: {
    enabled?: boolean;         // default true
    session?: { store?; getSessionKey? };  // своя сессия admin-меню
    customScenes?: CustomScene[];
  };
  http?: {
    enabled?: boolean;
    port?: number;             // default 3105
    token?: string;            // ОБЯЗАТЕЛЕН при enabled
    cors?: { origins: string[] | true };
    customRoutes?: CustomRouteWithUi[];
  };
  logger?: Logger;             // winston / pino / свой { debug,info,warn,error }
  logLevel?: LogLevel;         // "debug" | "info" | "warn" | "error" | "silent" (default "info")
}
```

По умолчанию модуль пишет в `console` с префиксом `[telegraf-admin-for-bots]`.
Передайте `logger`, чтобы направить логи в свой транспорт, или `logLevel` — чтобы
приглушить встроенный.

`createAdmin` возвращает:

```ts
interface AdminHandle {
  services: AdminServices;     // доступ к сервисам
  attachBot(): void;
  startHttp(): http.Server | undefined;
  stopHttp(): Promise<void>;   // graceful shutdown
}
```

Модуль **не читает переменные окружения** — токен, порт и админов передавайте явно.

---

## Фичи

| Фича | Меню | HTTP | Требует адаптер | Требует стор |
|---|---|---|---|---|
| _users, statistics_ | всегда | всегда | — | `UserStore` |
| `broadcast` | 📢 Рассылки | `/api/broadcasts*` | `adapters.broadcast` | `BroadcastStore` |
| `subscriptions` | — | `/api/subscriptions*` | — | `SubscriptionStore` |
| `promocodes` | 🎁 Промокоды | `/api/promocodes*` | — | `PromoStore` |
| `reports` | 📝 Обращения | `/api/reports*` | `adapters.reports` | `ReportStore` |
| `payments` | 💰 Платежи | `/api/payments*` | — | `PaymentStore` |
| `referral` | — | `/api/referrals` | — | `ReferralStore` |
| `postcontentAd` | 📈 Инлайн реклама | `/api/ads*` | — | `PostContentStore` |

Выключенная фича не показывается в меню и не регистрирует свои HTTP-роуты.
Если фича включена, но нужный адаптер не передан — фича **тихо отключается**
с предупреждением в лог.

---

## Сторы БД

`db` должен реализовать `UserStore` + сторы включённых фич. `createAdmin` проверяет
это на старте и бросает со списком недостающих методов.

```ts
interface UserStore {          // всегда
  findUsersByQuery(query: string): Promise<AdminUser[]>;
  findUserById(userId: IdLike): Promise<AdminUser | null>;
  getUsers(): Promise<AdminUser[]>;
  getUserStats(): Promise<Record<string, unknown>>;
}

interface BroadcastStore {
  getAllBroadcasts(status?): Promise<Broadcast[]>;
  getBroadcast(id): Promise<Broadcast | null>;
  saveBroadcast(b): Promise<void>;
  deleteBroadcast(id): Promise<boolean>;
}

interface SubscriptionStore {
  getAllSubscriptions(): Promise<Subscription[]>;
  extendSubscription(userId, days): Promise<boolean>;
  activatePromoSubscription(userId, { days }): Promise<boolean>;
  deleteSubscription(userId): Promise<boolean>;
}

interface PromoStore {
  createPromoCode(data): Promise<Promo>;
  deletePromocode(code): Promise<boolean>;
  getAllPromoCodes(): Promise<Promo[]>;
  addPromoCodeToUser(userId, code): Promise<boolean>;
}

interface ReportStore {
  getReports(): Promise<UserReport[]>;
  getReportById(id): Promise<UserReport | null>;
  saveReportReply(id, author, text): Promise<void>;
  getUserReports(userId): Promise<UserReport[]>;
}

interface PaymentStore {
  getAllPayments(): Promise<Payment[]>;
  getPaymentsStats(): Promise<PaymentStats>;
}

interface ReferralStore {
  getRefferals(): Promise<RefferalCount[]>;
  countRefferalsByRefLink(link): Promise<RefferalCount | number>;
}

interface PostContentStore {
  getAds(filter?): Promise<PostContentAd[]>;
  getAdById(id): Promise<PostContentAd | null>;
  createAd(data): Promise<PostContentAd>;
  updateAd(id, data): Promise<PostContentAd | null>;
  deleteAd(id): Promise<boolean>;
  addAdViewToUser(userId, adId): Promise<PostContentAdView>;
  getAdForUser(userId, type): Promise<PostContentAd | null>;
}
```

Проверить свою реализацию:

```js
const { validateStore } = require("telegraf-admin-for-bots");
validateStore(db, { broadcast: true, reports: true }); // бросит, если чего-то нет
```

---

## Адаптеры хоста

```ts
interface BroadcastScheduler {
  scheduleBroadcast(b: Broadcast): void | Promise<void>;
  rescheduleBroadcast(id: string, b: Broadcast): boolean | Promise<boolean>;
  cancelBroadcast(id: string): void | Promise<void>;
}

adapters.broadcast = {
  scheduler: BroadcastScheduler,
  sendTest(b: Broadcast): void | Promise<void>,   // отправить тест админу
};

adapters.reports = {
  replyToUser(userId: number, replyText: string, originalText: string): void | Promise<void>,
};
```

---

## Модель пользователя `AdminUser`

Сторы возвращают пользователя в терминах админки. Всё бот-специфичное — в `extra`.

```ts
interface AdminUser<Extra = Record<string, unknown>> {
  userId: number | string;
  username?: string;
  firstName?: string;
  lastName?: string;
  createdAt?: Date;
  active?: boolean;
  promoCode?: string;
  subscription?: {
    activeUntil?: Date | null;
    isTrial?: boolean;
    trialUsed?: boolean;
  } | null;
  extra?: Extra;    // zodiak, birthday, ... — что угодно вашего бота
}
```

Ваш стор маппит модель бота в `AdminUser` (см. пример адаптера в `astro-bot/src/admin-bot/admin-db.js`).

---

## HTTP API

Базовый путь `/api`. Все запросы, кроме `GET /health`, требуют токен:

```
x-api-key: <token>
Authorization: Bearer <token>
```

> Админите несколько ботов из одной веб-панели? Не ходите в эти API из браузера
> напрямую (mixed content + токен на клиенте) — проксируйте через бэкенд панели.
> См. [docs/CENTRAL_PANEL_GATEWAY.md](docs/CENTRAL_PANEL_GATEWAY.md).

| Метод | Путь | Фича |
|---|---|---|
| `GET` | `/health` | — (без токена) |
| `GET` | `/api/config` | — |
| `GET` | `/api/users?query=` | users |
| `GET` | `/api/users/all` | users |
| `GET` | `/api/users/:id` | users |
| `GET` | `/api/stats` | users |
| `GET`/`POST`/`PUT`/`DELETE` | `/api/broadcasts*` | broadcast |
| `POST` | `/api/broadcasts/:id/send-test` | broadcast |
| `GET` | `/api/subscriptions` | subscriptions |
| `POST` | `/api/users/:id/extend-subscription` `{ days }` | subscriptions |
| `POST` | `/api/users/:id/activate-promo-subscription` `{ days }` | subscriptions |
| `DELETE` | `/api/users/:id/subscription` | subscriptions |
| `GET`/`POST`/`DELETE` | `/api/promocodes*` | promocodes |
| `POST` | `/api/users/:id/promocode` `{ promoCode }` | promocodes |
| `GET` | `/api/reports`, `/api/reports/:id` | reports |
| `POST` | `/api/reports/:id/reply` `{ text }` | reports |
| `GET` | `/api/users/:id/reports` | reports |
| `GET` | `/api/payments`, `/api/payments/stats` | payments |
| `GET` | `/api/referrals?link=` | referral |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/ads*` | postcontentAd |

Формат ошибки: `{ "error": string, "details"?: unknown }`.

---

## Кастомные сцены

```js
const { Scenes } = require("telegraf");

const MyScene = new Scenes.BaseScene("MyScene");
MyScene.enter(async (ctx) => {
  const users = await ctx.services.userService.getAll(); // ctx.services доступны
  await ctx.reply(`Всего: ${users.length}`);
});

createAdmin({
  // ...
  telegramMenu: {
    enabled: true,
    customScenes: [
      { name: "MyScene", scene: MyScene, buttonText: "🔧 Мой раздел" }, // кнопка в меню
      { name: "MyChildScene", scene: MyChildScene },                    // без кнопки
    ],
  },
});
```

Внутри сцен: `ctx.services.{userService, broadcastService, reportService,
promocodeService, subscriptionService, refferService, paymentService,
postContentService}`, `ctx.config` — флаги фич.

---

## Кастомные HTTP-роуты

Точка расширения для бот-специфичной логики (то, чего нет среди фич модуля).
Один элемент массива: путь + опциональная валидация + хендлер + UI-схема.

```js
const { HttpError } = require("telegraf-admin-for-bots");

createAdmin({
  // ...
  db, // объект db может нести любые методы сверх AdminStore — модуль их не трогает,
      // но отдаёт целиком в хендлеры кастомных роутов
  http: {
    enabled: true,
    token: process.env.ADMIN_API_TOKEN,
    customRoutes: [
      {
        method: "post",
        path: "users/:userId/rights", // '/api/' можно писать или опустить
        // необязательные express-миддлвары до хендлера
        validate: (req, res, next) =>
          req.body.right ? next() : res.status(422).json({ error: "right required" }),
        // сигнатура: (req, res, next, bot: Telegraf, db)
        handler: async (req, res, next, bot, db) => {
          await db.addUserRight(req.params.userId, req.body.right);
          await bot.telegram.sendMessage(
            req.params.userId,
            `Выдано право: ${req.body.right}`,
          );
          return { rights: await db.getUserRights(req.params.userId) };
          // вернул значение → 200 + JSON; вернул undefined → 204;
          // нужен свой статус/тело — вызови res.json(...) и верни undefined;
          // throw new HttpError(code, msg, details) → {error, details};
          // любой другой throw → 500 + лог
        },
        ui: {
          description: "Выдать пользователю право",
          fields: [
            { name: "userId", type: "numberInput", required: true, placement: "path" },
            { name: "right", type: "textInput", required: true },
          ],
        },
      },
    ],
  },
});
```

Кастомные роуты монтируются **под `/api` и под той же авторизацией**
(`x-api-key` / `Authorization: Bearer <token>`), что и роуты модуля — префикс
`/api/` в `path` можно указывать или опускать.

`GET /api/config` возвращает флаги фич + `customRoutesConfig` (собранный из `ui`,
с нормализованным `url`) — внешняя панель строит по нему формы.

---

## Миграция с 0.0.x

| 0.0.x | 0.1.0 |
|---|---|
| `new AdminBot(botApp, config, [ID], db, scheduler, scenes).attach(stage)` | `createAdmin({ bot, admins, db, features, adapters, telegramMenu: { customScenes } }).attachBot()` |
| `createAdminServer(botApp, db, scheduler, opts).start()` | `createAdmin({ ..., http: { enabled, port, token, customRoutes } }).startHttp()` |
| `BotApp { bot, sendTestBroadcast, replyToUserReport }` | `bot: Telegraf` + `adapters.broadcast.sendTest` + `adapters.reports.replyToUser` |
| `TypedDB` (25 методов) | сторы включённых фич |
| `customRoutes` + `customRoutesConfig` | один `customRoutes` c полем `ui` |
| `ADMIN_API_TOKEN` из env | `http.token` явно |
| `User.zodiak`, `User.bithdate`, ... | `AdminUser.extra` |
| `User.subscription.{subscriptionToDate, isDemoSubscription, demoUsed}` | `AdminUser.subscription.{activeUntil, isTrial, trialUsed}` |
| `GET /api/reffers` | `GET /api/referrals` (`/api/reffers` — алиас) |

Локальная разработка модуля — см. [DEVELOPMENT.md](./DEVELOPMENT.md).
Ход рефакторинга — [REFACTORING.md](./REFACTORING.md).
