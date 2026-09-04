import type {
  UserStore,
  SubscriptionStore,
  ReportStore,
  PromoStore,
  IdLike,
  UserStats,
} from "../stores";
import type { AdminUser, UserReport } from "../types";

/**
 * Пользовательский слой. Методы подписок/обращений/промокодов вызываются только
 * при включённых соответствующих фичах (гарантируется `validateStore`).
 *
 * `userId` передаётся в стор как есть (`IdLike`): из меню приходит нативный тип
 * `AdminUser.userId`, из HTTP/регэкспов — строка. Стор — реализация хоста, он же
 * порождает `AdminUser`, поэтому знает свой формат id и приводит при необходимости
 * (см. `createMemoryStore` — нормализует через `String()`).
 */
type UserServiceStore = UserStore &
  Partial<SubscriptionStore & ReportStore & PromoStore>;

export class UserService {
  constructor(private db: UserServiceStore) {}

  async search(query: string): Promise<AdminUser[]> {
    return this.db.findUsersByQuery(query || "");
  }

  async getById(userId: IdLike): Promise<AdminUser | null> {
    return this.db.findUserById(userId);
  }

  async getAll(): Promise<AdminUser[]> {
    return this.db.getUsers();
  }

  async extendSubscription(userId: IdLike, days: number): Promise<boolean> {
    return this.db.extendSubscription!(userId, Number(days));
  }

  async activatePromo(
    userId: IdLike,
    data: { days: number },
  ): Promise<boolean> {
    return this.db.activatePromoSubscription!(userId, {
      days: Number(data.days),
    });
  }

  async deleteSubscription(userId: IdLike): Promise<boolean> {
    return this.db.deleteSubscription!(userId);
  }

  async getReports(userId: IdLike): Promise<UserReport[]> {
    return this.db.getUserReports!(userId);
  }

  async addPromocode(userId: IdLike, promoCode: string): Promise<boolean> {
    return this.db.addPromoCodeToUser!(userId, promoCode);
  }

  async getStats(): Promise<UserStats> {
    return this.db.getUserStats();
  }
}
