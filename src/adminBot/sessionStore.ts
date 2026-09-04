/** Совместимо с telegraf SessionStore. */
export interface SessionStore<T = unknown> {
  get(key: string): T | undefined | Promise<T | undefined>;
  set(key: string, value: T): unknown | Promise<unknown>;
  delete(key: string): unknown | Promise<unknown>;
}

/** In-memory хранилище admin-сессии по умолчанию. Состояние не переживает рестарт. */
export class MemorySessionStore<T = unknown> implements SessionStore<T> {
  private map = new Map<string, T>();

  get(key: string): T | undefined {
    return this.map.get(key);
  }

  set(key: string, value: T): void {
    this.map.set(key, value);
  }

  delete(key: string): void {
    this.map.delete(key);
  }
}
