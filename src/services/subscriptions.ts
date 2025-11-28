import { Subscription, TypedDB } from "../types";

export class SubscriptionService {
  constructor(private db: TypedDB) {}

  async getAllSubscriptions(): Promise<Subscription[]> {
    return this.db.getAllSubscriptions();
  }
}
