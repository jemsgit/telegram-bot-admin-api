class SubscriptionService {
  constructor(db) {
    this.db = db;
  }

  async getAllSubscriptions() {
    return this.db.getAllSubscriptions();
  }
}

module.exports = { SubscriptionService };
