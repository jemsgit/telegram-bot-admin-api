class UserService {
  constructor(db) {
    this.db = db;
  }

  async search(query) {
    return this.db.findUsersByQuery(query || "");
  }

  async getById(userId) {
    return this.db.findUserById(userId);
  }

  async getAll() {
    return this.db.getUsers();
  }

  async extendSubscription(userId, days) {
    return this.db.extendSubscription(userId, Number(days));
  }

  async activatePromo(userId, { days }) {
    return this.db.activatePromoSubscription(userId, { days: Number(days) });
  }

  async deleteSubscription(userId) {
    return this.db.deleteSubscription(userId);
  }

  async getReports(userId) {
    return this.db.getUserReports(userId);
  }

  async addPromocode(userId, promoCode) {
    return this.db.addPromoCodeToUser(userId, promoCode);
  }

  async getStats() {
    return this.db.getUserStats();
  }
}

module.exports = { UserService };
