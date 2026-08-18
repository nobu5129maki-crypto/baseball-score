import { describe, expect, it, vi } from "vitest";
import { deliverBackupFile, prefersMobileShare } from "./backup-export";

function backupFile(): File {
  return new File(['{"kind":"rakuscore-backup"}\n'], "らくスコア-バックアップ-2026-08-15.json", {
    type: "application/json",
  });
}

describe("deliverBackupFile", () => {
  it("パソコンでは共有せずダウンロードする", async () => {
    const download = vi.fn();
    const share = vi.fn(async () => undefined);
    const result = await deliverBackupFile(backupFile(), {
      navigator: { share, canShare: () => true },
      download,
      allowShare: false,
    });
    expect(result).toBe("downloaded");
    expect(share).not.toHaveBeenCalled();
    expect(download).toHaveBeenCalledOnce();
  });

  it("共有できないときはダウンロードする", async () => {
    const download = vi.fn();
    const result = await deliverBackupFile(backupFile(), { navigator: {}, download, allowShare: true });
    expect(result).toBe("downloaded");
    expect(download).toHaveBeenCalledOnce();
  });

  it("canShareがfalseならダウンロードする", async () => {
    const download = vi.fn();
    const result = await deliverBackupFile(backupFile(), {
      navigator: {
        share: vi.fn(),
        canShare: () => false,
      },
      download,
      allowShare: true,
    });
    expect(result).toBe("downloaded");
    expect(download).toHaveBeenCalledOnce();
  });

  it("canShareが例外でもダウンロードする", async () => {
    const download = vi.fn();
    const result = await deliverBackupFile(backupFile(), {
      navigator: {
        share: vi.fn(),
        canShare: () => {
          throw new TypeError("cannot share json");
        },
      },
      download,
      allowShare: true,
    });
    expect(result).toBe("downloaded");
    expect(download).toHaveBeenCalledOnce();
  });

  it("共有できたときはダウンロードしない", async () => {
    const download = vi.fn();
    const share = vi.fn(async () => undefined);
    const result = await deliverBackupFile(backupFile(), {
      navigator: {
        share,
        canShare: () => true,
      },
      download,
      allowShare: true,
    });
    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledOnce();
    expect(download).not.toHaveBeenCalled();
  });

  it("共有をやめたときはダウンロードしない", async () => {
    const download = vi.fn();
    const err = new DOMException("Share canceled", "AbortError");
    const result = await deliverBackupFile(backupFile(), {
      navigator: {
        share: async () => {
          throw err;
        },
        canShare: () => true,
      },
      download,
      allowShare: true,
    });
    expect(result).toBe("cancelled");
    expect(download).not.toHaveBeenCalled();
  });

  it("共有がNotAllowedErrorでもダウンロードする", async () => {
    const download = vi.fn();
    const err = new DOMException("Must be handling a user gesture", "NotAllowedError");
    const result = await deliverBackupFile(backupFile(), {
      navigator: {
        share: async () => {
          throw err;
        },
        canShare: () => true,
      },
      download,
      allowShare: true,
    });
    expect(result).toBe("downloaded");
    expect(download).toHaveBeenCalledOnce();
  });
});

describe("prefersMobileShare", () => {
  it("スマホだけ共有シートを使う", () => {
    expect(prefersMobileShare("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe(true);
    expect(prefersMobileShare("Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0")).toBe(true);
    expect(prefersMobileShare("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0")).toBe(false);
  });
});
