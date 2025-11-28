class PromocodeService {
  constructor(db) {
    this.db = db;
  }

  async create(data) {
    return this.db.createPromoCode(data);
  }

  async delete(code) {
    return this.db.deletePromocode(code);
  }

  async getAll() {
    return this.db.getAllPromoCodes();
  }
}

module.exports = { PromocodeService };
