const { AdminServer } = require("./AdminServer");
const { createAdminServer } = require("./createAdminServer");
const { BroadcastService } = require("./services/broadcast");
const { PaymentService } = require("./services/payment");
const { PromocodeService } = require("./services/promocode");
const { RefferService } = require("./services/reffer");
const { ReportService } = require("./services/report");
const { SubscriptionService } = require("./services/subscriptions");
const { UserService } = require("./services/user");

module.exports = {
  AdminServer,
  createAdminServer,
  BroadcastService,
  PaymentService,
  PromocodeService,
  RefferService,
  ReportService,
  SubscriptionService,
  UserService,
};

// ESM support
export {
  AdminServer,
  createAdminServer,
  BroadcastService,
  PaymentService,
  PromocodeService,
  RefferService,
  ReportService,
  SubscriptionService,
  UserService,
};
