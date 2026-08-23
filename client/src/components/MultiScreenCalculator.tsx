/**
 * أسلوب الواجهة: لوحة عمليات ملاحية زجاجية داكنة، أزرار معدنية مضيئة،
 * وألوان مستقلة للشاشات مع إبقاء منطق الحاسبة والسجل المحلي كما هو.
 */
import { useEffect, useMemo, useState } from "react";
import { Calculator, ClipboardPaste, Copy, Delete, History, Sigma } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type ScreenTone = "blue" | "green" | "amber" | "purple";
type CalcScreen = { id: string; key: "a" | "b" | "c" | "d"; tone: ScreenTone; enabled: boolean; expression: string; result: string; justEvaluated?: boolean };
type HistoryEntry = { id: string; screenId: string; expression: string; result: string; createdAt: number };
type MultiScreenCalculatorProps = { keyboardEnabled?: boolean; onEscape?: () => void; onResultChange?: (result: string) => void };

const STORAGE_KEY = "smart-trader:multi-screen-calculator:v1";
const HISTORY_KEY = "smart-trader:multi-screen-calculator-history:v1";
const SCREEN_TONES: Record<ScreenTone, string> = {
  blue: "border-sky-400/35 bg-sky-50/55",
  green: "border-[var(--port-green)]/35 bg-[var(--port-green-soft)]/65",
  amber: "border-[var(--amber-line)] bg-[var(--amber-field)]/70",
  purple: "border-violet-300/60 bg-violet-50/65",
};
const DOT_TONES: Record<ScreenTone, string> = { blue: "bg-sky-500", green: "bg-[var(--port-green)]", amber: "bg-[var(--amber)]", purple: "bg-violet-500" };
const KEYPAD = [
  { label: "C", kind: "clear" }, { label: "⌫", kind: "backspace" }, { label: "%", kind: "percent" }, { label: "÷", kind: "input" },
  { label: "7", kind: "input" }, { label: "8", kind: "input" }, { label: "9", kind: "input" }, { label: "×", kind: "input" },
  { label: "4", kind: "input" }, { label: "5", kind: "input" }, { label: "6", kind: "input" }, { label: "−", kind: "input" },
  { label: "1", kind: "input" }, { label: "2", kind: "input" }, { label: "3", kind: "input" }, { label: "+", kind: "input" },
  { label: "(", kind: "input" }, { label: "0", kind: "input" }, { label: ".", kind: "input" }, { label: ")", kind: "input" },
  { label: "copy", kind: "copy" }, { label: "paste", kind: "paste" }, { label: "new", kind: "new" }, { label: "=", kind: "equals" },
] as const;

function createScreens(): CalcScreen[] {
  return [
    { id: "screen-a", key: "a", tone: "blue", enabled: true, expression: "", result: "0" },
    { id: "screen-b", key: "b", tone: "green", enabled: true, expression: "", result: "0" },
    { id: "screen-c", key: "c", tone: "amber", enabled: true, expression: "", result: "0" },
    { id: "screen-d", key: "d", tone: "purple", enabled: true, expression: "", result: "0" },
  ];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeExpression(value: string) {
  return value.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/,/g, ".").trim();
}

function readableExpression(value: string) {
  return value.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−");
}

function calculateExpression(expression: string) {
  const normalized = normalizeExpression(expression).replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");
  if (!normalized || normalized.length > 100 || !/^[0-9+\-*/().%\s]+$/.test(normalized)) throw new Error("invalid");
  // مدخلات المستخدم محددة بأرقام وعلامات عمليات فقط قبل التقييم.
  const value = Function(`"use strict"; return (${normalized})`)();
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("invalid");
  return Number(value.toFixed(8));
}

function formatResult(value: string | number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(numeric);
}

export default function MultiScreenCalculator({ keyboardEnabled = true, onEscape, onResultChange }: MultiScreenCalculatorProps) {
  const { t } = useLanguage();
  const [screens, setScreens] = useState<CalcScreen[]>(() => {
    const stored = readJson<CalcScreen[]>(STORAGE_KEY, []);
    return createScreens().map((screen) => {
      const saved = stored.find((candidate) => candidate.id === screen.id);
      const savedTone = (saved as { tone?: string } | undefined)?.tone;
      const tone: ScreenTone = savedTone === "red" ? "purple" : savedTone === "blue" || savedTone === "green" || savedTone === "amber" || savedTone === "purple" ? savedTone : screen.tone;
      return { ...screen, ...saved, tone };
    });
  });
  const [history, setHistory] = useState<HistoryEntry[]>(() => readJson(HISTORY_KEY, []));
  const [activeId, setActiveId] = useState("screen-a");
  const [transitionToken, setTransitionToken] = useState(0);
  const [localClipboard, setLocalClipboard] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(screens)), [screens]);
  useEffect(() => window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 24))), [history]);

  const active = screens.find((screen) => screen.id === activeId) ?? screens.find((screen) => screen.enabled) ?? screens[0];
  const enabledResults = useMemo(
    () => screens.filter((screen) => screen.enabled).map((screen) => Number(screen.result)).filter(Number.isFinite),
    [screens],
  );
  const total = enabledResults.reduce((sum, value) => sum + value, 0);
  const average = enabledResults.length ? total / enabledResults.length : 0;

  const updateScreen = (id: string, patch: Partial<CalcScreen>) => {
    setScreens((current) => current.map((screen) => (screen.id === id ? { ...screen, ...patch } : screen)));
  };

  const activateScreen = (id: string) => {
    if (id !== activeId) {
      setActiveId(id);
      setTransitionToken((current) => current + 1);
    }
  };

  const setEnabled = (id: string, enabled: boolean) => {
    if (!enabled && screens.filter((screen) => screen.enabled).length === 1) {
      toast.info(t("multiCalc.keepOne"));
      return;
    }
    updateScreen(id, { enabled });
    if (!enabled && activeId === id) setActiveId(screens.find((screen) => screen.id !== id && screen.enabled)?.id ?? "screen-a");
  };

  const addKey = (key: string) => {
    if (!active?.enabled) return;
    const value = key === "×" ? "*" : key === "÷" ? "/" : key === "−" ? "-" : key;
    const startsNewOperation = Boolean(active.justEvaluated) && /[0-9.(]/.test(value);
    const continuesResult = Boolean(active.justEvaluated) && /^[+\-*/]$/.test(value);
    const expression = startsNewOperation ? value : continuesResult ? `${active.result}${value}` : `${active.expression}${value}`.slice(0, 100);
    updateScreen(active.id, { expression, justEvaluated: false });
  };

  const clearActive = () => active && updateScreen(active.id, { expression: "", result: "0", justEvaluated: false });
  const clearAll = () => {
    setScreens(createScreens());
    setHistory([]);
    setSelectedIds([]);
    setLocalClipboard("");
    setActiveId("screen-a");
    toast.success(t("multiCalc.clearedAll"));
  };
  const clearSelected = () => {
    if (!selectedIds.length) {
      toast.info(t("multiCalc.selectAtLeast"));
      return;
    }
    setScreens((current) => current.map((screen) => selectedIds.includes(screen.id) ? { ...screen, expression: "", result: "0", justEvaluated: false } : screen));
    setHistory((current) => current.filter((entry) => !selectedIds.includes(entry.screenId)));
    setSelectedIds([]);
    toast.success(t("multiCalc.clearedSelected"));
  };
  const newOperation = clearAll;
  const backspace = () => active && updateScreen(active.id, { expression: active.expression.slice(0, -1) });
  const applyPercent = () => {
    if (!active?.enabled) return;
    const source = active.expression || (active.justEvaluated ? active.result : "");
    if (!source || /%\s*$/.test(source)) return;
    updateScreen(active.id, { expression: `${source}%`, justEvaluated: false });
  };
  const handleKeypadAction = (key: (typeof KEYPAD)[number]) => {
    if (key.kind === "clear") return clearActive();
    if (key.kind === "backspace") return backspace();
    if (key.kind === "percent") return applyPercent();
    if (key.kind === "copy") return void copyValue(active?.result ?? "0");
    if (key.kind === "paste") return void pasteValue();
    if (key.kind === "new") return newOperation();
    if (key.kind === "equals") return evaluate();
    addKey(key.label);
  };
  const keypadLabel = (key: (typeof KEYPAD)[number]) => {
    if (key.kind === "copy") return t("multiCalc.copy");
    if (key.kind === "paste") return t("multiCalc.paste");
    if (key.kind === "new") return t("multiCalc.newOperation");
    return key.label;
  };
  const toggleSelected = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const evaluate = () => {
    if (!active?.enabled || !active.expression.trim()) return;
    try {
      const value = calculateExpression(active.expression);
      const result = String(value);
      updateScreen(active.id, { expression: "", result, justEvaluated: true });
      onResultChange?.(result);
      setHistory((current) => [{ id: `${Date.now()}-${active.id}`, screenId: active.id, expression: readableExpression(active.expression), result, createdAt: Date.now() }, ...current].slice(0, 24));
    } catch {
      toast.error(t("multiCalc.invalid"));
    }
  };

  const copyValue = async (value: string) => {
    setLocalClipboard(value);
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("multiCalc.copied"));
    } catch {
      toast.success(t("multiCalc.copiedLocal"));
    }
  };

  const pasteValue = async (preferSystemClipboard = false) => {
    if (!active?.enabled) return;
    // تُفضّل الحافظة الداخلية حتى ينتقل الناتج فوراً بين الشاشات، حتى لو حجبت
    // المتصفح قراءة الحافظة الخارجية بسبب التركيز أو صلاحيات الجهاز.
    let value = preferSystemClipboard ? "" : localClipboard.trim();
    if (!value) {
      try {
        value = (await navigator.clipboard.readText()).trim();
      } catch {
        value = localClipboard.trim();
      }
    }
    if (!value) {
      toast.info(t("multiCalc.emptyClipboard"));
      return;
    }
    const normalized = normalizeExpression(value);
    if (!/^[0-9+\-*/().%\s]+$/.test(normalized) || normalized.length > 100) {
      toast.error(t("multiCalc.pasteNumber"));
      return;
    }
    updateScreen(active.id, { expression: `${active.justEvaluated ? "" : active.expression}${normalized}`.slice(0, 100), justEvaluated: false });
    toast.success(t("multiCalc.pasted"));
  };

  useEffect(() => {
    if (!keyboardEnabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable || event.altKey) return;
      if (event.ctrlKey || event.metaKey) {
        const isCopy = event.code === "KeyC" || event.key.toLowerCase() === "c";
        const isPaste = event.code === "KeyV" || event.key.toLowerCase() === "v";
        if (isCopy) {
          event.preventDefault();
          void copyValue(active?.result ?? "0");
          return;
        }
        if (isPaste) {
          event.preventDefault();
          void pasteValue(true);
        }
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        const enabledScreens = screens.filter((screen) => screen.enabled);
        if (!enabledScreens.length) return;
        const currentIndex = Math.max(0, enabledScreens.findIndex((screen) => screen.id === activeId));
        const step = event.shiftKey ? -1 : 1;
        activateScreen(enabledScreens[(currentIndex + step + enabledScreens.length) % enabledScreens.length].id);
        return;
      }
      if (/^\d$/.test(event.key) || [".", "+", "-", "*", "/", "(", ")", "%"].includes(event.key)) {
        event.preventDefault();
        if (event.key === "%") applyPercent();
        else addKey(event.key === "*" ? "×" : event.key === "/" ? "÷" : event.key === "-" ? "−" : event.key);
        return;
      }
      if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        evaluate();
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape?.();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [keyboardEnabled, active, activeId, onEscape, localClipboard, screens]);

  return (
    <section className="multi-calc-shell">
      <header className="multi-calc-header">
        <div className="multi-calc-header-icon"><Calculator className="h-6 w-6" /></div>
        <div className="min-w-0">
          <p className="font-display text-lg font-black sm:text-xl">{t("multiCalc.title")}</p>
          <p className="mt-0.5 text-[11px] text-cyan-50/75 sm:text-xs">{t("multiCalc.hint")}</p>
          <p className="mt-1 text-[10px] tracking-wide text-cyan-100/55" dir="ltr">{t("multiCalc.shortcuts")}</p>
        </div>
        <div className="ms-auto flex shrink-0 gap-2 text-[10px] font-bold">
          <span className="multi-calc-header-chip">{t("multiCalc.local")}</span>
          <span className="multi-calc-header-chip" dir="ltr">{screens.filter((screen) => screen.enabled).length} / 4</span>
        </div>
      </header>

      <div className="multi-calc-body">
        <main className="multi-calc-workbench">
          <div className="multi-calc-active-bar">
            <div>
              <p className="text-xs font-bold text-cyan-50/80">{t("multiCalc.active")} <span className="multi-calc-active-badge" aria-live="polite">{active ? t(`multiCalc.screen${active.key.toUpperCase()}`) : "—"}</span></p>
              <p className="mt-1 min-h-4 truncate font-mono text-[11px] text-cyan-100/55" dir="ltr">{active ? readableExpression(active.expression) || "0" : "0"}</p>
            </div>
            <span className="multi-calc-status-dot" aria-hidden />
          </div>

          <div className="multi-calc-screen-tabs" aria-label={t("multiCalc.active")}>
            {screens.map((screen, index) => <Button key={screen.id} type="button" variant="outline" onClick={() => screen.enabled && activateScreen(screen.id)} disabled={!screen.enabled} aria-pressed={active?.id === screen.id} className={cn("multi-calc-tab", `tone-${screen.tone}`, active?.id === screen.id && "is-active")}>{index + 1}</Button>)}
          </div>

          <div key={`${active?.id ?? "none"}-${transitionToken}`} className="multi-calc-display calculator-screen-switch">
            <p className="text-[10px] font-bold tracking-[0.16em] text-cyan-100/55">{t("multiCalc.active")}</p>
            <p className="multi-calc-expression" dir="ltr">{active?.expression ? readableExpression(active.expression) : active ? formatResult(active.result) : "0"}</p>
          </div>

          <div className="multi-calc-keypad" dir="ltr">
            {KEYPAD.map((key) => {
              const operation = ["÷", "×", "−", "+"].includes(key.label);
              const utility = ["backspace", "percent", "copy", "paste", "new"].includes(key.kind);
              return <Button key={`${key.label}-${key.kind}`} type="button" variant="outline" title={keypadLabel(key)} aria-label={keypadLabel(key)} disabled={!active?.enabled && key.kind !== "new"} onClick={() => handleKeypadAction(key)} className={cn("multi-calc-key", operation && "calc-key-operation", key.label === "×" && "calc-key-multiply", key.label === "+" && "calc-key-add", key.kind === "clear" && "calc-key-clear", key.kind === "equals" && "calc-key-equals", key.kind === "percent" && "calc-key-percent", utility && "calc-key-utility")}>{key.kind === "new" ? <><Calculator className="h-4 w-4 sm:hidden" /><span className="hidden sm:inline">{keypadLabel(key)}</span></> : key.kind === "paste" ? <span className="inline-flex items-center justify-center gap-1"><ClipboardPaste className="hidden h-3.5 w-3.5 sm:block" />{keypadLabel(key)}</span> : keypadLabel(key)}</Button>;
            })}
          </div>
        </main>

        <aside className="multi-calc-side">
          <div className="multi-calc-side-header">
            <div className="flex items-center gap-2"><History className="h-5 w-5 text-cyan-300" /><p className="font-display text-base font-black">{t("multiCalc.history")}</p></div>
            <span className="multi-calc-counter">{selectedIds.length} {t("multiCalc.selected")}</span>
          </div>
          <div className="multi-calc-history-actions">
            <Button type="button" variant="outline" size="sm" onClick={clearSelected} disabled={!selectedIds.length}>{t("multiCalc.clearSelected")}</Button>
            <Button type="button" variant="outline" size="sm" onClick={clearAll}>{t("multiCalc.clearAll")}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setHistory([])} disabled={!history.length}>{t("multiCalc.clearHistory")}</Button>
          </div>

          <div className="space-y-2.5">
            {screens.map((screen, index) => {
              const selected = active?.id === screen.id;
              return <article key={screen.id} className={cn("multi-calc-screen-card", `tone-${screen.tone}`, screen.enabled ? "is-enabled" : "is-disabled", selected && "is-active")}>
                <div className="flex items-center justify-between gap-2">
                  <button type="button" className="multi-calc-screen-activate" onClick={() => screen.enabled && activateScreen(screen.id)} aria-pressed={selected}>
                    <span className="flex items-center gap-2"><span className={cn("multi-calc-screen-dot", DOT_TONES[screen.tone], selected && "animate-pulse")} /><span className="font-bold">{t(`multiCalc.screen${screen.key.toUpperCase()}`)}</span>{selected && <span className="multi-calc-active-badge">{t("multiCalc.activeBadge")}</span>}</span>
                  </button>
                  <div className="flex items-center gap-2 text-[10px] text-cyan-50/75"><Switch className="multi-calc-enable-switch" checked={screen.enabled} onCheckedChange={(checked) => setEnabled(screen.id, checked)} aria-label={`${t("multiCalc.enable")} ${index + 1}`} /><span className={cn("multi-calc-enable-label", screen.enabled ? "is-enabled" : "is-disabled")}>{t("multiCalc.enable")}</span><Checkbox checked={selectedIds.includes(screen.id)} onCheckedChange={() => toggleSelected(screen.id)} aria-label={`${t("multiCalc.selected")} ${index + 1}`} /></div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-mono text-[10px] text-cyan-100/55" dir="ltr">{readableExpression(screen.expression) || "—"}</p><p className="multi-calc-screen-result" dir="ltr">{formatResult(screen.result)}</p></div>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyValue(screen.result)} className="multi-calc-copy"><Copy className="h-3.5 w-3.5" />{t("multiCalc.copy")}</Button>
                </div>
              </article>;
            })}
          </div>

          <div className="multi-calc-totals"><div><p><Sigma className="h-3.5 w-3.5" />{t("multiCalc.total")}</p><strong dir="ltr">{formatResult(total)}</strong></div><div><p>{t("multiCalc.average")}</p><strong dir="ltr">{formatResult(average)}</strong></div></div>
          {history.length ? <div className="multi-calc-history-list">{history.map((entry) => <button key={entry.id} type="button" onClick={() => void copyValue(entry.result)}><p className="truncate" dir="ltr">{entry.expression}</p><strong dir="ltr">= {formatResult(entry.result)}</strong></button>)}</div> : <p className="multi-calc-empty-history">{t("multiCalc.noHistory")}</p>}
        </aside>
      </div>
    </section>
  );
}
