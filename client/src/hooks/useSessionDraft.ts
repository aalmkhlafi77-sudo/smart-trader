/**
 * حفظ مسودة محلية ضمن جلسة التطبيق.
 * تستمر المسودة أثناء التنقل وإعادة تحميل الصفحة، وتنتهي عند إغلاق الجلسة أو مسحها صراحةً.
 */

import { useCallback, useEffect, useState } from "react";

function readDraft<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && fallback && typeof fallback === "object" && !Array.isArray(fallback)) {
      return { ...fallback, ...parsed } as T;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function useSessionDraft<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readDraft(key, fallback));

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // لا نمنع عمل النموذج إذا كان المتصفح لا يتيح التخزين المؤقت.
    }
  }, [key, value]);

  const clear = useCallback(() => {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // no-op
    }
    setValue(fallback);
  }, [fallback, key]);

  return [value, setValue, clear] as const;
}

export function clearSessionDraft(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // no-op
  }
}
