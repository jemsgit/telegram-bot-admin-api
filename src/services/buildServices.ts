import type { AdminServices } from "../types";
import type {
  AdminStore,
  BroadcastStore,
  ReportStore,
  PromoStore,
  SubscriptionStore,
  ReferralStore,
  PaymentStore,
  PostContentStore,
} from "../stores";
import type { AdminAdapters } from "../adapters";

import { UserService } from "./user";
import { BroadcastService } from "./broadcast";
import { ReportService } from "./report";
import { PromocodeService } from "./promocode";
import { SubscriptionService } from "./subscriptions";
import { RefferService } from "./reffer";
import { PaymentService } from "./payment";
import { PostContentService } from "./postcontent";

export interface BuildServicesDeps {
  db: AdminStore;
  adapters?: AdminAdapters;
}

/**
 * Единая точка создания сервисов. Наличие методов стора для включённых фич
 * должно быть проверено раньше через `validateStore`; здесь сужаем тип.
 */
export function buildAdminServices({
  db,
  adapters,
}: BuildServicesDeps): AdminServices {
  return {
    userService: new UserService(db),
    broadcastService: new BroadcastService(
      db as BroadcastStore,
      adapters?.broadcast,
    ),
    reportService: new ReportService(db as ReportStore, adapters?.reports),
    promocodeService: new PromocodeService(db as PromoStore),
    subscriptionService: new SubscriptionService(db as SubscriptionStore),
    refferService: new RefferService(db as ReferralStore),
    paymentService: new PaymentService(db as PaymentStore),
    postContentService: new PostContentService(db as PostContentStore),
  };
}
