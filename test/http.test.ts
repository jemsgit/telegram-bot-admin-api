import { describe, it, expect, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import { Telegraf } from "telegraf";

import { createAdmin, type AdminHandle } from "../src/createAdmin";
import { makeFakeDb } from "./helpers/fakeDb";

let handle: AdminHandle | undefined;

afterEach(async () => {
  await handle?.stopHttp();
  handle = undefined;
});

function build(token?: string) {
  const bot = new Telegraf("12345:TEST");
  handle = createAdmin({
    bot,
    admins: [1],
    db: makeFakeDb({ getUserStats: async () => ({ total: 7 }) }),
    http: { enabled: true, port: 0, token },
  });
  return handle;
}

describe("createAdmin — HTTP API", () => {
  it("бросает, если http.enabled без token", () => {
    expect(() => build(undefined).startHttp()).toThrow(/token/);
  });

  it("401 без токена, 200 с токеном", async () => {
    const server = build("secret")!.startHttp()!;
    const { port } = server.address() as AddressInfo;

    const unauth = await fetch(`http://127.0.0.1:${port}/api/stats`);
    expect(unauth.status).toBe(401);

    const ok = await fetch(`http://127.0.0.1:${port}/api/stats`, {
      headers: { "x-api-key": "secret" },
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ total: 7 });
  });
});
