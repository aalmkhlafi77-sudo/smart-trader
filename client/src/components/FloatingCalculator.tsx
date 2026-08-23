/**
 * مساعد الحاسبة العائم — دفتر الميناء:
 * يوفر وصولاً فورياً للحسابات من أي سجل دون مغادرة صفحة العمل الحالية.
 */
import { useEffect, useRef, useState } from "react";
import { Calculator, GripVertical, Maximize2, Minimize2, Minus, X } from "lucide-react";
import MultiScreenCalculator from "@/components/MultiScreenCalculator";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const VISIBILITY_KEY = "smart-trader:floating-calculator-visible";
const POSITION_KEY = "smart-trader:floating-calculator-position";
const RESULT_KEY = "smart-trader:floating-calculator-last-result";
const SIZE_KEY = "smart-trader:floating-calculator-size";
const DIMENSIONS_KEY = "smart-trader:floating-calculator-dimensions";
const DIMENSIONS_SCALE_VERSION_KEY = "smart-trader:floating-calculator-dimensions-scale-v3";

type FloatingPosition = { x: number; y: number };
type FloatingDimensions = { width: number; height: number };
type ResizeDirection = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

function readVisibility() {
  return localStorage.getItem(VISIBILITY_KEY) !== "false";
}

function readPosition(): FloatingPosition | null {
  try {
    const saved = localStorage.getItem(POSITION_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as FloatingPosition;
    return Number.isFinite(parsed.x) && Number.isFinite(parsed.y) ? parsed : null;
  } catch {
    return null;
  }
}

function readPanelSize() {
  return localStorage.getItem(SIZE_KEY) === "compact" ? "compact" : "wide";
}

function readDimensions(): FloatingDimensions | null {
  try {
    const saved = localStorage.getItem(DIMENSIONS_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as FloatingDimensions;
    if (!Number.isFinite(parsed.width) || !Number.isFinite(parsed.height)) return null;
    if (localStorage.getItem(DIMENSIONS_SCALE_VERSION_KEY) === "0.7") return parsed;
    const scaled = { width: Math.round(parsed.width * 0.7), height: Math.round(parsed.height * 0.7) };
    localStorage.setItem(DIMENSIONS_KEY, JSON.stringify(scaled));
    localStorage.setItem(DIMENSIONS_SCALE_VERSION_KEY, "0.7");
    return scaled;
  } catch {
    return null;
  }
}

export default function FloatingCalculator() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [visible, setVisible] = useState(readVisibility);
  const [position, setPosition] = useState<FloatingPosition | null>(readPosition);
  const [lastResult, setLastResult] = useState(() => localStorage.getItem(RESULT_KEY) ?? "0");
  const [panelSize, setPanelSize] = useState<"compact" | "wide">(readPanelSize);
  const [dimensions, setDimensions] = useState<FloatingDimensions | null>(readDimensions);
  const [idle, setIdle] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const lastPositionRef = useRef<FloatingPosition | null>(position);
  const dimensionsRef = useRef<FloatingDimensions | null>(dimensions);
  const movedRef = useRef(false);
  const idleTimerRef = useRef<number | null>(null);

  const wake = () => {
    setIdle(false);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setIdle(true), 2800);
  };

  useEffect(() => {
    const syncPreferences = () => {
      setVisible(readVisibility());
      setPosition(readPosition());
    };
    window.addEventListener("smart-trader:floating-calculator-visibility", syncPreferences);
    return () => window.removeEventListener("smart-trader:floating-calculator-visibility", syncPreferences);
  }, []);

  useEffect(() => {
    wake();
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [open, minimized]);

  const updateLastResult = (result: string) => {
    setLastResult(result);
    localStorage.setItem(RESULT_KEY, result);
    wake();
  };

  const togglePanelSize = () => {
    const next = panelSize === "wide" ? "compact" : "wide";
    setPanelSize(next);
    localStorage.setItem(SIZE_KEY, next);
    setDimensions(null);
    localStorage.removeItem(DIMENSIONS_KEY);
    wake();
  };

  const beginResize = (direction: ResizeDirection) => (event: React.PointerEvent<HTMLButtonElement>) => {
    const panel = panelRef.current;
    if (!panel || event.button !== 0) return;
    const rect = panel.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, width: rect.width, height: rect.height, left: rect.left, top: rect.top };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // تستمر متابعة السحب عبر مستمعي النافذة عند عدم توفر التقاط المؤشر.
    }
    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - start.x;
      const dy = moveEvent.clientY - start.y;
      const minWidth = 380;
      const minHeight = 320;
      const maxWidth = Math.max(minWidth, window.innerWidth - 32);
      const maxHeight = Math.max(minHeight, window.innerHeight - 96);
      let width = start.width;
      let height = start.height;
      let left = start.left;
      let top = start.top;
      if (direction.includes("e")) width = Math.min(maxWidth, Math.max(minWidth, start.width + dx));
      if (direction.includes("s")) height = Math.min(maxHeight, Math.max(minHeight, start.height + dy));
      if (direction.includes("w")) {
        width = Math.min(maxWidth, Math.max(minWidth, start.width - dx));
        left = start.left + (start.width - width);
      }
      if (direction.includes("n")) {
        height = Math.min(maxHeight, Math.max(minHeight, start.height - dy));
        top = start.top + (start.height - height);
      }
      const nextPosition = { x: Math.max(8, Math.min(window.innerWidth - width - 8, left)), y: Math.max(8, Math.min(window.innerHeight - height - 8, top)) };
      setPosition(nextPosition);
      lastPositionRef.current = nextPosition;
      const nextDimensions = { width, height };
      dimensionsRef.current = nextDimensions;
      setDimensions(nextDimensions);
    };
    const onUp = () => {
      const finalDimensions = dimensionsRef.current;
      if (finalDimensions) localStorage.setItem(DIMENSIONS_KEY, JSON.stringify({ width: Math.round(finalDimensions.width), height: Math.round(finalDimensions.height) }));
      if (lastPositionRef.current) localStorage.setItem(POSITION_KEY, JSON.stringify(lastPositionRef.current));
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    wake();
    event.preventDefault();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (open || event.button !== 0) return;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, baseX: rect.left, baseY: rect.top };
    lastPositionRef.current = { x: rect.left, y: rect.top };
    movedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!movedRef.current && Math.hypot(deltaX, deltaY) < 6) return;
    movedRef.current = true;
    const rect = wrapperRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 56;
    const height = rect?.height ?? 48;
    const next = {
      x: Math.max(8, Math.min(window.innerWidth - width - 8, drag.baseX + deltaX)),
      y: Math.max(8, Math.min(window.innerHeight - height - 8, drag.baseY + deltaY)),
    };
    lastPositionRef.current = next;
    setPosition(next);
    event.preventDefault();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (movedRef.current && lastPositionRef.current) {
      localStorage.setItem(POSITION_KEY, JSON.stringify(lastPositionRef.current));
    }
  };

  const toggleOpen = () => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    setOpen((value) => !value);
    setMinimized(false);
  };

  if (!visible) return null;

  const locationStyle = position ? { left: `${position.x}px`, top: `${position.y}px` } : undefined;
  const locationClass = position
    ? "fixed z-[70] flex flex-col items-end gap-2 sm:gap-3"
    : "fixed bottom-[calc(1rem+3rem)] end-3 z-[70] flex flex-col items-end gap-2 sm:bottom-[calc(1.25rem+3rem)] sm:end-5 sm:gap-3";

  return (
    <div ref={wrapperRef} className={locationClass} style={locationStyle} onPointerEnter={wake} onFocusCapture={wake}>
      {open && (
        <section ref={panelRef} style={dimensions ? { width: `min(${dimensions.width}px, calc(100vw - 1.5rem))`, height: `min(${dimensions.height}px, calc(100dvh - 7.5rem))` } : undefined} className={minimized ? "hidden" : `calculator-window-shell relative max-h-[calc(100dvh-7.5rem)] w-[calc(100vw-1.5rem)] overflow-y-auto p-1 ${dimensions ? "" : panelSize === "wide" ? "lg:w-[min(784px,calc(100vw-4rem))]" : "lg:w-[min(532px,calc(100vw-4rem))]"}`} aria-label={t("multiCalc.title")}> 
          <div className="calculator-window-toolbar sticky top-0 z-10 flex justify-end px-1.5 pt-1.5 backdrop-blur">
            <div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" className="hidden h-7 w-7 lg:inline-flex" onClick={togglePanelSize} aria-label={panelSize === "wide" ? t("multiCalc.shrinkWindow") : t("multiCalc.expandWindow")}>{panelSize === "wide" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}</Button><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMinimized(true)} aria-label={t("multiCalc.minimize")}><Minus className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => { setOpen(false); setMinimized(false); }}><X className="h-3 w-3" />{t("multiCalc.close")}</Button></div>
          </div>
          <MultiScreenCalculator keyboardEnabled={!minimized} onEscape={() => setMinimized(true)} onResultChange={updateLastResult} />
          <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
            {(["n", "e", "s", "w", "ne", "nw", "se", "sw"] as ResizeDirection[]).map((direction) => <button key={direction} type="button" className={`pointer-events-auto absolute ${direction === "n" ? "-top-1 left-4 right-4 h-2 cursor-ns-resize" : direction === "s" ? "-bottom-1 left-4 right-4 h-2 cursor-ns-resize" : direction === "e" ? "-right-1 bottom-4 top-4 w-2 cursor-ew-resize" : direction === "w" ? "-left-1 bottom-4 top-4 w-2 cursor-ew-resize" : direction === "ne" ? "-right-1 -top-1 h-4 w-4 cursor-ne-resize" : direction === "nw" ? "-left-1 -top-1 h-4 w-4 cursor-nw-resize" : direction === "se" ? "-bottom-1 -right-1 h-4 w-4 cursor-se-resize" : "-bottom-1 -left-1 h-4 w-4 cursor-sw-resize"}`} onPointerDown={beginResize(direction)} aria-label={direction} />)}
          </div>
        </section>
      )}
      {open && minimized ? (
        <div className="flex items-center gap-1 rounded-full border border-[var(--port-green)]/35 bg-[var(--paper)] p-1 shadow-[0_8px_22px_rgba(15,112,81,0.26)]">
          <Button type="button" onClick={() => setMinimized(false)} className="h-8 rounded-full !bg-[var(--port-green)] px-2.5 text-[11px] font-black text-white hover:!bg-[#0d644b]" aria-label={t("multiCalc.restore")}><Calculator className="h-3.5 w-3.5" /><span className="hidden sm:inline">{t("multiCalc.title")}</span><span className="ledger-figure rounded bg-white/15 px-1.5 py-0.5 text-[9px]" dir="ltr">{lastResult}</span><Maximize2 className="h-3 w-3" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setOpen(false); setMinimized(false); }} aria-label={t("multiCalc.close")}><X className="h-3.5 w-3.5" /></Button>
        </div>
      ) : (
        <Button type="button" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onClick={toggleOpen} aria-expanded={open} className={`h-9 touch-none select-none rounded-full !bg-[var(--port-green)] px-3 text-xs font-black text-white shadow-[0_6px_16px_rgba(15,112,81,0.32)] transition-opacity duration-300 hover:!bg-[#0d644b] ${idle && !open ? "opacity-55 hover:!opacity-100" : "opacity-100"}`} title={t("multiCalc.open")}>
          <Calculator className="h-4 w-4" />
          <span className="hidden sm:inline">{open ? t("multiCalc.close") : t("multiCalc.open")}</span>
          <span className="ledger-figure max-w-16 truncate rounded bg-white/15 px-1.5 py-0.5 text-[9px]" dir="ltr">{lastResult}</span>
          {!open ? <GripVertical className="h-3 w-3 opacity-75" aria-hidden="true" /> : null}
        </Button>
      )}
    </div>
  );
}
