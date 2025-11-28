import { NextFunction } from "express";
import { Telegraf } from "telegraf";
import { Broadcast } from "./models";
import { TypedDB } from "./db";

export type {
  Broadcast,
  Payment,
  Promo,
  UserReport,
  Subscription,
  User,
  RefferalCount,
} from "./models";

export interface CustomRoute {
  method: "get" | "post" | "put" | "delete";
  path: string;
  handler: (
    req: Express.Request,
    res: Express.Response,
    next: NextFunction,
    bot: Bot,
    db: TypedDB
  ) => Promise<void>;
}

export interface FeaturesConfig {
  broadcast?: boolean;
  subscriptions?: boolean;
  promocodes?: boolean;
  reports?: boolean;
  referral?: boolean;
  payments?: boolean;
}

export interface Bot {
  bot: Telegraf<any>;
  sendTestBroadcast: (b: Broadcast) => void;
  replyToUserReport: (userId: number, message: string, text: string) => void;
}

export type { TypedDB } from "./db";
