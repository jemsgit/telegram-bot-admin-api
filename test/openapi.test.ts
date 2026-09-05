import { describe, it, expect } from "vitest";
import { DEFAULT_FEATURES } from "../src/config";
import { buildOpenApiDocument } from "../src/http/openapi";

describe("buildOpenApiDocument", () => {
  it("собирает все core-роуты при выключенных фичах", () => {
    const doc = buildOpenApiDocument({
      broadcast: false,
      subscriptions: false,
      promocodes: false,
      reports: false,
      referral: false,
      payments: false,
      postcontentAd: false,
    });
    expect(Object.keys(doc.paths).sort()).toEqual(
      ["/api/stats", "/api/users", "/api/users/all", "/api/users/{id}"].sort(),
    );
    expect(doc.paths["/api/users/{id}"].get.parameters).toEqual([
      { name: "id", in: "path", required: true, schema: { type: "string" } },
    ]);
  });

  it("выключенная фича не даёт своих путей", () => {
    const doc = buildOpenApiDocument({ ...DEFAULT_FEATURES, broadcast: false });
    expect(doc.paths["/api/broadcasts"]).toBeUndefined();
    // но promocodes включена по умолчанию — её пути есть
    expect(doc.paths["/api/promocodes"]).toBeDefined();
  });

  it("path-параметры конвертируются в {param}, множественные — тоже", () => {
    const doc = buildOpenApiDocument(DEFAULT_FEATURES);
    expect(doc.paths["/api/broadcasts/{id}/send-test"]).toBeDefined();
    expect(
      doc.paths["/api/broadcasts/{id}/send-test"].post.parameters,
    ).toEqual([{ name: "id", in: "path", required: true, schema: { type: "string" } }]);
  });

  it("bodySchema конвертируется в requestBody с joi->JSON Schema", () => {
    const doc = buildOpenApiDocument(DEFAULT_FEATURES);
    const op = doc.paths["/api/users/{id}/extend-subscription"].post;
    expect(op.requestBody).toEqual({
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: { days: { type: "integer", exclusiveMinimum: 0 } },
            required: ["days"],
          },
        },
      },
    });
  });

  it("роут без validate — без requestBody", () => {
    const doc = buildOpenApiDocument(DEFAULT_FEATURES);
    expect(doc.paths["/api/users"].get.requestBody).toBeUndefined();
  });

  it("successStatus попадает в ключ responses (201 для create-промокода)", () => {
    const doc = buildOpenApiDocument(DEFAULT_FEATURES);
    const op = doc.paths["/api/promocodes"].post;
    expect(op.responses["201"]).toBeDefined();
    expect(op.responses["200"]).toBeUndefined();
  });

  it("summary/tags проставлены", () => {
    const doc = buildOpenApiDocument(DEFAULT_FEATURES);
    const op = doc.paths["/api/users"].get;
    expect(op.summary).toBe("Поиск пользователей");
    expect(op.tags).toEqual(["users"]);
  });

  it("не выполняет хендлеры при сборке (DUMMY_SERVICES безопасен)", () => {
    // Если бы buildOpenApiDocument вызывал реальные хендлеры, обращение к
    // методам DUMMY_SERVICES бросило бы TypeError — сборка не должна падать.
    expect(() => buildOpenApiDocument(DEFAULT_FEATURES)).not.toThrow();
  });
});
