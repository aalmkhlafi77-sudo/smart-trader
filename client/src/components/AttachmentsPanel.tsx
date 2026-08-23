/**
 * مرفقات السجل — اتجاه التصميم: دفتر الميناء.
 * تحفظ الملفات محلياً داخل IndexedDB وتنتقل ضمن النسخ الاحتياطية.
 */

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { db, type AttachmentRow } from "@/lib/db";
import { newId, nowIso } from "@/lib/id";
import { Download, Eye, FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

export default function AttachmentsPanel({
  entityId,
  itemId,
  compact = false,
  onChanged,
}: {
  entityId?: string | null;
  itemId?: string | null;
  compact?: boolean;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<AttachmentRow[]>([]);
  const [previewPdf, setPreviewPdf] = useState<AttachmentRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    await db.init();
    setRows(await db.listAttachments({ entityId: entityId ?? undefined, itemId: itemId ?? undefined }));
  };

  useEffect(() => {
    void load();
  }, [entityId, itemId]);

  const add = async (files: FileList | null) => {
    if (!files?.length || (!entityId && !itemId)) return;
    const valid = Array.from(files).filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`الملف ${file.name} أكبر من 5 MB`);
        return false;
      }
      return true;
    });
    try {
      await Promise.all(valid.map(async (file) => {
        await db.saveAttachment({
          id: newId("att"),
          entityId: entityId ?? null,
          itemId: itemId ?? null,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          dataUrl: await readAsDataUrl(file),
          createdAt: nowIso(),
        });
      }));
      toast.success(`تم حفظ ${valid.length} مرفق محلياً`);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ المرفق");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("حذف هذا المرفق من الجهاز؟")) return;
    await db.deleteAttachment(id);
    await load();
    onChanged?.();
  };

  return (
    <section className={compact ? "space-y-2" : "rounded border border-border bg-secondary/20 p-3 space-y-3"}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5 text-[var(--port-green)]" />
          <p className="text-xs font-semibold text-[var(--ink)]">الصور والمرفقات</p>
          <span className="text-[10px] text-muted-foreground">{rows.length}</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,.pdf,.xlsx,.xls,.doc,.docx,.txt"
          onChange={(event) => {
            void add(event.target.files);
            event.target.value = "";
          }}
        />
        <Button type="button" size="sm" variant="outline" className="h-7 bg-card text-[11px]" onClick={() => fileRef.current?.click()}>
          <Plus className="h-3.5 w-3.5" />
          إرفاق
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">أرفق صور الكتالوج أو ملفات العرض. تحفظ محلياً وتدخل في النسخة الاحتياطية.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {rows.map((row) => (
            <div key={row.id} className="overflow-hidden rounded border border-border bg-card">
              {row.mimeType.startsWith("image/") ? (
                <img src={row.dataUrl} alt={row.name} className="h-20 w-full object-cover" />
              ) : (
                <div className="flex h-20 items-center justify-center bg-secondary/50"><FileText className="h-7 w-7 text-[var(--ink)]/65" /></div>
              )}
              <div className="space-y-1.5 p-2">
                <p className="truncate text-[10px] text-foreground" title={row.name}>{row.name}</p>
                <div className="flex gap-1">
                  {row.mimeType === "application/pdf" || row.name.toLowerCase().endsWith(".pdf") ? (
                    <Button type="button" size="icon" variant="outline" className="h-6 w-6 bg-card" onClick={() => setPreviewPdf(row)} aria-label={`معاينة ${row.name}`}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  ) : null}
                  <a href={row.dataUrl} download={row.name} className="inline-flex h-6 flex-1 items-center justify-center rounded border border-border text-muted-foreground hover:bg-secondary" aria-label={`تنزيل ${row.name}`}>
                    <Download className="h-3 w-3" />
                  </a>
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => void remove(row.id)} aria-label={`حذف ${row.name}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={previewPdf !== null} onOpenChange={(open) => !open && setPreviewPdf(null)}>
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-4 py-3"><DialogTitle className="truncate text-sm text-[var(--ink)]">{previewPdf?.name ?? "معاينة PDF"}</DialogTitle></DialogHeader>
          {previewPdf ? <iframe title={previewPdf.name} src={previewPdf.dataUrl} className="h-[72vh] w-full bg-secondary" /> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
