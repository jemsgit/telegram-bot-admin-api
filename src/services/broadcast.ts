import type { TypedDB, Broadcast, Bot } from "../types";

const dayInMs = 24 * 60 * 60 * 1000;

export interface BroadcastCreateBody {
  title?: string;
  type: "text" | "photo" | "video";
  text?: string;
  mediaUrl?: string;
  scheduledAt?: string; // строка ISO или undefined
  excludePaid?: boolean;
  linkButtons?: Array<{ text: string; url: string }>;
}

export class BroadcastService {
  constructor(
    private db: TypedDB,
    private scheduleService: {
      scheduleBroadcast: (broadcast: Broadcast) => Promise<void>;
      rescheduleBroadcast: (
        id: string,
        broadcast: Broadcast
      ) => Promise<boolean>;
      cancelBroadcast: (id: string) => Promise<void>;
    },
    private bot: Bot
  ) {}

  async list(status?: string | null): Promise<Broadcast[]> {
    return this.db.getAllBroadcasts(status ?? null);
  }

  async get(id: string): Promise<Broadcast | null> {
    return this.db.getBroadcast(id);
  }

  async create(payload: BroadcastCreateBody): Promise<Broadcast> {
    const id = crypto.randomUUID();

    const b: Broadcast = {
      id,
      title: payload.title || `Broad${Math.random()}`,
      type: payload.type,
      text: payload.text || "",
      mediaUrl: payload.mediaUrl,
      scheduledAt: payload.scheduledAt
        ? new Date(payload.scheduledAt)
        : new Date(Date.now() + dayInMs),
      createdAt: new Date(),
      status: "pending",
      excludePaid: payload.excludePaid ?? false,
      sentUsers: [],
      linkButtons: payload.linkButtons ?? [],
    };

    await this.db.saveBroadcast(b);
    await this.scheduleService.scheduleBroadcast(b);

    return b;
  }

  async sendTest(id: string): Promise<boolean | null> {
    const broadcast = await this.get(id);
    if (!broadcast) return null;

    await this.bot.sendTestBroadcast(broadcast);
    return true;
  }

  async update(
    id: string,
    patch: Partial<Broadcast> & { id?: never }
  ): Promise<Broadcast | null> {
    const broadcast = await this.get(id);
    if (!broadcast) return null;

    const { id: _, ...restPatch } = patch; // exclude id if present

    Object.assign(broadcast, restPatch, {
      updatedAt: new Date(),
    });

    const canEdit = await this.scheduleService.rescheduleBroadcast(
      id,
      broadcast
    );
    if (!canEdit) throw new Error("cant modify");

    // Assuming broadcast has save method (Mongoose doc)
    await (broadcast as any).save();

    return broadcast;
  }

  async delete(id: string): Promise<boolean | null> {
    const broadcast = await this.get(id);
    if (!broadcast) return null;

    try {
      await this.scheduleService.cancelBroadcast(id);
    } catch {}

    await this.db.deleteBroadcast(id);
    return true;
  }
}
