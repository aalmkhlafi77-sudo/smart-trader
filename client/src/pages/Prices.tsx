/**
 * شاشة الأسعار — اتجاه التصميم: "دفتر الميناء"
 * أربعة أسعار يدوية لكل صنف، ولكل سعر تاريخ اعتماد يدخله المستخدم بنفسه.
 */

import AppLayout from "@/components/AppLayout";
import EnglishDatePicker from "@/components/EnglishDatePicker";
import { useLanguage } from "@/contexts/LanguageContext";
import EmptyHint from "@/components/EmptyHint";
import { DensityToggle, RecordMenu, useRecordDensity } from "@/components/RecordControls";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
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
import { db, type ItemPriceRow, type ItemRow, type ItemSpecRow, type PriceHistoryRow, type SpecTemplateRow } from "@/lib/db";
import { exportExcel, exportPdf } from "@/lib/exporters";
import { newId, nowIso, todayInput } from "@/lib/id";
import { formatDate, formatNumber } from "@/lib/pricing";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import { ChevronDown, FileDown, Pencil, Printer, Save, Star } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface PriceDraft {
  price: string;
  date: string;
}

const createEmptyDrafts = (): PriceDraft[] => Array.from({ length: 4 }, () => ({ price: "", date: todayInput() }));

const toNum = (v: string) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export default function Prices() {
  const { t } = useLanguage();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [prices, setPrices] = useState<ItemPriceRow[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRow[]>([]);
  const [specTemplates, setSpecTemplates] = useState<SpecTemplateRow[]>([]);
  const [keySpecs, setKeySpecs] = useState<Record<string, ItemSpecRow[]>>({});
  /** جميع المواصفات، وتُستخدم للتصدير حيث يأخذ كل وصف عموداً مستقلاً */
  const [allSpecsByItem, setAllSpecsByItem] = useState<Record<string, ItemSpecRow[]>>({});
  const [selectedId, setSelectedId, clearSelectedDraft] = useSessionDraft<string>("smart-trader:draft:prices-item", "");
  const [itemSearch, setItemSearch, clearSearchDraft] = useSessionDraft("smart-trader:draft:prices-search", "");
  const [drafts, setDrafts, clearPriceDrafts] = useSessionDraft<PriceDraft[]>("smart-trader:draft:prices-values", createEmptyDrafts());
  const [notes, setNotes, clearNotesDraft] = useSessionDraft("smart-trader:draft:prices-notes", "");
  const [customsRate, setCustomsRate, clearCustomsRateDraft] = useSessionDraft("smart-trader:draft:prices-customs-rate", "");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [density, setDensity] = useRecordDensity();
  const restoredDraft = useRef(drafts.some((draft) => draft.price || draft.date) || Boolean(notes) || Boolean(customsRate));

  const load = async () => {
    await db.init();
    const [itemList, priceList, templateList, historyList] = await Promise.all([db.listItems(), db.listPrices(), db.listSpecTemplates(), db.listPriceHistory()]);
    const sorted = [...itemList].sort((a, b) => a.name.localeCompare(b.name, "ar"));
    setItems(sorted);
    setPrices(priceList);
    setPriceHistory(historyList);
    setSpecTemplates(templateList);
    const templateFor = (label: string, category: string) =>
      templateList.find((template) => template.label === label && template.category === category) ??
      templateList.find((template) => template.label === label && template.category === "");
    const orderSpecs = (specs: ItemSpecRow[], area: "prices" | "export", category: string) =>
      specs
        .filter((spec) => {
          const template = templateFor(spec.label, category);
          return area === "prices" ? template?.showInPrices !== 0 : template?.showInExport !== 0;
        })
        .sort((a, b) => (templateFor(a.label, category)?.sortOrder ?? 10000 + a.sortOrder) - (templateFor(b.label, category)?.sortOrder ?? 10000 + b.sortOrder));
    const map: Record<string, ItemSpecRow[]> = {};
    const allMap: Record<string, ItemSpecRow[]> = {};
    for (const it of sorted) {
      const all = await db.listSpecsByItem(it.id);
      allMap[it.id] = orderSpecs(all, "export", it.category);
      const visible = orderSpecs(all, "prices", it.category);
      const keys = visible.filter((s) => s.isKey === 1 || templateFor(s.label, it.category)?.isKeyDefault === 1);
      // إن لم يميّز المستخدم أي مواصفة، تُعرض أول مواصفتين كمرجع للمقارنة
      map[it.id] = keys.length > 0 ? keys : visible.slice(0, 2);
    }
    setKeySpecs(map);
    setAllSpecsByItem(allMap);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (restoredDraft.current) {
      restoredDraft.current = false;
      return;
    }
    if (!selectedId) {
      setDrafts(createEmptyDrafts());
      setNotes("");
      setCustomsRate("");
      return;
    }
    let cancelled = false;
    (async () => {
      const row = await db.getPriceByItem(selectedId);
      if (cancelled) return;
      const item = items.find((candidate) => candidate.id === selectedId);
      setCustomsRate(item?.customsRate == null ? "" : String(item.customsRate * 100));
      if (!row) {
        setDrafts(createEmptyDrafts());
        setNotes("");
        return;
      }
      setDrafts([
        { price: row.price1?.toString() ?? "", date: row.price1Date || todayInput() },
        { price: row.price2?.toString() ?? "", date: row.price2Date || todayInput() },
        { price: row.price3?.toString() ?? "", date: row.price3Date || todayInput() },
        { price: row.price4?.toString() ?? "", date: row.price4Date || todayInput() },
      ]);
      setNotes(row.notes);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const newWork = () => {
    clearSelectedDraft();
    clearSearchDraft();
    clearPriceDrafts();
    clearNotesDraft();
    clearCustomsRateDraft();
    setDrafts(createEmptyDrafts());
    toast.info(t("prices.draftCleared"));
  };

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;
  const matchingItems = items.filter((item) =>
    [item.name, item.code, item.category].join(" ").toLowerCase().includes(itemSearch.trim().toLowerCase()),
  );
  const normalizedDrafts = drafts.map((draft) => ({ ...draft, date: draft.date || todayInput() }));

  const save = async () => {
    if (!selectedItem) {
      toast.error(t("prices.selectFirst"));
      return;
    }
    const customsRateValue = customsRate.trim() === "" ? null : toNum(customsRate);
    if (customsRate.trim() !== "" && (customsRateValue == null || customsRateValue < 0)) {
      toast.error("أدخل نسبة جمارك صالحة أو اترك الحقل فارغاً");
      return;
    }
    const existing = await db.getPriceByItem(selectedItem.id);
    const row: ItemPriceRow = {
      id: existing?.id ?? newId("prc"),
      itemId: selectedItem.id,
      price1: toNum(normalizedDrafts[0].price),
      price1Date: normalizedDrafts[0].date,
      price2: toNum(normalizedDrafts[1].price),
      price2Date: normalizedDrafts[1].date,
      price3: toNum(normalizedDrafts[2].price),
      price3Date: normalizedDrafts[2].date,
      price4: toNum(normalizedDrafts[3].price),
      price4Date: normalizedDrafts[3].date,
      currency: selectedItem.currency,
      notes: notes.trim(),
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    await db.savePrice(row);
    await db.saveItem({ ...selectedItem, customsRate: customsRateValue == null ? null : customsRateValue / 100, updatedAt: nowIso() });
    const before = [existing?.price1 ?? null, existing?.price2 ?? null, existing?.price3 ?? null, existing?.price4 ?? null];
    const beforeDates = [existing?.price1Date ?? "", existing?.price2Date ?? "", existing?.price3Date ?? "", existing?.price4Date ?? ""];
    const after = [row.price1, row.price2, row.price3, row.price4];
    const afterDates = [row.price1Date, row.price2Date, row.price3Date, row.price4Date];
    await Promise.all(after.map((value, index) => {
      if (value == null || (before[index] === value && beforeDates[index] === afterDates[index])) return Promise.resolve();
      return db.savePriceHistory({
        id: newId("hist"), itemId: selectedItem.id, priceLevel: (index + 1) as 1 | 2 | 3 | 4,
        price: value, effectiveDate: afterDates[index] || nowIso().slice(0, 10), currency: row.currency,
        notes: row.notes, createdAt: nowIso(),
      });
    }));
    toast.success(t("prices.saved"));
    await load();
  };

  const priceRowFor = (itemId: string) => prices.find((p) => p.itemId === itemId) ?? null;
  const historyFor = (itemId: string) => priceHistory.filter((row) => row.itemId === itemId);

  const editPrices = (itemId: string) => {
    setSelectedId(itemId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const specSummary = (itemId: string) =>
    (keySpecs[itemId] ?? [])
      .map((s) => `${s.label}: ${s.value} ${s.unit}`.trim())
      .join(" | ");

  /** PDF يحتفظ بملخص موجز للمواصفات حتى تبقى الصفحة مقروءة عند الطباعة. */
  const buildPdfTable = () => {
    const header = [
      t("common.item"), t("prices.specifications"), t("common.currency"),
      `${t("prices.price")} 1`, `${t("prices.date")} 1`,
      `${t("prices.price")} 2`, `${t("prices.date")} 2`,
      `${t("prices.price")} 3`, `${t("prices.date")} 3`,
      `${t("prices.price")} 4`, `${t("prices.date")} 4`,
    ];
    const body = items.map((it) => {
      const p = priceRowFor(it.id);
      return [
        it.name,
        specSummary(it.id) || "—",
        it.currency,
        p?.price1 == null ? "—" : formatNumber(p.price1),
        p?.price1Date ? formatDate(p.price1Date) : "—",
        p?.price2 == null ? "—" : formatNumber(p.price2),
        p?.price2Date ? formatDate(p.price2Date) : "—",
        p?.price3 == null ? "—" : formatNumber(p.price3),
        p?.price3Date ? formatDate(p.price3Date) : "—",
        p?.price4 == null ? "—" : formatNumber(p.price4),
        p?.price4Date ? formatDate(p.price4Date) : "—",
      ];
    });
    return { header, body };
  };

  /** Excel: كل اسم مواصفة يصبح عموداً مستقلاً ليسهل الفرز والمقارنة. */
  const buildExcelTable = () => {
    const specColumns = Array.from(
      new Set(
        Object.values(allSpecsByItem).flatMap((specs) =>
          specs.map((spec) => spec.label.trim()).filter(Boolean),
        ),
      ),
    ).sort((a, b) => a.localeCompare(b, "ar"));
    const header = [
      t("common.item"), t("common.category"), t("common.currency"), ...specColumns,
      `${t("prices.price")} 1`, `${t("prices.date")} 1`, `${t("prices.price")} 2`, `${t("prices.date")} 2`,
      `${t("prices.price")} 3`, `${t("prices.date")} 3`, `${t("prices.price")} 4`, `${t("prices.date")} 4`,
    ];
    const body = items.map((it) => {
      const p = priceRowFor(it.id);
      const values = (allSpecsByItem[it.id] ?? []).reduce<Record<string, string>>((acc, spec) => {
        const value = `${spec.value} ${spec.unit}`.trim();
        acc[spec.label] = acc[spec.label] ? `${acc[spec.label]} | ${value}` : value;
        return acc;
      }, {});
      return [
        it.name, it.category || "—", it.currency,
        ...specColumns.map((column) => values[column] || "—"),
        p?.price1 == null ? "—" : formatNumber(p.price1), p?.price1Date ? formatDate(p.price1Date) : "—",
        p?.price2 == null ? "—" : formatNumber(p.price2), p?.price2Date ? formatDate(p.price2Date) : "—",
        p?.price3 == null ? "—" : formatNumber(p.price3), p?.price3Date ? formatDate(p.price3Date) : "—",
        p?.price4 == null ? "—" : formatNumber(p.price4), p?.price4Date ? formatDate(p.price4Date) : "—",
      ];
    });
    return { header, body };
  };

  const toExcel = () => {
    if (items.length === 0) {
      toast.error(t("prices.noItemsExport"));
      return;
    }
    const { header, body } = buildExcelTable();
    exportExcel({
      sheetName: t("prices.sheetName"),
      header,
      rows: body,
      fileName: `${t("prices.fileName")}-${formatDate(new Date())}`,
    });
    toast.success(t("prices.excelExported"));
  };

  const toPdf = () => {
    if (items.length === 0) {
      toast.error(t("prices.noItemsExport"));
      return;
    }
    const { header, body } = buildPdfTable();
    const ok = exportPdf({
      title: t("prices.pdfTitle"),
      subtitle: t("prices.pdfSubtitle"),
      meta: [`${t("prices.itemCount")}: ${items.length}`, `${t("prices.issueDate")}: ${formatDate(new Date())}`],
      header,
      rows: body,
      footerNote:
        t("prices.pdfNote"),
    });
    if (!ok) {
      toast.error(t("prices.printFailed"));
      return;
    }
    toast.success(t("prices.pdfReady"));
  };

  return (
    <AppLayout title={t("prices.title")} subtitle={t("prices.subtitle")}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr] items-start">
        <SectionCard
          title="تسجيل الأسعار"
          hint="التاريخ يعني بداية اعتماد هذا السعر"
          stamp="قيد سعر"
          action={
            <Button size="sm" variant="outline" className="bg-card" onClick={newWork}>
              <FileDown className="h-3.5 w-3.5 rotate-180" />
              عمل جديد
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>الصنف</Label>
              <Input
                className="field-input"
                placeholder="ابحث بالاسم أو الكود أو التصنيف..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
              />
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="field-input w-full">
                  <SelectValue placeholder="اختر الصنف" />
                </SelectTrigger>
                <SelectContent>
                  {items.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      لا توجد أصناف مسجلة
                    </SelectItem>
                  ) : matchingItems.length === 0 ? (
                    <SelectItem value="no-match" disabled>
                      لا توجد أصناف مطابقة للبحث
                    </SelectItem>
                  ) : (
                    matchingItems.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {normalizedDrafts.map((d, idx) => (
                <div key={idx} className="rounded border border-border bg-secondary/40 p-2.5">
                  <p className="text-[11px] font-semibold text-[var(--ink)] mb-2">
                    السعر {idx + 1}
                    {selectedItem ? ` — ${selectedItem.currency}` : ""}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      className="field-input"
                      inputMode="decimal"
                      dir="ltr"
                      placeholder="القيمة"
                      value={d.price}
                      onChange={(e) => {
                        const next = [...drafts];
                        next[idx] = { ...d, price: e.target.value };
                        setDrafts(next);
                      }}
                    />
                    <EnglishDatePicker
                      value={d.date}
                      ariaLabel={`Price level ${idx + 1} effective date`}
                      onChange={(date) => {
                        const next = [...drafts];
                        next[idx] = { ...d, date };
                        setDrafts(next);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prc-customs-rate">{t("items.customsRate")}</Label>
              <Input id="prc-customs-rate" className="field-input" dir="ltr" inputMode="decimal" value={customsRate} onChange={(e) => setCustomsRate(e.target.value)} placeholder="مثال: 12" />
              <p className="form-cluster-note">{t("prices.customsRateHint")}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prc-notes">ملاحظات التفاوض</Label>
              <Textarea
                id="prc-notes"
                className="field-input min-h-20"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: السعر 3 مشروط بكمية حاوية كاملة"
              />
            </div>

            <Button onClick={save} className="form-action-bar w-full" disabled={!selectedItem}>
              <Save className="h-4 w-4" />
              حفظ الأسعار
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="جدول الأسعار المسجلة"
          hint="مقارنة سريعة بين مستويات السعر"
          stamp="كشف الأسعار"
          action={
            <div className="flex gap-1.5">
              <DensityToggle value={density} onChange={setDensity} className="hidden sm:inline-flex" />
              <Button size="sm" variant="outline" className="bg-card" onClick={toExcel}>
                <FileDown className="h-3.5 w-3.5" />
                Excel
              </Button>
              <Button size="sm" variant="outline" className="bg-card" onClick={toPdf}>
                <Printer className="h-3.5 w-3.5" />
                PDF
              </Button>
            </div>
          }
        >
          {items.length === 0 ? (
            <EmptyHint text="لا توجد أصناف. أضف الأصناف أولاً من شاشة الأصناف." />
          ) : (
            <>
            <div className="mb-3 md:hidden">
              <DensityToggle value={density} onChange={setDensity} />
            </div>
            {/* الهاتف: صحائف سجل رأسية بدل الجدول الأفقي */}
            <div className="space-y-3 md:hidden">
              {items.map((it) => {
                const p = priceRowFor(it.id);
                const cells = [
                  { n: 1, v: p?.price1, d: p?.price1Date },
                  { n: 2, v: p?.price2, d: p?.price2Date },
                  { n: 3, v: p?.price3, d: p?.price3Date },
                  { n: 4, v: p?.price4, d: p?.price4Date },
                ];
                return (
                  <div
                    key={it.id}
                    className="record-card cursor-pointer rounded-[0.45rem] p-3"
                    onClick={() => setExpandedId((current) => current === it.id ? null : it.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[var(--ink)]">{it.name}</p>
                        <span className="mt-1 inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px]">{it.currency}{it.customsRate != null ? ` · ${t("items.customsRate")} ${formatNumber(it.customsRate * 100)}` : ""}</span>
                      </div>
                      <div className="action-strip shrink-0" onClick={(event) => event.stopPropagation()}>
                        <RecordMenu actions={[
                          { label: "تعديل الأسعار", icon: Pencil, onSelect: () => editPrices(it.id) },
                          { label: expandedId === it.id ? "طي التفاصيل" : "عرض التفاصيل", icon: ChevronDown, onSelect: () => setExpandedId((current) => current === it.id ? null : it.id) },
                        ]} />
                      </div>
                    </div>
                    {(keySpecs[it.id]?.length ?? 0) > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {keySpecs[it.id].map((s) => (
                          <span
                            key={s.id}
                            className={
                              s.isKey === 1
                                ? "inline-flex items-center gap-1 rounded bg-[var(--port-green-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--ink-deep)]"
                                : "rounded bg-secondary/70 px-1.5 py-0.5 text-[11px] text-secondary-foreground"
                            }
                          >
                            {s.isKey === 1 ? <Star className="h-2.5 w-2.5 fill-current" /> : null}
                            {s.label}:{" "}
                            <span className="ledger-figure" dir="ltr">
                              {s.value}
                            </span>{" "}
                            {s.unit}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-border pt-2.5">
                      {cells.filter((_, index) => density === "detailed" || expandedId === it.id || index < 2).map((c) => (
                        <div
                          key={c.n}
                          className="rounded bg-secondary/40 px-2 py-1.5 flex items-center justify-between gap-2"
                        >
                          <span className="text-[11px] text-muted-foreground">السعر {c.n}</span>
                          <span className="text-left">
                            {c.v == null ? (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            ) : (
                              <>
                                <span className="ledger-figure block text-sm text-[var(--ink)]" dir="ltr">
                                  {formatNumber(c.v)}
                                </span>
                                <span className="block text-[10px] text-muted-foreground" dir="ltr">
                                  {c.d ? formatDate(c.d) : "—"}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                    {density === "detailed" || expandedId === it.id ? (
                      <div className="mt-3 border-t border-dashed border-border pt-3 text-[11px] text-muted-foreground">
                        <p><span className="font-semibold text-[var(--ink)]">التصنيف:</span> {it.category || "—"}</p>
                        {p?.notes ? <p className="mt-1"><span className="font-semibold text-[var(--ink)]">ملاحظات التفاوض:</span> {p.notes}</p> : null}
                        {historyFor(it.id).length ? <p className="mt-1"><span className="font-semibold text-[var(--ink)]">آخر تعديل:</span> السعر {historyFor(it.id)[0].priceLevel} — <span className="ledger-figure" dir="ltr">{formatNumber(historyFor(it.id)[0].price ?? 0)}</span> {historyFor(it.id)[0].currency} — <span dir="ltr">{formatDate(historyFor(it.id)[0].effectiveDate)}</span> ({formatNumber(historyFor(it.id).length)} سجلات)</p> : null}
                        {(allSpecsByItem[it.id]?.length ?? 0) > 0 ? <p className="mt-1"><span className="font-semibold text-[var(--ink)]">كل المواصفات:</span> {allSpecsByItem[it.id].map((spec) => `${spec.label}: ${spec.value} ${spec.unit}`.trim()).join(" · ")}</p> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* الشاشات الأكبر: جدول بشريط تمرير لمسي ظاهر داخل البطاقة */}
            <div className="touch-scroll-x hidden md:block">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b border-border text-right">
                    <th className="py-2 pe-3 font-semibold text-xs text-[var(--ink)]">الصنف</th>
                    <th className="py-2 px-2 font-semibold text-xs text-[var(--ink)]">
                      المواصفات
                    </th>
                    {[1, 2, 3, 4].map((n) => (
                      <th key={n} className="py-2 px-2 font-semibold text-xs text-[var(--ink)]">
                        السعر {n}
                      </th>
                    ))}
                    <th className="py-2 ps-2 font-semibold text-xs text-[var(--ink)]">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const p = priceRowFor(it.id);
                    const cells = [
                      { v: p?.price1, d: p?.price1Date },
                      { v: p?.price2, d: p?.price2Date },
                      { v: p?.price3, d: p?.price3Date },
                      { v: p?.price4, d: p?.price4Date },
                    ];
                    return (
                      <Fragment key={it.id}>
                      <tr className="cursor-pointer border-b border-border/70 align-top hover:bg-secondary/25" onClick={() => setExpandedId((current) => current === it.id ? null : it.id)}>
                        <td className="py-2.5 pe-3">
                          <p className="font-medium text-[13px]">{it.name}</p>
                          <p className="text-[11px] text-muted-foreground">{it.currency}{it.customsRate != null ? ` · ${t("items.customsRate")} ${formatNumber(it.customsRate * 100)}` : ""}</p>
                        </td>
                        <td className="py-2.5 px-2 min-w-[150px]">
                          {(keySpecs[it.id]?.length ?? 0) === 0 ? (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {keySpecs[it.id].map((s) => (
                                <span
                                  key={s.id}
                                  className={
                                    s.isKey === 1
                                      ? "inline-flex items-center gap-1 rounded bg-[var(--port-green-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--ink-deep)]"
                                      : "rounded bg-secondary/70 px-1.5 py-0.5 text-[11px] text-secondary-foreground"
                                  }
                                >
                                  {s.isKey === 1 ? <Star className="h-2.5 w-2.5 fill-current" /> : null}
                                  {s.label}:{" "}
                                  <span className="ledger-figure" dir="ltr">
                                    {s.value}
                                  </span>{" "}
                                  {s.unit}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        {cells.filter((_, index) => density === "detailed" || expandedId === it.id || index < 2).map((c, i) => (
                          <td key={i} className="py-2.5 px-2">
                            {c.v == null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <>
                                <span className="ledger-figure text-[var(--ink)]" dir="ltr">
                                  {formatNumber(c.v)}
                                </span>
                                <span className="block text-[10px] text-muted-foreground" dir="ltr">
                                  {c.d ? formatDate(c.d) : "بدون تاريخ"}
                                </span>
                              </>
                            )}
                          </td>
                        ))}
                        {density === "compact" && expandedId !== it.id ? <td colSpan={2} /> : null}
                        <td className="py-2.5 ps-2" onClick={(event) => event.stopPropagation()}>
                          <div className="action-strip w-fit">
                            <RecordMenu actions={[
                              { label: "تعديل الأسعار", icon: Pencil, onSelect: () => editPrices(it.id) },
                              { label: expandedId === it.id ? "طي التفاصيل" : "عرض التفاصيل", icon: ChevronDown, onSelect: () => setExpandedId((current) => current === it.id ? null : it.id) },
                            ]} />
                          </div>
                        </td>
                      </tr>
                      {density === "detailed" || expandedId === it.id ? (
                        <tr className="border-b border-border/70 bg-secondary/25">
                          <td colSpan={7} className="px-3 py-3 text-[11px] text-muted-foreground">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <p><span className="font-semibold text-[var(--ink)]">التصنيف:</span> {it.category || "—"}</p>
                              <p><span className="font-semibold text-[var(--ink)]">ملاحظات التفاوض:</span> {p?.notes || "—"}</p>
                              {historyFor(it.id).length ? <p><span className="font-semibold text-[var(--ink)]">آخر تعديل:</span> السعر {historyFor(it.id)[0].priceLevel} — <span className="ledger-figure" dir="ltr">{formatNumber(historyFor(it.id)[0].price ?? 0)}</span> {historyFor(it.id)[0].currency} — <span dir="ltr">{formatDate(historyFor(it.id)[0].effectiveDate)}</span> ({formatNumber(historyFor(it.id).length)} سجلات)</p> : null}
                              {(allSpecsByItem[it.id]?.length ?? 0) > 0 ? <p className="sm:col-span-2"><span className="font-semibold text-[var(--ink)]">كل المواصفات:</span> {allSpecsByItem[it.id].map((spec) => `${spec.label}: ${spec.value} ${spec.unit}`.trim()).join(" · ")}</p> : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </SectionCard>
      </div>
    </AppLayout>
  );
}
