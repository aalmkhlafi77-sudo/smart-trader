/**
 * بطاقة "صحيفة السجل" — اتجاه التصميم: "دفتر الميناء"
 * تُستخدم لتجميع الحقول والنتائج بشكل يشبه أوراق السجل المرتبة.
 */

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export default function SectionCard({
  title,
  hint,
  children,
  className,
  action,
  stamp,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  stamp?: string;
}) {
  return (
    <section className={cn("ledger-sheet ledger-tab rounded-[0.55rem]", className)} data-document="ledger-record">
      <header className="ledger-head flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-1 rounded-sm bg-[var(--port-green)]" />
            <h2 className="font-display text-sm font-bold text-[var(--ink)]" data-ui-text>{title}</h2>
            <span className="ledger-register-code" data-ui-text>سجل</span>
          </div>
          {hint ? <p className="text-[11px] text-muted-foreground mt-0.5" data-ui-text>{hint}</p> : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {stamp ? <span className="ledger-stamp hidden sm:inline" data-ui-text>{stamp}</span> : null}
          {action}
        </div>
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
