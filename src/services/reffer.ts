import type { TypedDB, RefferalCount } from "../types";

export class RefferService {
  constructor(private db: TypedDB) {}

  async getAll(): Promise<RefferalCount[]> {
    return this.db.getRefferals();
  }

  async countByLink(link: string): Promise<number> {
    return this.db.countRefferalsByRefLink(link);
  }
}
