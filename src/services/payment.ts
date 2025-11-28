import type { TypedDB, Payment } from "../types";

export class PaymentService {
  constructor(private db: TypedDB) {}

  async getStats(): Promise<{
    currentMonth: {
      totalAmount: number;
      totalIncomeAmount: number;
      count: number;
    };
    lastMonth: {
      totalAmount: number;
      totalIncomeAmount: number;
      count: number;
    };
  }> {
    return this.db.getPaymentsStats();
  }

  async getAllPayments(): Promise<Payment[]> {
    return this.db.getAllPayments();
  }
}
