import type { BotApp, TypedDB, UserReport } from "../types";

export class ReportService {
  constructor(
    private db: TypedDB,
    private bot: BotApp,
  ) {}

  async getAll(): Promise<UserReport[]> {
    return this.db.getReports();
  }

  async getById(reportId: string): Promise<UserReport | null> {
    return this.db.getReportById(reportId);
  }

  async reply(report: UserReport, text: string): Promise<void> {
    console.log("im here");
    await this.bot.replyToUserReport(report.userId, report.message, text);
    await this.db.saveReportReply(report._id, "admin", text);
  }
}
