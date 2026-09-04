import type { Subscription } from "../types";
import type { SubscriptionStore } from "../stores";

export class SubscriptionService {
  constructor(private db: SubscriptionStore) {}

  async getAllSubscriptions(): Promise<Subscription[]> {
    return this.db.getAllSubscriptions();
  }
}
