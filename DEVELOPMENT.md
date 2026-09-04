# Локальная разработка модуля админки

Как связать `telegraf-admin-for-bots` (этот репозиторий) с ботом-потребителем так,
чтобы правки в исходниках модуля сразу подхватывались в боте без публикации в реестр
и без ручного переустановления пакета.

Пример потребителя ниже — `astro-bot`, но паттерн одинаков для любого бота на telegraf.

---

## Как это работает

```
admin-server/src/*.ts
      │  tsup --watch  (yarn dev:build)
      ▼
admin-server/lib/index.js (cjs) + index.mjs (esm) + index.d.ts
      │  симлинк:  astro-bot/node_modules/telegraf-admin-for-bots  ->  admin-server
      ▼
astro-bot  (nodemon следит за node_modules/telegraf-admin-for-bots/lib)
      │  рестарт процесса бота
      ▼
изменения в проде dev-бота
```

Три независимых звена:

1. **Watch-сборка** в модуле: `tsup --watch` пересобирает `lib/` (cjs + esm + d.ts) при
   каждом сохранении. Потребитель (`astro-bot`) подключается через `require` и берёт
   `lib/index.js` (поле `main`).
2. **Симлинк** `node_modules/telegraf-admin-for-bots -> ../../admin-server`, поставленный
   напрямую (`ln -s`), а не через протоколы пакетных менеджеров:
   - `file:../admin-server` в yarn classic **копирует** папку → правки не видны без повторного `yarn add --force`;
   - `yarn link` ведёт себя по-разному в yarn 1 (бот) и yarn 4 (модуль);
   - `npm link` реифицирует всё дерево бота и упирается в аутентификацию Nexus;
   - `link:../admin-server` в `package.json` попал бы в коммит и сломал бы Docker-сборку.
   Прямой `ln -s` не трогает `package.json` и не ходит в реестр. Скрипт `yarn link:admin` делает то же.
3. **nodemon** в боте: по умолчанию игнорирует весь `node_modules`. Через `nodemon.json`
   (`ignoreRoot` + `watch` на `lib`) он начинает следить за папкой симлинка и перезапускает бота.

### Два экземпляра Telegraf в linked-режиме

`telegraf` лежит и в `peerDependencies`, и в `devDependencies` модуля (нужен для `tsc`).
Поэтому при симлинке код модуля резолвит `telegraf` в **свою** копию
(`admin-server/node_modules/telegraf`), а бот — в свою. В процессе оказывается два
экземпляра Telegraf.

**Это проверено и на текущем API модуля не ломает ничего:** `Stage.register()` и middleware
сцен в Telegraf утиные (по `scene.id` и `.middleware()`), без `instanceof`-проверок —
кастомные сцены админки нормально цепляются к `stage` бота. Цена — лишняя память, не корректность.

Если однажды словишь странности из-за дубля (обычно вокруг типов `ctx.scene` или
session-middleware) — убери копию из модуля и включи резолюцию «сквозь» симлинк:

```bash
rm -rf admin-server/node_modules/telegraf     # tsc в модуле после этого не соберётся
# бот уже запускается с NODE_OPTIONS=--preserve-symlinks -> подтянет telegraf бота
```

`NODE_OPTIONS=--preserve-symlinks` уже стоит в `start:dev` / `start:prod`. Сам по себе он
дубль не убирает (копия в `admin-server/node_modules/telegraf` всё равно ближе по дереву),
но он нужен, чтобы после удаления этой копии модуль нашёл `telegraf` бота, а не упал.
Не убирать.

---

## Разовая настройка

```bash
cd admin-server && yarn install
cd ../astro-bot  && yarn install     # подтянет добавленный concurrently
```

Затем создать симлинк `astro-bot/node_modules/telegraf-admin-for-bots -> admin-server`.

**Способ, который здесь применён (ручной симлинк).** `npm link` в боте не проходит: npm при
линковке реифицирует всё дерево и упирается в аутентификацию Nexus. Поэтому симлинк ставится
напрямую — это ровно то, что делает `npm link` под капотом, но без обращения к реестру:

```bash
cd astro-bot/node_modules
rm -rf telegraf-admin-for-bots
ln -s ../../admin-server telegraf-admin-for-bots
```

То же самое — через скрипт `yarn link:admin` (см. ниже).

Проверка:

```bash
ls -l astro-bot/node_modules/telegraf-admin-for-bots      # -> ../../admin-server
node --preserve-symlinks -e "console.log(Object.keys(require('telegraf-admin-for-bots')))"
```

---

## Ежедневный цикл

Один терминал из папки бота:

```bash
cd astro-bot
yarn dev
```

Скрипт `dev` через `concurrently` поднимает два процесса:

| процесс | команда | что делает |
|---|---|---|
| `admin` | `npm --prefix ../admin-server run dev:build` | `tsc --watch` → `admin-server/lib/cjs` |
| `bot`   | `yarn start:dev` | `nodemon` с `--preserve-symlinks` |

Правишь `.ts` в `admin-server/src` → tsc пересобирает `lib/cjs` → nodemon видит изменение
в симлинкнутой папке → бот перезапускается.

Либо вручную в двух терминалах: `yarn dev:admin` в одном, `yarn start:dev` в другом.

---

## Восстановление после `yarn install` в боте

Любой `yarn install` в боте затирает симлинк обратно на версию из реестра. Вернуть:

```bash
yarn link:admin      # rm -rf node_modules/telegraf-admin-for-bots && ln -s ../../admin-server ...
```

Полностью отвязаться и вернуться на пакет из Nexus:

```bash
yarn unlink:admin
```

---

## Скрипты

### `admin-server`

| скрипт | назначение |
|---|---|
| `yarn dev:build` | `tsup --watch` — watch-сборка `lib/` для локалки |
| `yarn dev` | `tsc --noEmit --watch` — только проверка типов |
| `yarn typecheck` | `tsc --noEmit` разово |
| `yarn build` | `tsup` — cjs + esm + d.ts (для публикации) |
| `yarn test` | `vitest run` |

### `astro-bot`

| скрипт | назначение |
|---|---|
| `yarn dev` | `concurrently`: watch-сборка модуля + `nodemon` бота |
| `yarn dev:admin` | только watch-сборка модуля (`npm --prefix ../admin-server run dev:build`) |
| `yarn link:admin` | поставить симлинк `node_modules/telegraf-admin-for-bots -> ../../admin-server` |
| `yarn unlink:admin` | снять симлинк, вернуть версию из реестра (`yarn install --force`) |
| `yarn start:dev` | `nodemon` с `--preserve-symlinks` (без сборки модуля) |

### `astro-bot/nodemon.json`

```json
{
  "watch": ["src", "node_modules/telegraf-admin-for-bots/lib"],
  "ignoreRoot": [".git"],
  "ext": "js,json",
  "delay": "400"
}
```

`ignoreRoot` переопределяет дефолтный список (в нём `node_modules`), иначе watch на `lib`
не сработает. `delay` даёт `tsc` дописать файлы до рестарта.

---

## Что НЕ трогаем

- В коммит `astro-bot/package.json` идёт `"telegraf-admin-for-bots": "0.0.7"` (реестр Nexus).
  Симлинк — только локально, вне `package.json`.
- Скрипт `add-admin` (`yarn add file:../admin-server --force`) оставлен как запасной вариант,
  но для DX не используется — он копирует, а не линкует.
