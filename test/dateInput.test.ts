import { describe, it, expect } from "vitest";

import {
  parseDate,
  parseDateTime,
  isValidUrl,
} from "../src/adminBot/dateInput";

describe("parseDate", () => {
  it("разбирает ДД.ММ.ГГГГ", () => {
    const d = parseDate("01.12.2025");
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(1);
  });

  it("бросает на мусоре и на несуществующей дате", () => {
    expect(() => parseDate("не дата")).toThrow();
    expect(() => parseDate("31.02.2025")).toThrow();
    expect(() => parseDate("2025-12-01")).toThrow();
  });
});

describe("parseDateTime", () => {
  it("разбирает ДД.ММ.ГГГГ ЧЧ:ММ", () => {
    const d = parseDateTime("25.12.2025 15:30");
    expect(d.getMonth()).toBe(11);
    expect(d.getHours()).toBe(15);
    expect(d.getMinutes()).toBe(30);
  });

  it("бросает без времени и на кривом времени", () => {
    expect(() => parseDateTime("25.12.2025")).toThrow();
    expect(() => parseDateTime("25.12.2025 25:00")).toThrow();
  });
});

describe("isValidUrl", () => {
  it("да/нет", () => {
    expect(isValidUrl("https://example.com/x")).toBe(true);
    expect(isValidUrl("Перейти|https://example.com")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});
