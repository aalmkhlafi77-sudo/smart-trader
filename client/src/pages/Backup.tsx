/**
 * النسخ الاحتياطي والاستعادة — اتجاه التصميم: "دفتر الميناء"
 * البيانات محلية، لذا النسخة الاحتياطية اليدوية وظيفة أساسية لا اختيارية.
 * صيغة النسخة مستقلة عن محرك التخزين لتسهيل الانتقال إلى SQLite.
 */

import AppLayout from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { db, STORAGE_ENGINE, type BackupLogRow, type BackupPayload } from "@/lib/db";
import { nowIso } from "@/lib/id";
import { formatCount, formatDateTime } from "@/lib/pricing";
import { AlertTriangle, Check, Database, Download, FileSearch, HardDrive, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type RestoreMode = "replace" | "merge";

interface BackupPreview {
  fileName: string;
  payload: BackupPayload;
  schemaVersion: number | string;
  exportedAt: string;
  legacy: boolean;
  counts: Array<[string, number]>;
  entities: string[];
  items: string[];
}

function makePreview(raw: unknown, fileName: string): BackupPreview | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  const tables = payload.tables && typeof payload.tables === "object" ? payload.tables as Record<string, unknown> : payload;
  const rows = (keys: string[]) => {
    for (const key of keys) {
      const value = tables[key];
      if (Array.isArray(value)) return value;
    }
    return [];
  };
  const entities = rows(["entities"]);
  const items = rows(["items"]);
  if (payload.format !== "smart-trader-backup" && !payload.tables && entities.length === 0 && items.length === 0) return null;
  const categories = rows(["categories"]);
  const specs = rows(["item_specs", "itemSpecs", "specs"]);
  const prices = rows(["item_prices", "itemPrices", "prices"]);
  const priceHistory = rows(["price_history", "priceHistory"]);
  const attachments = rows(["attachments"]);
  const notes = rows(["notes"]);
  const tasks = rows(["tasks"]);
  const runs = rows(["pricing_runs", "pricingRuns", "cost_calculations", "costCalculations"]);
  const lists = rows(["price_lists", "priceLists"]);
  const names = (records: unknown[]) => records
    .slice(0, 4)
    .map((record) => typeof record === "object" && record && "name" in record ? String((record as { name: unknown }).name) : "سجل بلا اسم")
    .filter(Boolean);
  return {
    fileName,
    payload: raw as BackupPayload,
    schemaVersion: typeof payload.schemaVersion === "number" ? payload.schemaVersion : "قديمة",
    exportedAt: typeof payload.exportedAt === "string" ? payload.exportedAt : "غير محدد",
    legacy: payload.format !== "smart-trader-backup" || !payload.tables,
    counts: [
      ["الجهات", entities.length],
      ["التصنيفات", categories.length],
      ["الأصناف", items.length],
      ["المواصفات", specs.length],
      ["الأسعار", prices.length],
      ["تاريخ الأسعار", priceHistory.length],
      ["المرفقات", attachments.length],
      ["الملاحظات", notes.length],
      ["المهام", tasks.length],
      ["حسابات التكلفة", runs.length],
      ["قوائم الأسعار", lists.length],
    ],
    entities: names(entities),
    items: names(items),
  };
}

export default function Backup() {
  const { t } = useLanguage();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [lastBackup, setLastBackup] = useState("");
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("merge");
  const [isRestoring, setIsRestoring] = useState(false);
  const [logs, setLogs] = useState<BackupLogRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    await db.init();
    const payload = await db.exportBackup();
    const [meta, logRows] = await Promise.all([db.getMeta(), db.listBackupLogs()]);
    setCounts({
      "الجهات": payload.tables.entities.length,
      "الأصناف": payload.tables.items.length,
      "المواصفات": payload.tables.item_specs.length,
      "سجلات الأسعار": payload.tables.item_prices.length,
      "تاريخ الأسعار": payload.tables.price_history.length,
      "المرفقات": payload.tables.attachments.length,
      "الملاحظات": payload.tables.notes.length,
      "المهام": payload.tables.tasks.length,
      "حسابات التكلفة": payload.tables.pricing_runs.length,
      "قوائم الأسعار": payload.tables.price_lists.length,
    });
    setLastBackup(meta.lastBackupAt);
    setLogs(logRows);
  };

  useEffect(() => {
    void load();
  }, []);

  const exportBackup = async () => {
    const payload = await db.exportBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smart-trader-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const meta = await db.getMeta();
    await db.saveMeta({ ...meta, lastBackupAt: nowIso(), updatedAt: nowIso() });
    await db.saveBackupLog({
      id: `backup-${Date.now()}`,
      action: "export",
      fileName: a.download,
      summary: `${payload.tables.items.length} صنف و${payload.tables.entities.length} جهة`,
      createdAt: nowIso(),
    });
    toast.success(t("backup.created"));
    await load();
  };

  const inspectBackup = async (file: File) => {
    try {
      const text = await file.text();
      const details = makePreview(JSON.parse(text), file.name);
      if (!details) {
        toast.error(t("backup.invalid"));
        return;
      }
      setPreview(details);
      setRestoreMode("merge");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("backup.readFailed");
      toast.error(`${t("backup.readFailed")}: ${message}`);
    }
  };

  const confirmRestore = async () => {
    if (!preview) return;
    setIsRestoring(true);
    try {
      await db.init();
      await db.importBackup(preview.payload, restoreMode);
      const restored = await db.exportBackup();
      await db.saveBackupLog({
        id: `restore-${Date.now()}`,
        action: restoreMode === "merge" ? "merge" : "restore",
        fileName: preview.fileName,
        summary: `${restored.tables.items.length} صنف و${restored.tables.entities.length} جهة`,
        createdAt: nowIso(),
      });
      toast.success(`تمت ${restoreMode === "merge" ? "الدمج" : "الاستعادة"}: ${formatCount(restored.tables.items.length)} صنف و${formatCount(restored.tables.entities.length)} جهة`);
      setPreview(null);
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("backup.readFailed");
      toast.error(`${t("backup.importFailed")}: ${message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const clearAll = async () => {
    if (!window.confirm(t("backup.deleteConfirm"))) return;
    if (!window.confirm(t("backup.deleteFinalConfirm"))) return;
    await db.clearAll();
    toast.success(t("backup.deleted"));
    await load();
  };

  return (
    <AppLayout title={t("backup.title")} subtitle={t("backup.localSubtitle")}>
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <SectionCard
          title="حالة التخزين"
          hint={`محرك التخزين الحالي: ${STORAGE_ENGINE}`}
          stamp="جرد الدفتر"
        >
          <div className="grid grid-cols-2 gap-2.5">
            {Object.entries(counts).map(([label, value]) => (
              <div key={label} className="rounded border border-border bg-card px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="ledger-figure text-lg text-[var(--ink)]">
                  {formatCount(value)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded border border-border bg-secondary/50 px-3 py-2.5">
            <HardDrive className="h-4 w-4 mt-0.5 shrink-0 text-[var(--ink)]" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              البيانات محفوظة داخل هذا الجهاز فقط. حذف بيانات المتصفح أو إعادة تهيئة الجهاز يؤدي
              إلى فقدانها إن لم توجد نسخة احتياطية.
              {lastBackup ? (
                <span className="block mt-1" dir="ltr">
                  آخر نسخة: {formatDateTime(lastBackup)}
                </span>
              ) : (
                <span className="block mt-1">لم تُنشئ أي نسخة احتياطية بعد.</span>
              )}
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="تصدير واستعادة"
          hint="ملف واحد يحتوي جميع بياناتك الداخلية"
          stamp="أرشيف محلي"
        >
          <div className="space-y-3">
            <Button onClick={exportBackup} className="w-full">
              <Download className="h-4 w-4" />
              إنشاء نسخة احتياطية
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void inspectBackup(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="w-full bg-card"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              استعادة من ملف
            </Button>
            <div className="flex items-start gap-2 rounded border border-[var(--amber-line)] bg-[var(--amber-field)] px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-[#9a6700]" />
              <p className="text-[11px] leading-relaxed text-[#7a5200]">
                هذه النسخة ملف داخلي يحتوي التكاليف والملاحظات الخاصة. لا تشاركه مع العملاء؛ استخدم
                قوائم الأسعار للتصدير التجاري.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded border border-border bg-secondary/50 px-3 py-2.5">
              <Database className="h-4 w-4 mt-0.5 shrink-0 text-[var(--ink)]" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                صيغة النسخة مستقلة عن محرك التخزين، لذا يمكن استيرادها لاحقاً في نسخة SQLite عند
                تحويل التطبيق إلى تطبيق مغلف للجهاز.
              </p>
            </div>
            {preview ? (
              <div className="rounded border-2 border-[var(--port-green)]/45 bg-card p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-[var(--port-green)]" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink)]">معاينة قبل الاستيراد</p>
                      <p className="mt-0.5 break-all text-[10px] text-muted-foreground">{preview.fileName}</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setPreview(null)} title="إلغاء المعاينة"><X className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {preview.counts.map(([label, value]) => (
                    <div key={label} className="rounded border border-border bg-secondary/35 px-2.5 py-2">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="ledger-figure text-base text-[var(--ink)]">{formatCount(value)}</p>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] leading-relaxed text-muted-foreground">
                  <p>إصدار الملف: <span className="ledger-figure">{preview.schemaVersion}</span>{preview.exportedAt !== "غير محدد" ? ` · تاريخ التصدير: ${formatDateTime(preview.exportedAt)}` : ""}</p>
                  {preview.legacy ? <p className="mt-1 text-[#9a6700]">نسخة قديمة: سيجري ترحيلها تلقائياً إلى البنية الحالية.</p> : null}
                  {preview.entities.length ? <p className="mt-1">جهات: {preview.entities.join("، ")}</p> : null}
                  {preview.items.length ? <p className="mt-1">أصناف: {preview.items.join("، ")}</p> : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => setRestoreMode("merge")} className={`rounded border p-2.5 text-right transition-colors ${restoreMode === "merge" ? "border-[var(--port-green)] bg-[var(--result-green)]" : "border-border bg-secondary/30"}`}>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]"><Check className="h-3.5 w-3.5" />دمج آمن — موصى به</span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">يحافظ على البيانات الحالية ويحدّث السجل إذا كان له المعرف نفسه.</span>
                  </button>
                  <button type="button" onClick={() => setRestoreMode("replace")} className={`rounded border p-2.5 text-right transition-colors ${restoreMode === "replace" ? "border-[#c24d4d] bg-[#fff5f5]" : "border-border bg-secondary/30"}`}>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]"><AlertTriangle className="h-3.5 w-3.5 text-destructive" />استبدال كامل</span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">يحذف البيانات المحلية الحالية ثم يستورد النسخة المختارة.</span>
                  </button>
                </div>
                <Button className="w-full" disabled={isRestoring} onClick={() => void confirmRestore()}>
                  <Upload className="h-4 w-4" />
                  {isRestoring ? "جارٍ الاستيراد…" : restoreMode === "merge" ? "تأكيد الدمج الآمن" : "تأكيد الاستبدال الكامل"}
                </Button>
              </div>
            ) : null}
            <Button variant="outline" className="w-full text-destructive bg-card" onClick={clearAll}>
              <Trash2 className="h-4 w-4" />
              حذف جميع البيانات المحلية
            </Button>
          </div>
        </SectionCard>
      </div>
      <SectionCard title="سجل عمليات الأرشيف" hint="آخر عمليات النسخ والاستعادة على هذا الجهاز" stamp="أثر الحفظ" className="mt-5">
        {logs.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">لا توجد عمليات أرشيف مسجلة بعد.</p>
        ) : (
          <div className="space-y-2">
            {logs.slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-3 rounded border border-border bg-secondary/25 px-3 py-2 text-[11px]">
                <div className="min-w-0"><p className="font-semibold text-[var(--ink)]">{log.action === "export" ? "إنشاء نسخة" : log.action === "merge" ? "دمج نسخة" : "استعادة نسخة"}</p><p className="truncate text-muted-foreground">{log.fileName || "بيانات محلية"} — {log.summary}</p></div>
                <span className="shrink-0 text-muted-foreground" dir="ltr">{formatDateTime(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </AppLayout>
  );
}
