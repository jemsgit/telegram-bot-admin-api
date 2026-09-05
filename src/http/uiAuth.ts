import crypto from "node:crypto";
import { Router } from "express";

/**
 * Логин standalone-UI (`http.ui`). Не путать с `/api/*`-авторизацией: сюда
 * фронт ходит БЕЗ токена, отдаёт логин/пароль (или один токен), получает в
 * ответ `http.token` для последующих запросов к `/api/*`. Смысл — не пускать
 * к API-токену по одному брутфорсимому полю: пара username+password + троттлинг
 * неудачных попыток.
 *
 * `/api/*` при этом не меняется — любой клиент (curl/скрипт/другой фронт)
 * по-прежнему ходит туда с `Authorization: Bearer <http.token>`.
 */

export interface UiAuthConfig {
  /** Токен к `/api/*`. Его же UI получает в ответ на успешный логин. */
  token: string;
  /**
   * Если задан — вход по паре username+password (сравниваются оба поля).
   * Иначе — по одному `token` (обратная совместимость).
   */
  auth?: { username: string; password: string };
}

export interface UiAuthThrottleOptions {
  /** Окно учёта неудачных попыток, мс. По умолчанию 15 мин. */
  windowMs?: number;
  /** Порог неудач с одного IP за окно. По умолчанию 5. */
  perIpMax?: number;
  /** Глобальный порог неудач за окно (бэкстоп за прокси, где IP один). По умолчанию 20. */
  globalMax?: number;
  /** Искусственная задержка ответа на неверный логин, мс. По умолчанию 400. */
  failDelayMs?: number;
}

const sha256 = (s: string): Buffer =>
  crypto.createHash("sha256").update(s, "utf8").digest();

/** Constant-time сравнение строк через их sha256 (длина не течёт). */
export function safeEqual(a: string, b: string): boolean {
  return crypto.timingSafeEqual(sha256(a), sha256(b));
}

interface Bucket {
  count: number;
  first: number;
}

/**
 * Router с `GET /config` (режим логина для фронта) и `POST /login`.
 * Монтируется в AdminServer под `/ui`, до `/api`-авторизации.
 */
export function createUiAuthRouter(
  cfg: UiAuthConfig,
  opts: UiAuthThrottleOptions = {},
): Router {
  const windowMs = opts.windowMs ?? 15 * 60_000;
  const perIpMax = opts.perIpMax ?? 5;
  const globalMax = opts.globalMax ?? 20;
  const failDelayMs = opts.failDelayMs ?? 400;

  const loginMode: "token" | "password" = cfg.auth ? "password" : "token";
  const perIp = new Map<string, Bucket>();
  let global: Bucket = { count: 0, first: Date.now() };

  const fresh = (b: Bucket): boolean => Date.now() - b.first < windowMs;

  /** Секунды до снятия блокировки, либо null если не заблокировано. */
  function lockedFor(ip: string): number | null {
    if (!fresh(global)) global = { count: 0, first: Date.now() };
    if (global.count >= globalMax) {
      return Math.ceil((global.first + windowMs - Date.now()) / 1000);
    }
    const b = perIp.get(ip);
    if (b && fresh(b) && b.count >= perIpMax) {
      return Math.ceil((b.first + windowMs - Date.now()) / 1000);
    }
    return null;
  }

  function recordFail(ip: string): void {
    if (!fresh(global)) global = { count: 0, first: Date.now() };
    global.count += 1;
    const b = perIp.get(ip);
    if (b && fresh(b)) b.count += 1;
    else perIp.set(ip, { count: 1, first: Date.now() });
    // Периодически чистим протухшие записи, чтобы Map не рос в проде.
    if (perIp.size > 512) {
      for (const [k, v] of perIp) if (!fresh(v)) perIp.delete(k);
    }
  }

  const router = Router();

  router.get("/config", (_req, res) => {
    res.json({ loginMode });
  });

  router.post("/login", async (req, res) => {
    const ip = req.ip ?? "unknown";

    const retryAfter = lockedFor(ip);
    if (retryAfter !== null) {
      res.setHeader("Retry-After", String(retryAfter));
      res
        .status(429)
        .json({ error: "слишком много попыток входа, попробуйте позже", retryAfter });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    let ok: boolean;
    if (cfg.auth) {
      const uOk =
        typeof body.username === "string" &&
        safeEqual(body.username, cfg.auth.username);
      const pOk =
        typeof body.password === "string" &&
        safeEqual(body.password, cfg.auth.password);
      ok = uOk && pOk;
    } else {
      ok = typeof body.token === "string" && safeEqual(body.token, cfg.token);
    }

    if (!ok) {
      recordFail(ip);
      await new Promise((r) => setTimeout(r, failDelayMs));
      res.status(401).json({ error: "неверные данные для входа" });
      return;
    }

    perIp.delete(ip);
    res.json({ token: cfg.token });
  });

  return router;
}
