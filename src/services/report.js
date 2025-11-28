class ReportService {
  constructor(db, bot) {
    this.db = db;
    this.bot = bot;
  }

  async getAll() {
    return this.db.getReports();
  }

  async getById(reportId) {
    return this.db.getReportById(reportId);
  }

  async reply(report, text) {
    await this.bot.replyToUserReport(report.userId, report.message, text);
    await this.db.saveReportReply(report._id, "admin", text);
  }
}

module.exports = { ReportService };
