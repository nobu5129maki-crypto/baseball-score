import { afterEach, describe, expect, it, vi } from "vitest";
import { requestDurableStorage } from "./persist-storage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestDurableStorage", () => {
  it("すでに永続化されていれば true", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        persisted: vi.fn().mockResolvedValue(true),
        persist: vi.fn(),
      },
    });
    await expect(requestDurableStorage()).resolves.toBe(true);
  });

  it("未永続なら persist を頼む", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("navigator", {
      storage: {
        persisted: vi.fn().mockResolvedValue(false),
        persist,
      },
    });
    await expect(requestDurableStorage()).resolves.toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("API が無い端末では false", async () => {
    vi.stubGlobal("navigator", {});
    await expect(requestDurableStorage()).resolves.toBe(false);
  });
});
