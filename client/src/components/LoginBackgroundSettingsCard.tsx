/** إعداد خلفية القفل — صورة محلية خاصة بالواجهة، لا تدخل في سجلات العمل أو النسخ الاحتياطية. */
import { useRef, useState } from "react";
import { ImagePlus, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLoginBackground } from "@/contexts/LoginBackgroundContext";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";

export default function LoginBackgroundSettingsCard() {
  const { backgroundUrl, hasCustomBackground, setCustomBackground, restoreDefaultBackground } = useLoginBackground();
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const selectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await setCustomBackground(file);
      toast.success(t("loginBackground.saved"));
    } catch (error) {
      toast.error(t(error instanceof Error && error.message === "too-large" ? "loginBackground.tooLarge" : "loginBackground.invalid"));
    } finally {
      setUploading(false);
    }
  };

  const restore = async () => {
    try {
      await restoreDefaultBackground();
      toast.success(t("loginBackground.restored"));
    } catch {
      toast.error(t("loginBackground.failed"));
    }
  };

  return (
    <SectionCard title={t("loginBackground.title")} hint={t("loginBackground.hint")} stamp={t("loginBackground.stamp")}>
      <div className="space-y-3">
        <div className="relative aspect-[16/7] overflow-hidden rounded border border-[var(--ink)]/18 bg-[var(--ink)]">
          <img src={backgroundUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(6,27,43,0.64),rgba(6,27,43,0.08))]" />
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 text-[10px] font-bold text-white">
            <span>{hasCustomBackground ? t("loginBackground.custom") : t("loginBackground.default")}</span>
            <span className="rounded border border-white/35 bg-black/20 px-2 py-1 backdrop-blur-sm">{t("loginBackground.localOnly")}</span>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" onChange={(event) => void selectFile(event)} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" />{t("loginBackground.upload")}
          </Button>
          <Button type="button" variant="outline" disabled={!hasCustomBackground || uploading} onClick={() => void restore()}>
            <RotateCcw className="h-4 w-4" />{t("loginBackground.restore")}
          </Button>
        </div>
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground"><ImagePlus className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t("loginBackground.note")}</p>
      </div>
    </SectionCard>
  );
}
