const dayInMs = 24 * 60 * 60 * 1000;

class BroadcastService {
  constructor(db, scheduleService, bot) {
    this.db = db;
    this.scheduleService = scheduleService;
    this.bot = bot;
  }

  async list(status) {
    return this.db.getAllBroadcasts(status || null);
  }

  async get(id) {
    return this.db.getBroadcast(id);
  }

  async create(payload) {
    const id = crypto.randomUUID();

    const b = {
      id,
      title: payload.title || `Broad${Math.random()}`,
      type: payload.type,
      text: payload.text,
      mediaUrl: payload.mediaUrl,
      scheduledAt: payload.scheduledAt
        ? new Date(payload.scheduledAt)
        : new Date(Date.now() + dayInMs),
      createdAt: new Date().toISOString(),
      status: "pending",
      excludePaid: payload.excludePaid,
      linkButtons: payload.linkButtons,
    };

    await this.db.saveBroadcast(b);
    await this.scheduleService.scheduleBroadcast(b);

    return b;
  }

  async sendTest(id) {
    const broadcast = await this.get(id);
    if (!broadcast) return null;

    await this.bot.sendTestBroadcast(broadcast);
    return true;
  }

  async update(id, patch) {
    const broadcast = await this.get(id);
    if (!broadcast) return null;

    const { id: _, ...restPatch } = patch;

    // применяем патч
    Object.assign(broadcast, restPatch, {
      updatedAt: new Date(),
    });

    const canEdit = await this.scheduleService.rescheduleBroadcast(
      id,
      broadcast
    );
    if (!canEdit) throw new Error("cant modify");

    await broadcast.save();
    return broadcast;
  }

  async delete(id) {
    const broadcast = await this.get(id);
    if (!broadcast) return null;

    try {
      await this.scheduleService.cancelBroadcast(id);
    } catch {}

    await this.db.deleteBroadcast(id);
    return true;
  }
}

module.exports = { BroadcastService };
