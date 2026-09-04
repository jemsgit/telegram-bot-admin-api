import type { UserReport } from "../types";
import type { ReportStore } from "../stores";
import type { ReportsAdapter } from "../adapters";

export class ReportService {
  constructor(
    private db: ReportStore,
    private adapter?: ReportsAdapter,
  ) {}

  async getAll(): Promise<UserReport[]> {
    return this.db.getReports();
  }

  async getById(reportId: string): Promise<UserReport | null> {
    return this.db.getReportById(reportId);
  }

  async reply(report: UserReport, text: string): Promise<void> {
    if (!this.adapter) {
      throw new Error(
        "ReportService: не передан adapters.reports — фича обращений недоступна",
      );
    }
    await this.adapter.replyToUser(report.userId, text, report.message);
    await this.db.saveReportReply(report._id, "admin", text);
  }
}
