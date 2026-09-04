import type { Promo } from "../types";
import type { PromoStore } from "../stores";

export class PromocodeService {
  constructor(private db: PromoStore) {}

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
