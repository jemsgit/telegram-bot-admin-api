export class UserService {
  constructor(private db: any) {}

  async search(query: string): Promise<any[]> {
    return this.db.findUsersByQuery(query || "");
  }

  async getById(userId: string): Promise<any | null> {
    return this.db.findUserById(userId);
  }

  async getAll(): Promise<any[]> {
    return this.db.getUsers();
  }

  async extendSubscription(userId: string, days: number): Promise<boolean> {
    return this.db.extendSubscription(userId, Number(days));
  }

  async activatePromo(
    userId: string,
    data: { days: number }
  ): Promise<boolean> {
    return this.db.activatePromoSubscription(userId, {
      days: Number(data.days),
    });
  }

  async deleteSubscription(userId: string): Promise<boolean> {
    return this.db.deleteSubscription(userId);
  }

  async getReports(userId: string): Promise<any[]> {
    return this.db.getUserReports(userId);
  }

  async addPromocode(userId: string, promoCode: string): Promise<boolean> {
    return this.db.addPromoCodeToUser(userId, promoCode);
  }

  async getStats(): Promise<any> {
    return this.db.getUserStats();
  }
}
