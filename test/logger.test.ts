import { describe, it, expect, vi, afterEach } from "vitest";

import { createConsoleLogger, setLogger, log } from "../src/logger";

afterEach(() => {
  // вернуть модульный логгер к дефолту, чтобы не течь между тестами
  setLogger(undefined, "info");
  vi.restoreAllMocks();
});

describe("logger", () => {
  it("createConsoleLogger уважает уровень", () => {
    const spyLog = vi.spyOn(console, "debug").mockImplementation(() => {});
    const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const l = createConsoleLogger("warn");
    l.debug("тихо");
    l.warn("громко");

    expect(spyLog).not.toHaveBeenCalled();
    expect(spyWarn).toHaveBeenCalledWith("[telegraf-admin-for-bots] громко");
  });

  it("silent глушит всё", () => {
    const spyErr = vi.spyOn(console, "error").mockImplementation(() => {});
    createConsoleLogger("silent").error("бум");
    expect(spyErr).not.toHaveBeenCalled();
  });

  it("setLogger подменяет активный логгер, прокси log это подхватывает", () => {
    const custom = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    setLogger(custom);
    log.warn("привет", { a: 1 });
    expect(custom.warn).toHaveBeenCalledWith("привет", { a: 1 });
  });
});
