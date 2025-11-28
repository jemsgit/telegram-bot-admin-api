class RefferService {
  constructor(db) {
    this.db = db;
  }

  async getAll() {
    return this.db.getRefferals();
  }

  async countByLink(link) {
    return this.db.countRefferalsByRefLink(link);
  }
}

module.exports = { RefferService };
