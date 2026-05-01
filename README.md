# telegraf-admin-for-bots

Библиотека для быстрого добавления административного интерфейса в Telegram-бот. Предоставляет два компонента:

- **AdminBot** — интерактивное Telegram-меню для управления ботом прямо из чата
- **AdminServer** — HTTP REST API для внешних административных панелей

---

## Содержание

- [Установка](#установка)
- [Требования к интеграции](#требования-к-интеграции)
- [AdminBot](#adminbot)
- [AdminServer](#adminserver)
- [Конфигурация функций](#конфигурация-функций)
- [HTTP API](#http-api)
- [Расширение: кастомные сцены](#расширение-кастомные-сцены)
- [Расширение: кастомные HTTP-роуты](#расширение-кастомные-http-роуты)

---

## Установка

```bash
# npm
npm install telegraf-admin-for-bots

# yarn
yarn add telegraf-admin-for-bots
```

Пакет требует `telegraf` как peer dependency:

```bash
npm install telegraf
```

---

## Требования к интеграции

### Интерфейс `TypedDB`

Библиотека не зависит от конкретной БД. Нужно передать объект, реализующий интерфейс `TypedDB`. Ниже полный список методов:

```typescript
interface TypedDB {
  // Пользователи
  findUsersByQuery(query: string): Promise<User[]>;
  findUserById(userId: string | number): Promise<User | null>;
  getUsers(): Promise<User[]>;
  getUserStats(): Promise<any>;
  extendSubscription(userId: string | number, days: number): Promise<boolean>;
  activatePromoSubscription(
    userId: string | number,
    data: { days: number },
  ): Promise<boolean>;
  deleteSubscription(userId: string | number): Promise<boolean>;
  getUserReports(userId: string | number): Promise<UserReport[]>;
  addPromoCodeToUser(
    userId: string | number,
    promoCode: string,
  ): Promise<boolean>;

  // Подписки
  getAllSubscriptions(): Promise<Subscription[]>;

  // Обращения
  getReports(): Promise<UserReport[]>;
  getReportById(reportId: string): Promise<UserReport | null>;
  saveReportReply(
    reportId: string,
    author: string,
    text: string,
  ): Promise<void>;

  // Рассылки
  getAllBroadcasts(status?: string | null): Promise<Broadcast[]>;
  getBroadcast(id: string): Promise<Broadcast | null>;
  saveBroadcast(broadcast: Broadcast): Promise<void>;
  deleteBroadcast(id: string): Promise<boolean>;

  // Промокоды
  createPromoCode(
    data: Omit<Promo, "isActive"> & { isActive?: boolean },
  ): Promise<Promo>;
  deletePromocode(code: string): Promise<boolean>;
  getAllPromoCodes(): Promise<Promo[]>;

  // Платежи
  getAllPayments(): Promise<Payment[]>;
  getPaymentsStats(): Promise<{
    currentMonth: PaymentStats;
    lastMonth: PaymentStats;
  }>;

  // Рефералы
  getRefferals(): Promise<any[]>;
  countRefferalsByRefLink(link: string): Promise<any>;

  // Инлайн-реклама
  getAds(filter?: Partial<PostContentAd>): Promise<PostContentAd[]>;
  getAdById(id: string): Promise<PostContentAd | null>;
  createAd(data: PostContentAd): Promise<PostContentAd>;
  updateAd(
    id: string,
    data: Partial<PostContentAd>,
  ): Promise<PostContentAd | null>;
  deleteAd(id: string): Promise<boolean>;
  addAdViewToUser(userId: string, adId: string): Promise<PostContentAdView>;
  getAdForUser(userId: string, type: string): Promise<PostContentAd | null>;
}
```

### Интерфейс `BotApp`

Объект вашего бота должен иметь следующую форму:

```typescript
interface BotApp {
  bot: Telegraf<any>; // Экземпляр Telegraf
  sendTestBroadcast(broadcast: Broadcast): void; // Отправить тестовую рассылку себе
  replyToUserReport(userId: number, message: string, text: string): void; // Ответить на обращение
}
```

---

## AdminBot

Добавляет Telegram-меню администратора прямо в ваш бот. Доступно по команде `/admin`.

### Подключение

```javascript
const { AdminBot } = require("telegram-admin-server");

class MyAdminBot {
  constructor(bot, db, scheduleService) {
    this.adminBot = new AdminBot(
      bot, // BotApp — объект с полями bot, sendTestBroadcast, replyToUserReport
      {
        // AdminBotConfig — включить/выключить модули
        broadcast: true,
        subscriptions: true,
        promocodes: true,
        reports: true,
        referral: true,
        payments: true,
        postcontentAd: true,
      },
      [123456789], // Массив Telegram ID администраторов
      db, // Объект TypedDB
      scheduleService, // Сервис планировщика рассылок
      [], // Кастомные сцены (см. раздел расширения)
    );
  }

  start(stage) {
    // Передаём stage бота — adminBot добавит в него свои сцены
    this.adminBot.attach(stage);
  }
}
```

### Команды бота

| Команда  | Описание                            |
| -------- | ----------------------------------- |
| `/admin` | Открыть главное меню администратора |
| `/user`  | Вернуться в пользовательский режим  |

### Главное меню

Кнопки в меню отображаются динамически в зависимости от включённых модулей:

| Кнопка            | Модуль          | Описание                                      |
| ----------------- | --------------- | --------------------------------------------- |
| 👥 Пользователи   | всегда          | Поиск, просмотр профиля, управление подпиской |
| 📊 Статистика     | всегда          | Сводка по пользователям и платежам            |
| 📢 Рассылки       | `broadcast`     | Создание и управление рассылками              |
| 📝 Обращения      | `reports`       | Просмотр и ответ на сообщения пользователей   |
| 🎁 Промокоды      | `promocodes`    | Создание и удаление промокодов                |
| 💰 Платежи        | `payments`      | История и статистика платежей                 |
| 📈 Инлайн реклама | `postcontentAd` | Управление встроенной рекламой в постах       |

---

## AdminServer

Запускает HTTP-сервер с REST API для внешней административной панели.

### Подключение через `createAdminServer`

```javascript
const { createAdminServer } = require("telegram-admin-server");

const adminServer = createAdminServer(
  bot, // BotApp
  db, // TypedDB
  scheduler, // Сервис планировщика
  {
    port: 3105, // Порт (по умолчанию 3105)
    features: { broadcast: true }, // Включённые функции (по умолчанию все включены)
    baseUrl: "https://my-domain.com", // Базовый URL (опционально)
    customRoutes: [], // Кастомные роуты (см. раздел расширения)
  },
);

adminServer.start();
```

### Переменные окружения

| Переменная        | Описание                                               |
| ----------------- | ------------------------------------------------------ |
| `ADMIN_API_TOKEN` | Токен для авторизации запросов к API (**обязательно**) |

### Авторизация

Все запросы к `/api/*` должны содержать токен одним из способов:

```
x-api-key: your-token
Authorization: Bearer your-token
```

---

## Конфигурация функций

Объект `AdminBotConfig` / `features` управляет доступными модулями:

```typescript
{
  broadcast: boolean; // Рассылки
  subscriptions: boolean; // Управление подписками
  promocodes: boolean; // Промокоды
  reports: boolean; // Обращения пользователей
  referral: boolean; // Реферальная система
  payments: boolean; // Платежи
  postcontentAd: boolean; // Инлайн-реклама в постах
}
```

Отключённые модули не отображаются в меню бота и не регистрируют соответствующие HTTP-роуты.

---

## HTTP API

Базовый путь: `/api`. Все запросы требуют авторизации.

### Пользователи

| Метод | Путь                   | Описание                           |
| ----- | ---------------------- | ---------------------------------- |
| `GET` | `/api/users?query=...` | Поиск пользователей                |
| `GET` | `/api/users/all`       | Все пользователи                   |
| `GET` | `/api/users/:id`       | Пользователь по ID                 |
| `GET` | `/api/stats`           | Статистика (пользователи, платежи) |

### Подписки _(требует `subscriptions: true`)_

| Метод    | Путь                                         | Тело               | Описание                    |
| -------- | -------------------------------------------- | ------------------ | --------------------------- |
| `GET`    | `/api/subscriptions`                         | —                  | Список всех подписок        |
| `POST`   | `/api/users/:id/extend-subscription`         | `{ days: number }` | Продлить подписку           |
| `POST`   | `/api/users/:id/activate-promo-subscription` | `{ days: number }` | Активировать промо-подписку |
| `DELETE` | `/api/users/:id/subscription`                | —                  | Удалить подписку            |

### Обращения _(требует `reports: true`)_

| Метод  | Путь                           | Тело               | Описание                           |
| ------ | ------------------------------ | ------------------ | ---------------------------------- |
| `GET`  | `/api/reports`                 | —                  | Все обращения                      |
| `GET`  | `/api/reports/:reportId`       | —                  | Обращение по ID                    |
| `POST` | `/api/reports/:reportId/reply` | `{ text: string }` | Ответить на обращение              |
| `GET`  | `/api/users/:id/reports`       | —                  | Обращения конкретного пользователя |

### Рассылки _(требует `broadcast: true`)_

| Метод    | Путь                            | Описание                                                                        |
| -------- | ------------------------------- | ------------------------------------------------------------------------------- |
| `GET`    | `/api/broadcasts?status=...`    | Список рассылок (фильтр по статусу: `pending`, `progress`, `done`, `cancelled`) |
| `GET`    | `/api/broadcasts/:id`           | Рассылка по ID                                                                  |
| `POST`   | `/api/broadcasts`               | Создать рассылку                                                                |
| `DELETE` | `/api/broadcasts/:id`           | Удалить рассылку                                                                |
| `POST`   | `/api/broadcasts/:id/send-test` | Отправить тестовую рассылку                                                     |

Тело для создания рассылки:

```json
{
  "title": "Название",
  "type": "text | photo | video",
  "text": "Текст сообщения",
  "mediaUrl": "https://...",
  "scheduledAt": "2025-12-31T12:00:00Z",
  "excludePaid": false,
  "linkButtons": [{ "text": "Кнопка", "url": "https://..." }]
}
```

### Промокоды _(требует `promocodes: true`)_

| Метод    | Путь                       | Описание                          |
| -------- | -------------------------- | --------------------------------- |
| `GET`    | `/api/promocodes`          | Все промокоды                     |
| `POST`   | `/api/promocodes`          | Создать промокод                  |
| `DELETE` | `/api/promocodes/:code`    | Удалить промокод                  |
| `POST`   | `/api/users/:id/promocode` | Применить промокод к пользователю |

### Платежи _(требует `payments: true`)_

| Метод | Путь                  | Описание                              |
| ----- | --------------------- | ------------------------------------- |
| `GET` | `/api/payments`       | Все платежи                           |
| `GET` | `/api/payments/stats` | Статистика за текущий и прошлый месяц |

### Инлайн-реклама _(требует `postcontentAd: true`)_

| Метод    | Путь           | Описание                |
| -------- | -------------- | ----------------------- |
| `GET`    | `/api/ads`     | Список рекламных блоков |
| `GET`    | `/api/ads/:id` | Рекламный блок по ID    |
| `POST`   | `/api/ads`     | Создать рекламный блок  |
| `PATCH`  | `/api/ads/:id` | Обновить рекламный блок |
| `DELETE` | `/api/ads/:id` | Удалить рекламный блок  |

### Рефералы _(требует `referral: true`)_

| Метод | Путь                      | Описание                         |
| ----- | ------------------------- | -------------------------------- |
| `GET` | `/api/referrals`          | Все рефералы                     |
| `GET` | `/api/referrals?link=...` | Статистика по реферальной ссылке |

---

## Расширение: кастомные сцены

Можно добавить собственные Telegraf-сцены в меню администратора. Они отображаются как кнопки в главном меню и полностью доступны внутри admin-контекста.

```javascript
const { Scenes } = require("telegraf");

// Создаём кастомную сцену
const MyCustomScene = new Scenes.BaseScene("MyCustomScene");

MyCustomScene.enter(async (ctx) => {
  await ctx.reply("Добро пожаловать в кастомный раздел!");
});

MyCustomScene.on("text", async (ctx) => {
  // ctx.services — доступны все сервисы библиотеки
  const users = await ctx.services.userService.getAll();
  await ctx.reply(`Всего пользователей: ${users.length}`);
  await ctx.scene.enter("MainAdminMenuScene");
});

// Передаём сцену при создании AdminBot
const adminBot = new AdminBot(bot, config, [ADMIN_ID], db, scheduler, [
  {
    name: "MyCustomScene", // Имя сцены (должно совпадать с именем в BaseScene)
    scene: MyCustomScene, // Экземпляр сцены
    buttonText: "🔧 Мой раздел", // Кнопка в главном меню (опционально)
  },
  {
    name: "MyChildScene", // Дочерняя сцена без кнопки в главном меню
    scene: MyChildScene,
  },
]);
```

Внутри кастомных сцен через `ctx` доступны все сервисы библиотеки:

```javascript
ctx.services.userService; // UserService
ctx.services.broadcastService; // BroadcastService
ctx.services.reportService; // ReportService
ctx.services.promocodeService; // PromocodeService
ctx.services.subscriptionService;
ctx.services.refferService;
ctx.services.paymentService;
ctx.services.postContentService;
```

---

## Расширение: кастомные HTTP-роуты

Можно добавить собственные роуты в `AdminServer`. Они автоматически защищены той же авторизацией, что и встроенные.

```javascript
const adminServer = createAdminServer(bot, db, scheduler, {
  customRoutes: [
    {
      method: "get",
      path: "/api/my-stats",
      handler: async (req, res, next, bot, db) => {
        const users = await db.getUsers();
        res.json({ count: users.length });
      },
    },
    {
      method: "post",
      path: "/api/notify",
      handler: async (req, res, next, bot, db) => {
        const { userId, message } = req.body;
        await bot.bot.telegram.sendMessage(userId, message);
        res.json({ ok: true });
      },
    },
  ],
});
```

Обработчик получает:

| Аргумент | Тип                | Описание           |
| -------- | ------------------ | ------------------ |
| `req`    | `Express.Request`  | Запрос             |
| `res`    | `Express.Response` | Ответ              |
| `next`   | `NextFunction`     | Express next       |
| `bot`    | `BotApp`           | Объект вашего бота |
| `db`     | `TypedDB`          | Объект базы данных |
