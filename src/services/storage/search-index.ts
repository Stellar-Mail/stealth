import { Email, deriveProof } from "@/components/mail/data";

/**
 * On-device local search index service for mail messages.
 * Uses IndexedDB for storage and WebCrypto (AES-256-GCM) with an ephemeral in-memory key
 * for encryption-at-rest. The key is generated at startup and never persisted.
 */

const DB_NAME = "StealthSearchIndexDB";
const STORE_NAME = "emails";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;
let ephemeralKey: CryptoKey | null = null;

// Memory cache for decrypted search index
interface SearchDoc {
  id: string;
  searchStr: string; // concatenated lowercase searchable text
  email: Email;
}
const indexDocs = new Map<string, SearchDoc>();

/**
 * Initialize IndexedDB and generate/verify ephemeral key
 */
async function initDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  // Generate ephemeral key if not exists
  if (!ephemeralKey) {
    ephemeralKey = await crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  return dbPromise;
}

/**
 * Encrypt a string using AES-GCM
 */
async function encryptText(text: string, key: CryptoKey): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
    },
    key,
    encoder.encode(text)
  );
  return { iv, ciphertext };
}

/**
 * Decrypt ciphertext using AES-GCM
 */
async function decryptText(ciphertext: ArrayBuffer, iv: Uint8Array, key: CryptoKey): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
    },
    key,
    ciphertext
  );
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Encrypts and persists an email object to IndexedDB
 */
async function saveToDB(email: Email, key: CryptoKey): Promise<void> {
  const db = await initDB();
  const serialized = JSON.stringify(email);
  const { iv, ciphertext } = await encryptText(serialized, key);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const request = store.put({
      id: email.id,
      iv,
      ciphertext,
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Removes an email from IndexedDB
 */
async function deleteFromDB(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Prepares searchable string for a message
 */
function buildSearchStr(email: Email): string {
  const parts = [
    email.from,
    email.email,
    email.subject,
    email.body,
    ...(email.labels || []),
    ...(email.attachments || []).map((a) => a.name),
    deriveProof(email),
  ];
  return parts.join(" ").toLowerCase();
}

/**
 * Indexes a single email in the in-memory search structures and persists it.
 */
export async function indexMessage(email: Email): Promise<void> {
  await initDB();
  if (!ephemeralKey) throw new Error("Security context uninitialized");

  // Update in-memory index cache
  indexDocs.set(email.id, {
    id: email.id,
    searchStr: buildSearchStr(email),
    email,
  });

  // Save to DB (encrypted)
  await saveToDB(email, ephemeralKey);
}

/**
 * Updates an email in the index.
 */
export async function updateIndex(email: Email): Promise<void> {
  await indexMessage(email);
}

/**
 * Removes a message completely from the index and database storage.
 */
export async function removeFromIndex(id: string): Promise<void> {
  await initDB();
  indexDocs.delete(id);
  await deleteFromDB(id);
}

/**
 * Rebuilds the search index with the provided list of emails.
 */
export async function reindexAll(emails: Email[]): Promise<void> {
  await initDB();
  if (!ephemeralKey) throw new Error("Security context uninitialized");

  // Clear current in-memory index
  indexDocs.clear();

  // Clear IndexedDB store
  const db = await initDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // Build new index and save
  for (const email of emails) {
    indexDocs.set(email.id, {
      id: email.id,
      searchStr: buildSearchStr(email),
      email,
    });
    await saveToDB(email, ephemeralKey);
  }
}

/**
 * Searches the local index. Supports multi-term space-separated prefix query matches.
 * Returns the matching emails within a latency target of < 150ms.
 */
export async function searchEmails(query: string): Promise<Email[]> {
  const start = performance.now();
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return Array.from(indexDocs.values()).map((d) => d.email);
  }

  const terms = cleanQuery.split(/\s+/);
  const results: Email[] = [];

  for (const doc of indexDocs.values()) {
    const matchesAll = terms.every((term) => doc.searchStr.includes(term));
    if (matchesAll) {
      results.push(doc.email);
    }
  }

  const duration = performance.now() - start;
  console.log(`[Search Index] Query "${query}" completed in ${duration.toFixed(2)}ms, found ${results.length} matches`);
  return results;
}

/**
 * Automatically loads and decrypts all records from IndexedDB into memory on initial load.
 * This populates the in-memory cache for fast querying.
 */
export async function loadIndexFromDB(): Promise<void> {
  const db = await initDB();
  if (!ephemeralKey) throw new Error("Security context uninitialized");

  const records: { id: string; iv: Uint8Array; ciphertext: ArrayBuffer }[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  indexDocs.clear();

  for (const record of records) {
    try {
      const decryptedStr = await decryptText(record.ciphertext, record.iv, ephemeralKey);
      const email = JSON.parse(decryptedStr) as Email;
      indexDocs.set(email.id, {
        id: email.id,
        searchStr: buildSearchStr(email),
        email,
      });
    } catch (err) {
      // If decryption fails (e.g. key changed between sessions), delete stale record
      console.warn(`[Search Index] Decryption failed for message ${record.id}, purging stale record.`);
      await deleteFromDB(record.id);
    }
  }
}
