import { describe, it, expect } from "vitest";
import * as api from "../src/index";

describe("public API surface", () => {
  it("exports the main entrypoints", () => {
    expect(typeof api.createAdmin).toBe("function");
    expect(typeof api.createMemoryStore).toBe("function");
    expect(typeof api.AdminServer).toBe("function");
    expect(typeof api.validateStore).toBe("function");
    expect(typeof api.HttpError).toBe("function");
  });

  it("exports every service class", () => {
    for (const name of [
      "UserService",
      "BroadcastService",
      "ReportService",
      "PromocodeService",
      "SubscriptionService",
      "RefferService",
      "PaymentService",
    ] as const) {
      expect(typeof api[name], name).toBe("function");
    }
  });
});
