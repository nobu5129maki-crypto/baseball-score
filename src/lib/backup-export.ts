export type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

export type BackupDelivery = "shared" | "downloaded" | "cancelled";

export function isAbortError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "name" in err && (err as { name: string }).name === "AbortError";
}

export async function deliverBackupFile(
  file: File,
  options: {
    navigator?: ShareNavigator;
    download?: (next: File) => void;
    allowShare?: boolean;
    title?: string;
  } = {},
): Promise<BackupDelivery> {
  const nav = options.navigator ?? (typeof navigator === "undefined" ? {} : navigator);
  const download = options.download ?? downloadBackupFile;
  const allowShare = options.allowShare ?? prefersMobileShare();
  const shared = allowShare ? await tryShareBackup(file, nav, options.title) : "skipped";
  if (shared === "shared") return "shared";
  if (shared === "cancelled") return "cancelled";
  download(file);
  return "downloaded";
}

export function prefersMobileShare(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean {
  return /iPhone|iPad|iPod|Android/i.test(userAgent);
}

export function downloadBackupFile(file: File, doc: Document = document): void {
  const url = URL.createObjectURL(file);
  const a = doc.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  a.style.display = "none";
  doc.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function tryShareBackup(
  file: File,
  nav: ShareNavigator,
  title = "らくスコア バックアップ",
): Promise<"shared" | "skipped" | "cancelled"> {
  if (typeof nav.share !== "function") return "skipped";
  const data: ShareData = { files: [file], title };
  try {
    if (typeof nav.canShare === "function" && !nav.canShare(data)) return "skipped";
  } catch {
    return "skipped";
  }
  try {
    await nav.share(data);
    return "shared";
  } catch (err) {
    if (isAbortError(err)) return "cancelled";
    return "skipped";
  }
}
