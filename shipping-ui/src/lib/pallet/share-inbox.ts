const SHARE_DB = "astuto-share";
const SHARE_STORE = "inbox";

type StoredFile = { name: string; type: string; blob: Blob };
type StoredShare = { files?: StoredFile[] };

let inboxPromise: Promise<File[]> | null = null;

function openShareDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SHARE_STORE)) db.createObjectStore(SHARE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readInboxFiles(): Promise<File[]> {
  const db = await openShareDb();
  const stored = await new Promise<StoredShare | null>((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE, "readwrite");
    const store = tx.objectStore(SHARE_STORE);
    const get = store.get("latest");
    get.onsuccess = () => {
      store.delete("latest");
      resolve((get.result as StoredShare | undefined) ?? null);
    };
    get.onerror = () => reject(get.error);
  });
  db.close();
  return (stored?.files ?? []).map(
    (item) => new File([item.blob], item.name || "packing-slip.pdf", { type: item.type || "application/pdf" }),
  );
}

export function consumeSharedInbox(): Promise<File[]> {
  if (!inboxPromise) {
    inboxPromise = readInboxFiles().catch(() => []);
  }
  return inboxPromise;
}
