import type { Payment } from "../types";
import type { PaymentStore, PaymentStats } from "../stores";

export class PaymentService {
  constructor(private db: PaymentStore) {}

  async getStats(): Promise<PaymentStats> {
    return this.db.getPaymentsStats();
  }

  async getAllPayments(): Promise<Payment[]> {
    return this.db.getAllPayments();
  }
}
