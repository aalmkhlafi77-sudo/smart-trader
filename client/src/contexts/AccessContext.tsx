import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type StoredPin = {
  version: 1;
  salt: string;
  hash: string;
  hint: string;
};

type AccessContextValue = {
  ready: boolean;
  configured: boolean;
  unlocked: boolean;
  hint: string;
  createPin: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  changePin: (currentPin: string, nextPin: string) => Promise<boolean>;
  lock: () => void;
};

const STORAGE_KEY = "smart-trader:access-pin-v1";
const AccessContext = createContext<AccessContextValue | null>(null);

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(window.atob(value), (char) => char.charCodeAt(0));
}

async function hashPin(pin: string, salt: string) {
  const material = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await window.crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: base64ToBytes(salt), iterations: 100_000, hash: "SHA-256" },
    material,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

function readStoredPin(): StoredPin | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "") as Partial<StoredPin>;
    if (parsed.version === 1 && typeof parsed.salt === "string" && typeof parsed.hash === "string" && typeof parsed.hint === "string") {
      return parsed as StoredPin;
    }
  } catch {
    // لا توجد بيانات قفل صالحة بعد.
  }
  return null;
}

export function AccessProvider({ children }: { children: ReactNode }) {
  const [credential, setCredential] = useState<StoredPin | null>(null);
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    setCredential(readStoredPin());
    setReady(true);
  }, []);

  const storePin = useCallback(async (pin: string) => {
    const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
    const salt = bytesToBase64(saltBytes);
    const next: StoredPin = { version: 1, salt, hash: await hashPin(pin, salt), hint: pin.slice(-2) };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setCredential(next);
    return next;
  }, []);

  const createPin = useCallback(async (pin: string) => {
    await storePin(pin);
    setUnlocked(true);
  }, [storePin]);

  const unlock = useCallback(async (pin: string) => {
    if (!credential) return false;
    const hash = await hashPin(pin, credential.salt);
    const matched = hash === credential.hash;
    if (matched) setUnlocked(true);
    return matched;
  }, [credential]);

  const changePin = useCallback(async (currentPin: string, nextPin: string) => {
    if (!credential) return false;
    const currentHash = await hashPin(currentPin, credential.salt);
    if (currentHash !== credential.hash) return false;
    await storePin(nextPin);
    return true;
  }, [credential, storePin]);

  const value = useMemo<AccessContextValue>(() => ({
    ready,
    configured: credential !== null,
    unlocked,
    hint: credential?.hint ?? "",
    createPin,
    unlock,
    changePin,
    lock: () => setUnlocked(false),
  }), [changePin, createPin, credential, ready, unlock, unlocked]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const context = useContext(AccessContext);
  if (!context) throw new Error("useAccess must be used inside AccessProvider");
  return context;
}
