class PaymentService {
  constructor(db) {
    this.db = db;
  }

  async getStats() {
    return this.db.getPaymentsStats();
  }

  async getAllPayments() {
    return this.db.getAllPayments();
  }
}

module.exports = { PaymentService };
