import { randomUUID } from "node:crypto";

import type { Broadcast } from "../types";
import type { BroadcastStore } from "../stores";
import type { BroadcastAdapter } from "../adapters";

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
    private db: BroadcastStore,
    private adapter?: BroadcastAdapter,
  ) {}

  private get scheduler() {
    if (!this.adapter) {
      throw new Error(
        "BroadcastService: не передан adapters.broadcast — фича рассылок недоступна",
      );
    }
    return this.adapter.scheduler;
  }

  async list(status?: string | null): Promise<Broadcast[]> {
    return this.db.getAllBroadcasts(status ?? null);
  }

  async get(id: string): Promise<Broadcast | null> {
    return this.db.getBroadcast(id);
  }

  async create(payload: BroadcastCreateBody): Promise<Broadcast> {
    const id = randomUUID();

    const b: Broadcast = {
      id,
      title: payload.title || `Рассылка от ${new Date().toLocaleString("ru")}`,
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
    await this.scheduler.scheduleBroadcast(b);

    return b;
  }

  async sendTest(id: string): Promise<boolean | null> {
    const broadcast = await this.get(id);
    if (!broadcast) return null;
    if (!this.adapter) {
      throw new Error(
        "BroadcastService: не передан adapters.broadcast — фича рассылок недоступна",
      );
    }

    await this.adapter.sendTest(broadcast);
    return true;
  }

  async update(
    id: string,
    patch: Partial<Broadcast> & Record<string, unknown>,
  ): Promise<Broadcast | null> {
    const broadcast = await this.get(id);
    if (!broadcast) return null;

    const { id: _id, ...restPatch } = patch; // exclude id if present

    Object.assign(broadcast, restPatch, {
      updatedAt: new Date(),
    });

    const canEdit = await this.scheduler.rescheduleBroadcast(id, broadcast);
    if (!canEdit) throw new Error("cant modify");

    await this.db.saveBroadcast(broadcast);

    return broadcast;
  }

  async delete(id: string): Promise<boolean | null> {
    const broadcast = await this.get(id);
    if (!broadcast) return null;

    try {
      await this.scheduler.cancelBroadcast(id);
      // eslint-disable-next-line no-empty
    } catch {}

    await this.db.deleteBroadcast(id);
    return true;
  }
}
