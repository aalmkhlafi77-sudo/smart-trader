/**
 * تفضيلات الحاسبة العائمة — دفتر الميناء:
 * تحفظ ظهور الزر وموضعه على هذا الجهاز فقط، خارج بيانات السجلات والنسخ الاحتياطية.
 */
import { Calculator, Eye, EyeOff, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";

const VISIBILITY_KEY = "smart-trader:floating-calculator-visible";
const POSITION_KEY = "smart-trader:floating-calculator-position";

function isVisible() {
  return localStorage.getItem(VISIBILITY_KEY) !== "false";
}

export default function FloatingCalculatorSettingsCard() {
  const { t } = useLanguage();
  const [visible, setVisibleState] = useState(isVisible);

  const setVisible = (next: boolean) => {
    localStorage.setItem(VISIBILITY_KEY, String(next));
    setVisibleState(next);
    window.dispatchEvent(new Event("smart-trader:floating-calculator-visibility"));
    toast.success(next ? t("multiCalc.visibilityShown") : t("multiCalc.visibilityHidden"));
  };

  const resetPosition = () => {
    localStorage.removeItem(POSITION_KEY);
    window.dispatchEvent(new Event("smart-trader:floating-calculator-visibility"));
    toast.success(t("multiCalc.positionReset"));
  };

  return (
    <SectionCard title={t("multiCalc.visibilityTitle")} hint={t("multiCalc.visibilityHint")} stamp={t("multiCalc.title")}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--port-green)]/20 bg-[var(--port-green)]/5 p-3">
          <div className="flex items-center gap-2.5"><span className="rounded-md bg-[var(--port-green)]/12 p-2 text-[var(--port-green)]"><Calculator className="h-4 w-4" /></span><div><p className="text-sm font-black text-[var(--ink)]">{t("multiCalc.visibilityLabel")}</p><p className="text-[11px] text-muted-foreground">{visible ? t("multiCalc.visibilityShown") : t("multiCalc.visibilityHidden")}</p></div></div>
          <Switch checked={visible} onCheckedChange={setVisible} aria-label={t("multiCalc.visibilityLabel")} />
        </div>
        <Button type="button" variant="outline" className="w-full justify-between" onClick={resetPosition}><span className="flex items-center gap-2"><RotateCcw className="h-4 w-4" />{t("multiCalc.resetPosition")}</span>{visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</Button>
      </div>
    </SectionCard>
  );
}
