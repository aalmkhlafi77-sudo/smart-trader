/**
 * مكوّن طي الإعدادات — دفتر الميناء.
 * الطبقة العامة تطوي مجموعة كاملة، والفرعية تنظّم أقسامها، والتفصيلية تخفي الفروع الطويلة.
 * يبقى المحتوى مركّباً أثناء الطي كي لا تُفقد مسودات الإدخال غير المحفوظة.
 */
import { ChevronDown, Layers3 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type FoldLevel = "general" | "section" | "detail";

interface SettingsFoldProps {
  title: string;
  hint?: string;
  stamp?: string;
  level?: FoldLevel;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

const styles: Record<FoldLevel, { shell: string; button: string; body: string; stamp: string }> = {
  general: {
    shell: "overflow-hidden rounded-lg border border-[var(--ink)]/18 bg-[var(--paper)] shadow-[0_12px_28px_rgba(15,42,58,0.06)]",
    button: "bg-[linear-gradient(90deg,rgba(17,67,62,0.09),rgba(240,226,190,0.22))] px-4 py-3.5 sm:px-5",
    body: "px-3 pb-3 pt-3 sm:px-5 sm:pb-5",
    stamp: "border-[var(--port-green)]/25 bg-[var(--port-green-soft)] text-[var(--ink)]",
  },
  section: {
    shell: "rounded-md border border-border bg-secondary/25",
    button: "px-3 py-3",
    body: "px-2 pb-2 pt-2 sm:px-3 sm:pb-3",
    stamp: "border-border bg-card text-muted-foreground",
  },
  detail: {
    shell: "rounded border border-[var(--amber-line)]/80 bg-[var(--amber-field)]/45",
    button: "px-3 py-2.5",
    body: "px-2.5 pb-2.5 pt-1.5 sm:px-3 sm:pb-3",
    stamp: "border-[var(--amber-line)] bg-card/70 text-[var(--ink)]/80",
  },
};

export default function SettingsFold({
  title,
  hint,
  stamp,
  level = "section",
  defaultOpen = false,
  children,
  className,
}: SettingsFoldProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const style = styles[level];
  return (
    <section className={cn(style.shell, className)}>
      <button
        type="button"
        className={cn("flex w-full items-center justify-between gap-3 text-start transition-colors hover:bg-black/[0.025]", style.button)}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-start gap-2.5">
          <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border", style.stamp)}>
            <Layers3 className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--ink-deep)]">{title}</span>
            {hint ? <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{hint}</span> : null}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {stamp ? <span className={cn("hidden rounded border px-1.5 py-0.5 text-[9px] font-semibold sm:inline", style.stamp)}>{stamp}</span> : null}
          <ChevronDown className={cn("h-4 w-4 text-[var(--ink)]/70 transition-transform duration-200", open && "rotate-180")} />
        </span>
      </button>
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={style.body}>{children}</div>
        </div>
      </div>
    </section>
  );
}
