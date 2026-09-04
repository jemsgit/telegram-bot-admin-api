import type { Broadcast } from "./types/models";

/** Планировщик рассылок хоста. Обязателен, если включена фича `broadcast`. */
export interface BroadcastScheduler {
  scheduleBroadcast(broadcast: Broadcast): Promise<void> | void;
  rescheduleBroadcast(
    id: string,
    broadcast: Broadcast,
  ): Promise<boolean> | boolean;
  cancelBroadcast(id: string): Promise<void> | void;
}

/** Адаптер фичи рассылок. */
export interface BroadcastAdapter {
  scheduler: BroadcastScheduler;
  /** Отправить тестовую рассылку администратору. */
  sendTest(broadcast: Broadcast): Promise<void> | void;
}

/** Адаптер фичи обращений. */
export interface ReportsAdapter {
  /**
   * Доставить ответ администратора пользователю.
   * @param userId      Telegram ID пользователя
   * @param replyText   текст ответа администратора
   * @param originalText исходный текст обращения (для контекста в сообщении)
   */
  replyToUser(
    userId: number,
    replyText: string,
    originalText: string,
  ): Promise<void> | void;
}

export interface AdminAdapters {
  broadcast?: BroadcastAdapter;
  reports?: ReportsAdapter;
}
