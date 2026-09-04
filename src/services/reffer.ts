import type { RefferalCount } from "../types";
import type { ReferralStore } from "../stores";

export class RefferService {
  constructor(private db: ReferralStore) {}

  async getAll(): Promise<RefferalCount[]> {
    return this.db.getRefferals();
  }

  async countByLink(link: string): Promise<RefferalCount | number> {
    return this.db.countRefferalsByRefLink(link);
  }
}
