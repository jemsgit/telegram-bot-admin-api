# Централизованная панель: прокси-гейтвей к HTTP API ботов

Как администрировать несколько ботов на `telegraf-admin-for-bots` из одной
веб-панели, не таща токены и IP в браузер.

---

## Проблема

- Каждый бот поднимает свой HTTP API (`createAdmin({ http })`) на своём
  `apiUrl` (например `http://104.248.43.82:3010`), защищённый статическим
  per-bot `token` (заголовок `x-api-key` или `Authorization: Bearer`).
- Все роуты — под `/api/*`. `/health` — без токена. `GET /api/config` — под
  токеном, отдаёт флаги фич + `customRoutesConfig` (по нему панель рисует формы).
- Панель — SPA, отдаётся по HTTPS с `https://project.jem-space.ru/bots/<username>/…`.

Если SPA ходит в API ботов **напрямую**:

| Проблема | Причина |
|---|---|
| `Mixed Content ... blocked` | HTTPS-страница не может делать `http://`-запросы |
| Утечка токена | per-bot токен пришлось бы отдать в браузер (виден в DevTools, тяжело ротировать) |
| CORS на каждом боте | пришлось бы вести allowlist origin'ов панели в конфиге каждого бота |
| Светится инфраструктура | IP:порт API бота уходят на клиент |

## Решение

Бэкенд панели выступает **reverse-proxy + auth-gateway**. Браузер разговаривает
только с панелью по HTTPS и своей сессией; панель по `:username` достаёт из своей
БД `apiUrl` + `token` бота и перепроксирует запрос, подставляя токен на своей
стороне.

```
Браузер ──HTTPS + cookie/JWT──▶ Бэкенд панели ──HTTP + Bearer token──▶ API бота
   (без токена бота)            (lookup bot by :username,               (127.0.0.1 /
                                 inject token, audit)                    VPC / TLS)
```

Что закрывается сразу:

- **Mixed content** — браузер бьётся только в HTTPS-origin панели.
- **Токен** — не покидает сервер, лежит (зашифрованным) в БД панели, ротация без
  участия браузера.
- **CORS** — не нужен вообще: в API бота ходит сервер, а не браузер.
- **Инфраструктура** — `apiUrl`/`token`/IP не видны клиенту.
- **Единая точка** — авторизация, аудит, rate-limit, RBAC в одном месте.

---

## Модель данных (сторона панели)

```
bots
  id             uuid   pk
  username       text   unique          -- идёт в URL гейтвея
  name           text
  api_url        text                   -- http://10.114.0.3:3010 (VPC private ip — предпочтительно)
  api_token_enc  bytea                  -- токен, зашифрованный at-rest
  features       jsonb  null            -- кэш ответа GET /api/config (не обязательно)
  updated_at     timestamptz
```

`api_token_enc` — шифровать симметрично (libsodium / node `crypto`), ключ из env /
секрет-менеджера, расшифровывать только в момент запроса.

---

## Маршрутизация

Единый префикс, всё после `:username` уходит в `apiUrl` **как есть**, чтобы панель
не знала внутреннюю структуру роутов модуля:

```
SPA:      GET  https://panel/gw/<username>/api/users?query=vasya
gateway → GET  {bot.api_url}/api/users?query=vasya      + Authorization: Bearer <token>

SPA:      GET  https://panel/gw/<username>/api/config
gateway → GET  {bot.api_url}/api/config

SPA:      POST https://panel/gw/<username>/api/broadcasts   { ...body }
gateway → POST {bot.api_url}/api/broadcasts   { ...body }
```

`/health` можно не проксировать — для «бот жив?» гейтвей сам дергает
`{api_url}/health` без токена.

---

## Гейтвей (набросок, Express; логика фреймворко-независима)

```js
// requireOperator — существующая сессия/JWT панели
router.all("/gw/:username/*", requireOperator, async (req, res) => {
  const bot = await db.bots.findByUsername(req.params.username);
  if (!bot) return res.status(404).json({ error: "bot_not_found" });
  if (!operatorCanAccess(req.user, bot))
    return res.status(403).json({ error: "forbidden" });

  const subPath = "/" + (req.params[0] ?? "");          // всё после :username
  if (!subPath.startsWith("/api/"))                     // пропускаем только /api/*
    return res.status(400).json({ error: "bad_path" });

  const target = new URL(subPath, withSlash(bot.api_url));
  for (const [k, v] of Object.entries(req.query)) target.searchParams.append(k, v);

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: {
        authorization: `Bearer ${decrypt(bot.api_token_enc)}`,
        "content-type": req.get("content-type") ?? "application/json",
      },
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return res.status(502).json({ error: "bot_unreachable" });
  }

  if (req.method !== "GET")
    await audit.log({
      operator: req.user.id, bot: bot.id,
      method: req.method, path: subPath, status: upstream.status,
    });

  res.status(upstream.status);
  res.set("content-type", upstream.headers.get("content-type") ?? "application/json");
  res.send(Buffer.from(await upstream.arrayBuffer()));
});
```

Замечания:

- **Проксируй `status` и тело как есть.** Модуль уже отдаёт нормальные коды
  (`400` + `details`, `401`, `404`, `500` + `{error:"internal_error"}`) — панель
  не должна их переинтерпретировать.
- **Никогда не логируй и не возвращай** `api_url` / расшифрованный токен.
- **Таймаут обязателен** — упавший бот не должен вешать воркер панели.
- Ответы бывают большими (выгрузка юзеров) — при желании стримить, а не буферить.

---

## SPA

- База — origin панели (или отдельный `api.jem-space.ru`), **тот же, что отдаёт
  SPA** → нет ни mixed content, ни CORS.
- Все запросы: `${base}/gw/${username}/api/${resource}`.
- **Токена бота в SPA нет.** Авторизация — сессионная кука панели (шлётся сама)
  или короткоживущий JWT.
- `GET /gw/<username>/api/config` → по ответу решаем, какие вкладки/формы фич
  показывать для этого бота; кэшируем per-bot.

---

## Безопасность по слоям

| Слой | Что делаем |
|---|---|
| Браузер ↔ панель | HTTPS (уже есть). Сессия/JWT панели. CSRF-защита на мутациях. |
| AuthZ | RBAC: какой оператор к каким ботам имеет доступ (`operatorCanAccess`). |
| Панель ↔ API бота | по возрастанию: (1) firewall — порт бота открыт **только с IP панели** (`ufw allow from <panel_ip> to any port 3010`); (2) приватная сеть — `api_url` = VPC private ip (трафик не выходит в интернет); (3) TLS на каждом боте (Caddy) — `api_url` = `https://…`; (4) WireGuard / Cloudflare Tunnel между хостами. |
| API бота | не публичный: `ufw deny 3010` для мира; в идеале bind `127.0.0.1` + туннель. |
| Токен | зашифрован at-rest в БД панели; расшифровка только в хендлере гейтвея; ротация — обновить строку в БД + env бота + рестарт бота. |
| Аудит | лог всех мутаций: оператор, бот, метод, путь, статус, время. |
| Абуз | rate-limit на `/gw/*`; опц. allowlist методов на роль (например `DELETE` только для senior). |

Минимально приемлемо для старта: **firewall порта бота на IP панели + HTTPS
панели + токен только на бэке**. Приватная сеть / TLS на хопе — следующий шаг.

---

## Конфиг бота (`createAdmin`)

```js
createAdmin({
  // ...
  http: {
    enabled: true,
    port: 3010,
    token: process.env.ADMIN_API_TOKEN,   // = api_token в БД панели
    // cors можно не задавать вовсе: в API ходит гейтвей (сервер), не браузер.
    // Если всё же оставляете прямой доступ откуда-то из браузера — узкий allowlist.
  },
});
```

Плюс на хосте бота: `ufw` закрывает `3010` для всех, кроме IP панели.

---

## Миграция с текущей схемы

1. Поднять роут `/gw/:username/*` в бэкенде панели.
2. Завести строку `bots`: `username`, `api_url = http://104.248.43.82:3010`,
   `api_token_enc = enc(<текущий токен>)`.
3. Переключить SPA с `http://104.248.43.82:3010/api/...` на
   `https://<panel>/gw/<username>/api/...`; убрать токен из сборки SPA.
4. `ufw`: `deny 3010` миру, `allow from <panel_ip> to any port 3010`.
5. Позже: `api_url` → приватный IP VPC (если бот и панель у одного провайдера в
   одном регионе) либо TLS на боте.

---

## Крайние случаи

- **Бот недоступен** → гейтвей отдаёт `502 {error:"bot_unreachable"}`, панель
  показывает «бот офлайн» (пинг `{api_url}/health`).
- **Ротация токена** — обновить `api_token_enc` + env бота + рестарт; заявок в
  модуль не требуется.
- **Несколько ботов на одном IP** — различаются портом в `api_url`, гейтвею
  всё равно.
- **Кастомные роуты бота** (`http.customRoutes`) — уже под `/api` и под тем же
  токеном, проксируются тем же правилом без спец-обработки.
- **`GET /api/config` под токеном** — гейтвей подставляет токен, для SPA
  прозрачно.
