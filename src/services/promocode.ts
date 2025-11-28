import type { TypedDB, Promo } from "../types";

export class PromocodeService {
  constructor(private db: TypedDB) {}

  async create(data: Promo): Promise<Promo> {
    return this.db.createPromoCode(data);
  }

  async delete(code: string): Promise<boolean> {
    return this.db.deletePromocode(code);
  }

  async getAll(): Promise<Promo[]> {
    return this.db.getAllPromoCodes();
  }
}
