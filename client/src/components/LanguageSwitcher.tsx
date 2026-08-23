/** مبدّل اللغة — ختم لغوي واضح في أعلى الواجهة، يحافظ على اختيار المستخدم محلياً. */
import { Globe2, ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LANGUAGE_OPTIONS } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function LanguageSwitcher({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  const dark = tone === "dark";
  return <label className={cn("language-switcher group flex items-center gap-2 rounded-[0.45rem] border px-2.5 py-1.5 shadow-sm transition-colors", dark ? "border-white/25 bg-white/10 text-white hover:bg-white/16" : "border-[var(--port-green)]/35 bg-[var(--port-green-soft)] text-[var(--ink)] hover:bg-[var(--port-green-soft)]/75", className)}>
    <span className={cn("flex h-6 w-6 items-center justify-center rounded border", dark ? "border-white/20 bg-white/10" : "border-[var(--port-green)]/30 bg-card")}><Globe2 className="h-3.5 w-3.5" aria-hidden /></span>
    <span className="sr-only">{t("app.language")}</span>
    <select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)} className={cn("min-w-0 appearance-none bg-transparent pe-3 text-[11px] font-bold outline-none", dark ? "text-white" : "text-[var(--ink)]")} aria-label={t("app.language")}>
      {LANGUAGE_OPTIONS.map((option) => <option key={option.code} value={option.code} className="text-foreground">{option.native}</option>)}
    </select>
    <ChevronDown className="pointer-events-none -ms-4 h-3 w-3 opacity-70" aria-hidden />
  </label>;
}
