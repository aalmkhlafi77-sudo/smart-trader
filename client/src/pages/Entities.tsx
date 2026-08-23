/**
 * شاشة الجهات — اتجاه التصميم: "دفتر الميناء"
 * حقول الإدخال بخلفية كهرمانية، والقوائم تُعرض كصحائف سجل. الهاتف أولاً.
 */

import AppLayout from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import AttachmentsPanel from "@/components/AttachmentsPanel";
import EmptyHint from "@/components/EmptyHint";
import { DensityToggle, RecordMenu, useRecordDensity } from "@/components/RecordControls";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { db, type EntityKind, type EntityRow } from "@/lib/db";
import { newId, nowIso } from "@/lib/id";
import { formatDateTime } from "@/lib/pricing";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import { Eye, Paperclip, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const KINDS: { value: EntityKind; labelKey: string }[] = [
  { value: "supplier", labelKey: "entities.kind.supplier" },
  { value: "customer", labelKey: "entities.kind.customer" },
  { value: "factory", labelKey: "entities.kind.factory" },
  { value: "other", labelKey: "entities.kind.other" },
];

const currencyKey = (currency: string) => ({
  "دولار": "currency.usd",
  "ريال": "currency.sar",
  "يورو": "currency.eur",
  "يوان": "currency.cny",
}[currency]);

const emptyForm = {
  name: "",
  kind: "supplier" as EntityKind,
  country: "",
  city: "",
  phone: "",
  email: "",
  contactPerson: "",
  notes: "",
  defaultCurrency: "دولار",
  defaultExchangeRate: "3.75",
};

export default function Entities() {
  const { t } = useLanguage();
  const kindLabel = (kind: EntityKind) => t(KINDS.find((entry) => entry.value === kind)?.labelKey ?? "entities.kind.other");
  const currencyLabel = (currency: string) => {
    const key = currencyKey(currency);
    return key ? t(key) : currency;
  };
  const [rows, setRows] = useState<EntityRow[]>([]);
  const [form, setForm, clearFormDraft] = useSessionDraft("smart-trader:draft:entity-form", emptyForm);
  const [editingId, setEditingId, clearEditingDraft] = useSessionDraft<string | null>("smart-trader:draft:entity-editing", null);
  const [search, setSearch] = useState("");
  const [viewRow, setViewRow] = useState<EntityRow | null>(null);
  const [linkedCount, setLinkedCount] = useState(0);
  const [filterKind, setFilterKind] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [density, setDensity] = useRecordDensity();

  const load = async () => {
    await db.init();
    const [list, attachments] = await Promise.all([db.listEntities(), db.listAttachments()]);
    setRows([...list].sort((a, b) => a.name.localeCompare(b.name, "ar")));
    setAttachmentCounts(attachments.reduce<Record<string, number>>((counts, attachment) => {
      if (attachment.entityId) counts[attachment.entityId] = (counts[attachment.entityId] ?? 0) + 1;
      return counts;
    }, {}));
  };

  useEffect(() => {
    void load();
  }, []);

  const reset = () => {
    clearFormDraft();
    clearEditingDraft();
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(t("entities.nameRequired"));
      return;
    }
    const existing = editingId ? rows.find((r) => r.id === editingId) : null;
    const row: EntityRow = {
      id: existing?.id ?? newId("ent"),
      name: form.name.trim(),
      kind: form.kind,
      country: form.country.trim(),
      city: form.city.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      contactPerson: form.contactPerson.trim(),
      notes: form.notes.trim(),
      defaultCurrency: form.defaultCurrency?.trim?.() || "دولار",
      defaultExchangeRate: Number(form.defaultExchangeRate) || 0,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    await db.saveEntity(row);
    toast.success(existing ? t("entities.updated") : t("entities.saved"));
    reset();
    await load();
  };

  const edit = (row: EntityRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      kind: row.kind,
      country: row.country,
      city: row.city,
      phone: row.phone,
      email: row.email,
      contactPerson: row.contactPerson,
      notes: row.notes,
      defaultCurrency: row.defaultCurrency ?? "دولار",
      defaultExchangeRate: String(row.defaultExchangeRate ?? 3.75),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** عرض بطاقة الجهة كاملة دون الدخول في وضع التعديل */
  const view = async (row: EntityRow) => {
    const items = await db.listItems();
    setLinkedCount(items.filter((i) => i.entityId === row.id).length);
    setViewRow(row);
  };

  const remove = async (row: EntityRow) => {
    const items = await db.listItems();
    if (items.some((i) => i.entityId === row.id)) {
      toast.error(t("entities.cannotDelete"));
      return;
    }
    if (!window.confirm(`${t("entities.confirmDelete")} "${row.name}"?`)) return;
    await db.deleteEntity(row.id);
    toast.success(t("toast.deleted"));
    if (editingId === row.id) reset();
    await load();
  };

  /** بحث متقدم: يشمل كل حقول الجهة مع تصفية حسب النوع */
  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const haystack = [r.name, r.country, r.city, r.contactPerson, r.phone, r.email, r.notes]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filterKind !== "all" && r.kind !== filterKind) return false;
    return true;
  });

  return (
    <AppLayout title={t("entities.title")} subtitle={t("entities.subtitle")}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr] items-start">
        <SectionCard
          title={editingId ? t("entities.edit") : t("entities.add")}
          hint="الحقول الكهرمانية يدخلها المستخدم"
          stamp="نموذج قيد"
          action={
            <Button size="sm" variant="outline" className="bg-card" onClick={reset}>
              {editingId ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? t("entities.discardDraft") : t("common.newWork")}
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="form-cluster">
              <div className="form-cluster-heading"><p className="form-cluster-title">بيانات تعريف الجهة</p><p className="form-cluster-note">الاسم والنوع والموقع</p></div>
            <div className="space-y-1.5">
              <Label htmlFor="ent-name">اسم الجهة</Label>
              <Input
                id="ent-name"
                className="field-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: شركة النخبة"
              />
            </div>
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm({ ...form, kind: v as EntityKind })}
              >
                <SelectTrigger className="field-input w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {t(k.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ent-country">الدولة</Label>
                <Input
                  id="ent-country"
                  className="field-input"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ent-city">المدينة</Label>
                <Input
                  id="ent-city"
                  className="field-input"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
            </div>
            </div>
            <div className="form-cluster">
              <div className="form-cluster-heading"><p className="form-cluster-title">بيانات التواصل</p><p className="form-cluster-note">أضف ما يفيد العودة إلى الجهة</p></div>
            <div className="space-y-1.5">
              <Label htmlFor="ent-contact">الشخص المسؤول</Label>
              <Input
                id="ent-contact"
                className="field-input"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ent-phone">الهاتف</Label>
                <Input
                  id="ent-phone"
                  className="field-input"
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ent-email">البريد</Label>
                <Input
                  id="ent-email"
                  className="field-input"
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ent-notes">ملاحظات</Label>
              <Textarea
                id="ent-notes"
                className="field-input min-h-20"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            </div>
            <div className="form-cluster">
              <div className="form-cluster-heading"><p className="form-cluster-title">إعدادات الشراء الافتراضية</p><p className="form-cluster-note">تُنسخ تلقائياً للصنف عند اختيار هذه الجهة</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>{t("entities.defaultCurrency")}</Label><Select value={form.defaultCurrency || "دولار"} onValueChange={(value) => setForm({ ...form, defaultCurrency: value })}><SelectTrigger className="field-input w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="دولار">{t("currency.usd")}</SelectItem><SelectItem value="ريال">{t("currency.sar")}</SelectItem><SelectItem value="يورو">{t("currency.eur")}</SelectItem><SelectItem value="يوان">{t("currency.cny")}</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><Label htmlFor="ent-rate">سعر الصرف</Label><Input id="ent-rate" type="number" step="0.0001" min="0" dir="ltr" className="field-input" value={form.defaultExchangeRate ?? "3.75"} onChange={(e) => setForm({ ...form, defaultExchangeRate: e.target.value })} placeholder="مثال: 3.75" /></div>
              </div>
            </div>
            <Button onClick={save} className="form-action-bar w-full">
              <Plus className="h-4 w-4" />
              {editingId ? t("entities.update") : t("entities.save")}
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title={`${t("entities.record")} (${rows.length})`}
          hint="محفوظة على هذا الجهاز"
          stamp="دفتر الجهات"
          action={
            <div className="flex items-center gap-1.5">
              <DensityToggle value={density} onChange={setDensity} className="hidden sm:inline-flex" />
              <Button
                size="sm"
                variant="outline"
                className="bg-card"
                onClick={() => setShowFilters((v) => !v)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">تصفية</span>
              </Button>
            </div>
          }
        >
          <div className="mb-3 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="field-input pr-9"
                placeholder="ابحث بالاسم أو الدولة أو المدينة أو الهاتف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {showFilters ? (
              <div className="rounded border border-border bg-secondary/40 p-2.5 space-y-1">
                <Label className="text-[11px]">نوع الجهة</Label>
                <Select value={filterKind} onValueChange={setFilterKind}>
                  <SelectTrigger className="h-8 bg-card w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنواع</SelectItem>
                    {KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {t(k.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground pt-1">
                  {t("entities.results")} {filtered.length} {t("entities.of")} {rows.length}
                </p>
              </div>
            ) : null}
          </div>
          {filtered.length === 0 ? (
            <EmptyHint text="لا توجد جهات مطابقة. أضف جهة من النموذج المجاور." />
          ) : (
            <ul className="space-y-2.5">
              {filtered.map((row) => (
                <li
                  key={row.id}
                  className="record-card cursor-pointer rounded-[0.45rem] px-3.5 py-3"
                  onClick={() => setExpandedId((current) => current === row.id ? null : row.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-[var(--ink)]">{row.name}</p>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                        {kindLabel(row.kind)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {[row.country, row.city, row.contactPerson].filter(Boolean).join(" — ") ||
                        t("entities.noAdditional")}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold text-[var(--port-green)]">{currencyLabel(row.defaultCurrency ?? "دولار")} · {t("common.exchangeRate")} {row.defaultExchangeRate ?? 3.75}</p>
                    {(attachmentCounts[row.id] ?? 0) > 0 ? <span className="mt-1 inline-flex items-center gap-1 rounded border border-[var(--port-green)]/35 bg-[var(--port-green-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ink-deep)]"><Paperclip className="h-2.5 w-2.5" />{attachmentCounts[row.id]} مرفقات</span> : null}
                    {row.phone ? (
                      <p className="text-[11px] text-muted-foreground" dir="ltr">
                        {row.phone}
                      </p>
                    ) : null}
                  </div>
                  <div className="action-strip shrink-0" onClick={(event) => event.stopPropagation()}>
                    <RecordMenu actions={[
                      { label: "عرض البطاقة الكاملة", icon: Eye, onSelect: () => void view(row) },
                      { label: "الصور والمرفقات", icon: Paperclip, onSelect: () => setExpandedId(row.id) },
                      { label: "تعديل الجهة", icon: Pencil, onSelect: () => edit(row) },
                      { label: "حذف الجهة", icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => void remove(row) },
                    ]} />
                  </div>
                  </div>
                  {density === "detailed" || expandedId === row.id ? (
                    <div className="mt-3 grid gap-2 border-t border-dashed border-border pt-3 text-[11px] text-muted-foreground sm:grid-cols-2">
                      <p><span className="font-semibold text-[var(--ink)]">المسؤول:</span> {row.contactPerson || "—"}</p>
                      <p dir="ltr"><span className="font-semibold text-[var(--ink)]">{row.phone ? "TEL" : "EMAIL"}:</span> {row.phone || row.email || "—"}</p>
                      <p><span className="font-semibold text-[var(--ink)]">إعدادات الشراء:</span> {row.defaultCurrency ?? "دولار"} · <span dir="ltr">{row.defaultExchangeRate ?? 3.75}</span></p>
                      {row.notes ? <p className="sm:col-span-2"><span className="font-semibold text-[var(--ink)]">ملاحظات:</span> {row.notes}</p> : null}
                      <div className="sm:col-span-2" onClick={(event) => event.stopPropagation()}><AttachmentsPanel entityId={row.id} compact onChanged={() => void load()} /></div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <Dialog open={viewRow !== null} onOpenChange={(o) => !o && setViewRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-[var(--ink)]">
              {viewRow?.name ?? ""}
            </DialogTitle>
            <DialogDescription>
              {viewRow ? kindLabel(viewRow.kind) : ""} — بطاقة الجهة
            </DialogDescription>
          </DialogHeader>
          {viewRow ? (
            <div className="space-y-0.5">
              {[
                { k: "الدولة", v: viewRow.country },
                { k: "المدينة", v: viewRow.city },
                { k: "الشخص المسؤول", v: viewRow.contactPerson },
                { k: "الهاتف", v: viewRow.phone, ltr: true },
                { k: "البريد", v: viewRow.email, ltr: true },
                { k: "الأصناف المرتبطة", v: String(linkedCount), ltr: true },
                { k: "إعدادات الشراء", v: `${viewRow.defaultCurrency ?? "دولار"} · ${viewRow.defaultExchangeRate ?? 3.75}`, ltr: true },
                { k: "آخر تحديث", v: formatDateTime(viewRow.updatedAt), ltr: true },
              ].map((f) => (
                <div
                  key={f.k}
                  className="flex items-center justify-between gap-3 border-b border-border/70 py-2"
                >
                  <span className="text-xs text-muted-foreground">{f.k}</span>
                  <span
                    className="text-sm text-[var(--ink)]"
                    dir={f.ltr ? "ltr" : undefined}
                  >
                    {f.v || "—"}
                  </span>
                </div>
              ))}
              {viewRow.notes ? (
                <div className="pt-3">
                  <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
                  <p className="rounded bg-secondary/50 px-3 py-2 text-sm">{viewRow.notes}</p>
                </div>
              ) : null}
              <div className="pt-3">
                <AttachmentsPanel entityId={viewRow.id} compact />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  className="flex-1"
                  onClick={() => {
                    edit(viewRow);
                    setViewRow(null);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  تعديل
                </Button>
                <Button variant="outline" className="bg-card" onClick={() => setViewRow(null)}>
                  إغلاق
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
