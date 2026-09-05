import { describe, it, expect } from "vitest";
import {
  resolveRouteUiKind,
  resolveRouteUi,
  validateRouteUi,
  type CustomRouteWithUi,
} from "../src/ui-schema";

const noopHandler = () => {};

describe("resolveRouteUiKind", () => {
  it("GET без полей -> list", () => {
    expect(resolveRouteUiKind("get", undefined)).toBe("list");
    expect(resolveRouteUiKind("get", [])).toBe("list");
  });

  it("есть поля -> form, независимо от метода", () => {
    expect(
      resolveRouteUiKind("post", [{ name: "x", type: "text" }]),
    ).toBe("form");
    expect(resolveRouteUiKind("get", [{ name: "x", type: "text" }])).toBe(
      "form",
    );
  });

  it("не GET без полей -> action", () => {
    expect(resolveRouteUiKind("delete", undefined)).toBe("action");
    expect(resolveRouteUiKind("post", [])).toBe("action");
  });
});

describe("resolveRouteUi", () => {
  it("без ui -> undefined", () => {
    const route: CustomRouteWithUi = {
      method: "get",
      path: "/x",
      handler: noopHandler,
    };
    expect(resolveRouteUi(route)).toBeUndefined();
  });

  it("подставляет выведенный kind, если не задан явно", () => {
    const route: CustomRouteWithUi = {
      method: "get",
      path: "/x",
      handler: noopHandler,
      ui: { description: "d" },
    };
    expect(resolveRouteUi(route)).toEqual({ description: "d", kind: "list" });
  });

  it("не переопределяет явный kind", () => {
    const route: CustomRouteWithUi = {
      method: "get",
      path: "/x",
      handler: noopHandler,
      ui: { kind: "action", description: "d" },
    };
    expect(resolveRouteUi(route)?.kind).toBe("action");
  });
});

describe("validateRouteUi", () => {
  it("пропускает роуты без ui", () => {
    expect(() =>
      validateRouteUi([{ method: "get", path: "/x", handler: noopHandler }]),
    ).not.toThrow();
  });

  it("пропускает корректную схему", () => {
    const routes: CustomRouteWithUi[] = [
      {
        method: "post",
        path: "/x",
        handler: noopHandler,
        ui: {
          fields: [
            { name: "userId", type: "number", required: true },
            {
              name: "role",
              type: "select",
              options: [{ value: "admin", label: "Admin" }],
            },
            {
              name: "assignee",
              type: "lookup",
              lookup: { route: "/api/users" },
            },
          ],
        },
      },
    ];
    expect(() => validateRouteUi(routes)).not.toThrow();
  });

  it("падает на поле без name", () => {
    const routes: CustomRouteWithUi[] = [
      {
        method: "post",
        path: "/x",
        handler: noopHandler,
        // @ts-expect-error — намеренно битая схема
        ui: { fields: [{ type: "text" }] },
      },
    ];
    expect(() => validateRouteUi(routes)).toThrow(/без name/);
  });

  it("падает на дублирующемся имени поля", () => {
    const routes: CustomRouteWithUi[] = [
      {
        method: "post",
        path: "/x",
        handler: noopHandler,
        ui: {
          fields: [
            { name: "a", type: "text" },
            { name: "a", type: "number" },
          ],
        },
      },
    ];
    expect(() => validateRouteUi(routes)).toThrow(/повторяющееся имя/);
  });

  it("падает на неизвестном type", () => {
    const routes: CustomRouteWithUi[] = [
      {
        method: "post",
        path: "/x",
        handler: noopHandler,
        // @ts-expect-error — намеренно битая схема
        ui: { fields: [{ name: "a", type: "color-picker" }] },
      },
    ];
    expect(() => validateRouteUi(routes)).toThrow(/неизвестный type/);
  });

  it("падает на select без options", () => {
    const routes: CustomRouteWithUi[] = [
      {
        method: "post",
        path: "/x",
        handler: noopHandler,
        ui: { fields: [{ name: "a", type: "select" }] },
      },
    ];
    expect(() => validateRouteUi(routes)).toThrow(/без options/);
  });

  it("падает на lookup без lookup.route", () => {
    const routes: CustomRouteWithUi[] = [
      {
        method: "post",
        path: "/x",
        handler: noopHandler,
        ui: { fields: [{ name: "a", type: "lookup" }] },
      },
    ];
    expect(() => validateRouteUi(routes)).toThrow(/без lookup.route/);
  });

  it("собирает несколько проблем сразу, а не падает на первой", () => {
    const routes: CustomRouteWithUi[] = [
      {
        method: "post",
        path: "/x",
        handler: noopHandler,
        ui: {
          fields: [
            { name: "a", type: "select" },
            { name: "b", type: "lookup" },
          ],
        },
      },
    ];
    try {
      validateRouteUi(routes);
      expect.fail("должно было бросить");
    } catch (e) {
      const message = (e as Error).message;
      expect(message).toMatch(/select/);
      expect(message).toMatch(/lookup/);
    }
  });
});
