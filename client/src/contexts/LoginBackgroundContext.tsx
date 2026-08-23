/** تفضيل مرئي محلي لشاشة القفل، منفصل عمداً عن بيانات العمل والنسخ الاحتياطية. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export const DEFAULT_LOGIN_BACKGROUND = "/assets/login-shipping-ledger.webp";

type StoredBackground = {
  id: "login-background";
  file: Blob;
};

type LoginBackgroundValue = {
  ready: boolean;
  backgroundUrl: string;
  hasCustomBackground: boolean;
  setCustomBackground: (file: File) => Promise<void>;
  restoreDefaultBackground: () => Promise<void>;
};

const DB_NAME = "smart-trader-ui-preferences";
const STORE_NAME = "preferences";
const STORAGE_KEY = "login-background";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const LoginBackgroundContext = createContext<LoginBackgroundValue | null>(null);

function openPreferenceDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readBackground() {
  const db = await openPreferenceDb();
  return new Promise<StoredBackground | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(STORAGE_KEY);
    request.onsuccess = () => { db.close(); resolve((request.result as StoredBackground | undefined) ?? null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function saveBackground(file: Blob) {
  const db = await openPreferenceDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ id: STORAGE_KEY, file } satisfies StoredBackground);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

async function clearBackground() {
  const db = await openPreferenceDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(STORAGE_KEY);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export function LoginBackgroundProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const replacePreview = useCallback((file: Blob | null) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const nextUrl = file ? URL.createObjectURL(file) : null;
    objectUrlRef.current = nextUrl;
    setCustomUrl(nextUrl);
  }, []);

  useEffect(() => {
    void readBackground()
      .then((saved) => replacePreview(saved?.file ?? null))
      .catch(() => replacePreview(null))
      .finally(() => setReady(true));
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, [replacePreview]);

  const setCustomBackground = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) throw new Error("invalid-type");
    if (file.size > MAX_IMAGE_BYTES) throw new Error("too-large");
    await saveBackground(file);
    replacePreview(file);
  }, [replacePreview]);

  const restoreDefaultBackground = useCallback(async () => {
    await clearBackground();
    replacePreview(null);
  }, [replacePreview]);

  const value = useMemo<LoginBackgroundValue>(() => ({
    ready,
    backgroundUrl: customUrl ?? DEFAULT_LOGIN_BACKGROUND,
    hasCustomBackground: customUrl !== null,
    setCustomBackground,
    restoreDefaultBackground,
  }), [customUrl, ready, restoreDefaultBackground, setCustomBackground]);

  return <LoginBackgroundContext.Provider value={value}>{children}</LoginBackgroundContext.Provider>;
}

export function useLoginBackground() {
  const context = useContext(LoginBackgroundContext);
  if (!context) throw new Error("useLoginBackground must be used inside LoginBackgroundProvider");
  return context;
}
