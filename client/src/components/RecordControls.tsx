/**
 * عناصر تحكم السجلات — اتجاه التصميم: دفتر الميناء.
 * تجمع الإجراءات داخل ختم خيارات واحد وتحفظ كثافة العرض محلياً.
 */

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export type RecordDensity = "compact" | "detailed";

export function useRecordDensity(scope = "all") {
  const key = `smart-trader-record-density-${scope}`;
  const [density, setDensity] = useState<RecordDensity>(() =>
    window.localStorage.getItem(key) === "detailed" ? "detailed" : "compact",
  );

  useEffect(() => {
    window.localStorage.setItem(key, density);
  }, [density, key]);

  return [density, setDensity] as const;
}

export function DensityToggle({
  value,
  onChange,
  className,
}: {
  value: RecordDensity;
  onChange: (value: RecordDensity) => void;
  className?: string;
}) {
  const { t } = useLanguage();
  return (
    <div className={cn("inline-flex rounded-[0.4rem] border border-border bg-card p-0.5", className)} aria-label={t("common.density") }>
      <button
        type="button"
        onClick={() => onChange("compact")}
        className={cn(
          "rounded-[0.27rem] px-2 py-1 text-[10px] font-semibold transition-colors",
          value === "compact" ? "bg-[var(--ink)] text-white" : "text-muted-foreground hover:bg-secondary",
        )}
      >
        {t("common.compact")}
      </button>
      <button
        type="button"
        onClick={() => onChange("detailed")}
        className={cn(
          "rounded-[0.27rem] px-2 py-1 text-[10px] font-semibold transition-colors",
          value === "detailed" ? "bg-[var(--ink)] text-white" : "text-muted-foreground hover:bg-secondary",
        )}
      >
        {t("common.detailed")}
      </button>
    </div>
  );
}

export interface RecordMenuAction {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onSelect: () => void;
  destructive?: boolean;
  separatorBefore?: boolean;
}

export function RecordMenu({ actions }: { actions: RecordMenuAction[] }) {
  const { t } = useLanguage();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          title={t("common.actions")}
          aria-label={t("common.actions")}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <div key={`${action.label}-${index}`}>
              {action.separatorBefore ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                className={action.destructive ? "text-destructive focus:text-destructive" : ""}
                onSelect={() => {
                  action.onSelect();
                }}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {action.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
