/**
 * Лёгкий leveled-логгер без внешних зависимостей.
 *
 * По умолчанию пишет в `console` с префиксом `[telegraf-admin-for-bots]`.
 * Хост может подменить его своим (winston / pino / bunyan — любой объект с
 * методами `debug/info/warn/error`) через `AdminConfig.logger`, либо задать
 * только уровень встроенного через `AdminConfig.logLevel`.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface Logger {
  debug(message: string, ...meta: unknown[]): void;
  info(message: string, ...meta: unknown[]): void;
  warn(message: string, ...meta: unknown[]): void;
  error(message: string, ...meta: unknown[]): void;
}

const RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const PREFIX = "[telegraf-admin-for-bots]";

export function createConsoleLogger(level: LogLevel = "info"): Logger {
  const min = RANK[level] ?? RANK.info;
  const make =
    (lvl: Exclude<LogLevel, "silent">, sink: (...args: unknown[]) => void) =>
    (message: string, ...meta: unknown[]): void => {
      if (RANK[lvl] < min) return;
      sink(`${PREFIX} ${message}`, ...meta);
    };
  return {
    debug: make("debug", console.debug.bind(console)),
    info: make("info", console.info.bind(console)),
    warn: make("warn", console.warn.bind(console)),
    error: make("error", console.error.bind(console)),
  };
}

let active: Logger = createConsoleLogger("info");

/**
 * Устанавливает активный логгер модуля. Вызывается из `createAdmin`.
 * Синглтон на модуль: при нескольких `createAdmin` побеждает последний вызов.
 */
export function setLogger(logger?: Logger, level?: LogLevel): void {
  active = logger ?? createConsoleLogger(level ?? "info");
}

/**
 * Активный логгер. Это тонкий прокси — импортёры могут держать ссылку на `log`,
 * а `setLogger` всё равно подхватится.
 */
export const log: Logger = {
  debug: (m, ...a) => active.debug(m, ...a),
  info: (m, ...a) => active.info(m, ...a),
  warn: (m, ...a) => active.warn(m, ...a),
  error: (m, ...a) => active.error(m, ...a),
};
