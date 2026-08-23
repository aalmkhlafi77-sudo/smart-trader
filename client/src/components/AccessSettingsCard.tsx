/** إدارة رمز الدخول — جزء من إعدادات دفتر الميناء، لا يحفظ الرمز ضمن بيانات العمل أو النسخة الاحتياطية. */
import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAccess } from "@/contexts/AccessContext";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const sixDigits = (value: string) => /^\d{6}$/.test(value);

export default function AccessSettingsCard() {
  const { changePin, configured } = useAccess();
  const { t } = useLanguage();
  const [currentPin, setCurrentPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);

  if (!configured) return null;

  const digitsOnly = (setter: (value: string) => void) => (value: string) => setter(value.replace(/\D/g, "").slice(0, 6));
  const submit = async () => {
    if (![currentPin, nextPin, confirmation].every(sixDigits)) {
      toast.error(t("access.sixDigits"));
      return;
    }
    if (nextPin !== confirmation) {
      toast.error(t("access.mismatch"));
      setConfirmation("");
      return;
    }
    setSaving(true);
    try {
      const changed = await changePin(currentPin, nextPin);
      if (!changed) {
        toast.error(t("access.currentIncorrect"));
        setCurrentPin("");
        return;
      }
      setCurrentPin("");
      setNextPin("");
      setConfirmation("");
      toast.success(t("access.changed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title={t("access.settingsTitle")} hint={t("access.settingsHint")} stamp={t("access.record")}>
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded border border-[var(--port-green)]/30 bg-[var(--port-green-soft)] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--ink)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("access.settingsNote")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="access-current">{t("access.currentCode")}</Label>
            <Input id="access-current" className="field-input" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} dir="ltr" value={currentPin} onChange={(event) => digitsOnly(setCurrentPin)(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="access-next">{t("access.newCode")}</Label>
            <Input id="access-next" className="field-input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} dir="ltr" value={nextPin} onChange={(event) => digitsOnly(setNextPin)(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="access-confirm">{t("access.confirmNewCode")}</Label>
            <Input id="access-confirm" className="field-input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} dir="ltr" value={confirmation} onChange={(event) => digitsOnly(setConfirmation)(event.target.value)} />
          </div>
        </div>
        <Button type="button" className="w-full" disabled={saving} onClick={() => void submit()}>
          <KeyRound className="h-4 w-4" />{t("access.changeCode")}
        </Button>
      </div>
    </SectionCard>
  );
}
