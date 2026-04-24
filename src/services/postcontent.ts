import type { TypedDB, PostContentAd, PostContentAdView } from "../types";

export interface AdCreateBody {
  text: string;
  isActive?: boolean;
  showFor?: ("image" | "video" | "audio" | "text" | "any")[];
  maxViews?: number | null;
  priority?: number;
  perUserLimit?: number;
  startsAt?: string | null;
  endsAt?: string | null;
}

export type AdUpdateBody = Partial<
  Omit<PostContentAd, "_id" | "createdAt" | "updatedAt">
>;

export class PostContentService {
  constructor(private db: TypedDB) {}

  //
  // LIST
  //
  async list(filter?: Partial<PostContentAd>): Promise<PostContentAd[]> {
    return this.db.getAds(filter ?? {});
  }

  //
  // GET ONE
  //
  async get(id: string): Promise<PostContentAd | null> {
    return this.db.getAdById(id);
  }

  //
  // CREATE
  //
  async create(payload: AdCreateBody): Promise<PostContentAd> {
    const ad: Partial<PostContentAd> = {
      text: payload.text,
      isActive: payload.isActive ?? true,
      showFor: payload.showFor ?? ["any"],
      maxViews: payload.maxViews ?? null,
      priority: payload.priority ?? 1,
      perUserLimit: payload.perUserLimit ?? 1,
      startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
      endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.db.createAd(ad as PostContentAd);
  }

  //
  // UPDATE
  //
  async update(id: string, patch: AdUpdateBody): Promise<PostContentAd | null> {
    const ad = await this.get(id);
    if (!ad) return null;

    Object.assign(ad, patch, { updatedAt: new Date() });

    const updated = await this.db.updateAd(id, ad);
    return updated;
  }

  //
  // DELETE
  //
  async delete(id: string): Promise<boolean | null> {
    const ad = await this.get(id);
    if (!ad) return null;

    await this.db.deleteAd(id);
    return true;
  }

  //
  // RECORD USER VIEW
  //
  async addView(userId: string, adId: string): Promise<PostContentAdView> {
    return this.db.addAdViewToUser(userId, adId);
  }

  //
  // GET AD FOR USER
  //
  async pickForUser(
    userId: string,
    type: "image" | "video" | "audio" | "text" | "any"
  ) {
    return this.db.getAdForUser(userId, type);
  }
}
