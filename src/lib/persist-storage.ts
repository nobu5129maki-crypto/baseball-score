/** 端末がサイトデータを掃除しても、試合記録をなるべく残す。 */
export async function requestDurableStorage(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  const storage = navigator.storage;
  if (!storage?.persist) return false;
  try {
    if (typeof storage.persisted === "function" && (await storage.persisted())) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
