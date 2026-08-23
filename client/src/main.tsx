import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// تسجيل عامل الخدمة لتمكين التثبيت والعمل دون اتصال — في الإنتاج فقط
// في بيئة التطوير يتعارض التخزين المؤقت مع تحديثات Vite الحية
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // تجاهل الفشل: التطبيق يبقى قابلاً للاستخدام عبر المتصفح
    });
  });
} else if ("serviceWorker" in navigator) {
  // إلغاء أي تسجيل سابق أثناء التطوير حتى لا تُقدَّم ملفات قديمة من الكاش
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const r of regs) void r.unregister();
  });
  if ("caches" in window) {
    void caches.keys().then((keys) => keys.forEach((k) => void caches.delete(k)));
  }
}
