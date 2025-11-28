export type { TypedDB } from "./db";
export type {
  Broadcast,
  Payment,
  Promo,
  UserReport,
  Subscription,
  User,
} from "./models";

export interface CustomRoute {
  method: "get" | "post" | "put" | "delete";
  path: string;
  handler: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
    bot: Telegraf,
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
