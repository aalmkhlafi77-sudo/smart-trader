/**
 * التقارير الذكية — اتجاه التصميم: «دفتر الميناء».
 * كل سطر يجمع الصنف بجهته ومواصفاته وأسعاره وآخر تكلفة محسوبة،
 * ويبقى التحليل محلياً ومتوافقاً مع طبقة SQLite المستقبلية.
 */

import AppLayout from "@/components/AppLayout";
import CargoDecisionReports from "@/components/CargoDecisionReports";
import { useLanguage } from "@/contexts/LanguageContext";
import EmptyHint from "@/components/EmptyHint";
import SectionCard from "@/components/SectionCard";
import { Badge } from "@/components/ui/badge";
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
import {
  db,
  type EntityRow,
  type ItemPriceRow,
  type ItemRow,
  type ItemSpecRow,
  type PricingRunRow,
  type SpecTemplateRow,
} from "@/lib/db";
import { exportExcel, exportPdf } from "@/lib/exporters";
import { formatDate, formatMoney, formatNumber } from "@/lib/pricing";
import { ArrowDownAZ, ArrowDownUp, ChartNoAxesCombined, FileDown, FileSpreadsheet, FilterX, Printer, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SortKey =
  | "createdAt"
  | "item"
  | "supplierPrice"
  | "unitCost"
  | "suggestedPrice"
  | "margin"
  | "weight";
type Direction = "asc" | "desc";

interface ReportRow {
  item: ItemRow;
  entity: EntityRow | null;
  specs: ItemSpecRow[];
  weight: string;
  material: string;
  type: string;
  supplierPrice: number | null;
  unitCost: number | null;
  suggestedPrice: number | null;
  margin: number | null;
  costCurrency: string;
}

const lookupSpec = (specs: ItemSpecRow[], labels: string[]) => {
  const found = specs.find((s) => labels.some((label) => s.label.trim().includes(label)));
  return found ? `${found.value} ${found.unit}`.trim() : "—";
};

const extractNumber = (value: string) => {
  const found = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return found ? Number(found[0]) : 0;
};

export default function Reports() {
  const { t } = useLanguage();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [prices, setPrices] = useState<ItemPriceRow[]>([]);
  const [runs, setRuns] = useState<PricingRunRow[]>([]);
  const [specTemplates, setSpecTemplates] = useState<SpecTemplateRow[]>([]);
  const [specsByItem, setSpecsByItem] = useState<Record<string, ItemSpecRow[]>>({});
  const [entityId, setEntityId] = useState("all");
  const [entityKind, setEntityKind] = useState("all");
  const [category, setCategory] = useState("all");
  const [weight, setWeight] = useState("");
  const [material, setMaterial] = useState("");
  const [type, setType] = useState("");
  const [supplierMin, setSupplierMin] = useState("");
  const [supplierMax, setSupplierMax] = useState("");
  const [costMin, setCostMin] = useState("");
  const [costMax, setCostMax] = useState("");
  const [saleMin, setSaleMin] = useState("");
  const [saleMax, setSaleMax] = useState("");
  const [marginMin, setMarginMin] = useState("");
  const [marginMax, setMarginMax] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [direction, setDirection] = useState<Direction>("desc");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await db.init();
      const [itemList, entityList, priceList, runList, templateList] = await Promise.all([
        db.listItems(),
        db.listEntities(),
        db.listPrices(),
        db.listPricingRuns(),
        db.listSpecTemplates(),
      ]);
      const specs: Record<string, ItemSpecRow[]> = {};
      for (const item of itemList) specs[item.id] = await db.listSpecsByItem(item.id);
      if (cancelled) return;
      setItems(itemList);
      setEntities(entityList);
      setPrices(priceList);
      setRuns(runList);
      setSpecTemplates(templateList);
      setSpecsByItem(specs);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")),
    [items],
  );

  const rows = useMemo<ReportRow[]>(() => {
    const templateFor = (label: string, category: string) =>
      specTemplates.find((template) => template.label === label && template.category === category) ??
      specTemplates.find((template) => template.label === label && template.category === "");
    return items.map((item) => {
      const specs = [...(specsByItem[item.id] ?? [])]
        .filter((spec) => templateFor(spec.label, item.category)?.showInReports !== 0)
        .sort((a, b) => (templateFor(a.label, item.category)?.sortOrder ?? 10000 + a.sortOrder) - (templateFor(b.label, item.category)?.sortOrder ?? 10000 + b.sortOrder));
      const price = prices.find((row) => row.itemId === item.id);
      const latest = runs
        .filter((run) => run.itemId === item.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return {
        item,
        entity: entities.find((entity) => entity.id === item.entityId) ?? null,
        specs,
        weight: lookupSpec(specs, ["وزن", "جرام", "غرام"]),
        material: lookupSpec(specs, ["خامة", "مادة", "خيط"]),
        type: lookupSpec(specs, ["نوع"]),
        supplierPrice: price?.price1 ?? null,
        unitCost: latest?.unitCost ?? null,
        suggestedPrice: latest?.suggestedPrice ?? null,
        margin: latest ? latest.marginRate * 100 : null,
        costCurrency: latest?.currency ?? item.currency,
      };
    });
  }, [entities, items, prices, runs, specTemplates, specsByItem]);

  const filtered = useMemo(() => {
    const includes = (actual: string, query: string) =>
      !query.trim() || actual.toLowerCase().includes(query.trim().toLowerCase());
    const withinRange = (value: number | null, minText: string, maxText: string) => {
      const min = minText.trim() === "" ? null : Number(minText);
      const max = maxText.trim() === "" ? null : Number(maxText);
      if (min == null && max == null) return true;
      if (value == null) return false;
      if (min != null && (!Number.isFinite(min) || value < min)) return false;
      if (max != null && (!Number.isFinite(max) || value > max)) return false;
      return true;
    };
    const result = rows.filter((row) => {
      if (entityId !== "all" && row.item.entityId !== entityId) return false;
      if (entityKind !== "all" && row.entity?.kind !== entityKind) return false;
      if (category !== "all" && row.item.category !== category) return false;
      if (!includes(row.weight, weight)) return false;
      if (!includes(row.material, material)) return false;
      if (!includes(row.type, type)) return false;
      if (!withinRange(row.supplierPrice, supplierMin, supplierMax)) return false;
      if (!withinRange(row.unitCost, costMin, costMax)) return false;
      if (!withinRange(row.suggestedPrice, saleMin, saleMax)) return false;
      if (!withinRange(row.margin, marginMin, marginMax)) return false;
      return true;
    });
    const valueFor = (row: ReportRow): string | number => {
      if (sortKey === "item") return row.item.name;
      if (sortKey === "createdAt") return row.item.createdAt;
      if (sortKey === "supplierPrice") return row.supplierPrice ?? -1;
      if (sortKey === "unitCost") return row.unitCost ?? -1;
      if (sortKey === "suggestedPrice") return row.suggestedPrice ?? -1;
      if (sortKey === "margin") return row.margin ?? -1;
      return extractNumber(row.weight);
    };
    return result.sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      const base = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv, "ar") : Number(av) - Number(bv);
      return direction === "asc" ? base : -base;
    });
  }, [category, costMax, costMin, direction, entityId, entityKind, marginMax, marginMin, material, rows, saleMax, saleMin, sortKey, supplierMax, supplierMin, type, weight]);

  const summary = useMemo(() => {
    const withCost = filtered.filter((r) => r.unitCost != null);
    const avg = (values: number[]) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return {
      count: filtered.length,
      avgSupplier: avg(filtered.flatMap((r) => (r.supplierPrice == null ? [] : [r.supplierPrice]))),
      avgCost: avg(withCost.flatMap((r) => (r.unitCost == null ? [] : [r.unitCost]))),
      avgMargin: avg(withCost.flatMap((r) => (r.margin == null ? [] : [r.margin]))),
    };
  }, [filtered]);

  const resetFilters = () => {
    setEntityId("all");
    setEntityKind("all");
    setCategory("all");
    setWeight("");
    setMaterial("");
    setType("");
    setSupplierMin("");
    setSupplierMax("");
    setCostMin("");
    setCostMax("");
    setSaleMin("");
    setSaleMax("");
    setMarginMin("");
    setMarginMax("");
    setSortKey("createdAt");
    setDirection("desc");
  };

  const reportTable = useMemo(() => ({
    header: ["الصنف", "الجهة", "التصنيف", "الوزن", "الخامة", "النوع", "سعر المورد الأصلي", "عملة المورد", "تكلفة الوحدة", "سعر البيع", "هامش الربح", "تاريخ الإضافة"],
    body: filtered.map((row) => [
      row.item.name,
      row.entity?.name ?? "—",
      row.item.category || "—",
      row.weight,
      row.material,
      row.type,
      row.supplierPrice == null ? "—" : formatNumber(row.supplierPrice),
      row.item.currency,
      row.unitCost == null ? "—" : `${formatNumber(row.unitCost)} ${row.costCurrency}`,
      row.suggestedPrice == null ? "—" : `${formatNumber(row.suggestedPrice)} ${row.costCurrency}`,
      row.margin == null ? "—" : `${formatNumber(row.margin)}%`,
      formatDate(row.item.createdAt),
    ]),
  }), [filtered]);

  const exportReportExcel = () => {
    exportExcel({ sheetName: "التقارير", header: reportTable.header, rows: reportTable.body, fileName: "تقرير-التاجر-الذكي" });
  };

  const exportReportPdf = () => {
    exportPdf({
      title: "تقرير التاجر الذكي",
      subtitle: "كشف الأصناف والجهات والمواصفات والأسعار",
      meta: [`عدد النتائج: ${filtered.length}`, `تاريخ التقرير: ${formatDate(new Date().toISOString())}`],
      header: reportTable.header,
      rows: reportTable.body,
      landscape: true,
      footerNote: "سعر المورد ظاهر بعملته الأصلية كما سُجّل للصنف، ولا تُحوّل هذه القيمة إلى العملة المحلية.",
    });
  };

  return (
    <AppLayout title={t("reports.title")} subtitle={t("reports.localSubtitle")} >
      <div className="space-y-5">
        <CargoDecisionReports />
        <SectionCard
          title="مرشحات التقرير"
          hint="اختر المعلومات التي تريد مقارنتها ثم رتّب النتائج"
          stamp="محرك التقارير"
          action={
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant="outline" className="bg-card" onClick={exportReportExcel} disabled={filtered.length === 0}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </Button>
              <Button size="sm" variant="outline" className="bg-card" onClick={exportReportPdf} disabled={filtered.length === 0}>
                <Printer className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button size="sm" variant="outline" className="bg-card" onClick={resetFilters}>
                <FilterX className="h-3.5 w-3.5" />
                مسح
              </Button>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5">
              <Label>الجهة</Label>
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger className="field-input w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الجهات</SelectItem>
                  {entities.map((entity) => <SelectItem key={entity.id} value={entity.id}>{entity.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>نوع الجهة</Label>
              <Select value={entityKind} onValueChange={setEntityKind}>
                <SelectTrigger className="field-input w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  <SelectItem value="supplier">الموردون</SelectItem>
                  <SelectItem value="factory">المصانع</SelectItem>
                  <SelectItem value="customer">العملاء</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>التصنيف</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="field-input w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل التصنيفات</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>الوزن</Label><Input className="field-input" placeholder="مثال: 2000" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>الخامة</Label><Input className="field-input" placeholder="مثال: بولي بروبلين" value={material} onChange={(e) => setMaterial(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>النوع</Label><Input className="field-input" placeholder="مثال: سوبر شرنك" value={type} onChange={(e) => setType(e.target.value)} /></div>
          </div>
          <div className="mt-3 rounded border border-border bg-secondary/40 p-3">
            <p className="mb-2 text-xs font-semibold text-[var(--ink)]">نطاقات الأسعار والنتائج</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "سعر الشراء / المورد", min: supplierMin, max: supplierMax, setMin: setSupplierMin, setMax: setSupplierMax, suffix: "حسب عملة الصنف" },
                { label: "تكلفة الوحدة", min: costMin, max: costMax, setMin: setCostMin, setMax: setCostMax, suffix: "حسب آخر حساب" },
                { label: "سعر البيع", min: saleMin, max: saleMax, setMin: setSaleMin, setMax: setSaleMax, suffix: "حسب آخر حساب" },
                { label: "هامش الربح %", min: marginMin, max: marginMax, setMin: setMarginMin, setMax: setMarginMax, suffix: "نسبة مئوية" },
              ].map((field) => (
                <div key={field.label} className="space-y-1">
                  <Label className="text-[11px]">{field.label}</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Input className="field-input" dir="ltr" inputMode="decimal" placeholder="من" value={field.min} onChange={(e) => field.setMin(e.target.value)} />
                    <Input className="field-input" dir="ltr" inputMode="decimal" placeholder="إلى" value={field.max} onChange={(e) => field.setMax(e.target.value)} />
                  </div>
                  <p className="text-[9px] text-muted-foreground">{field.suffix}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end rounded border border-border bg-secondary/40 p-3">
            <div className="space-y-1.5">
              <Label>ترتيب حسب</Label>
              <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                <SelectTrigger className="bg-card w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">تاريخ الإضافة</SelectItem>
                  <SelectItem value="item">اسم الصنف</SelectItem>
                  <SelectItem value="weight">الوزن</SelectItem>
                  <SelectItem value="supplierPrice">سعر المورد</SelectItem>
                  <SelectItem value="unitCost">التكلفة</SelectItem>
                  <SelectItem value="suggestedPrice">سعر البيع</SelectItem>
                  <SelectItem value="margin">هامش الربح</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الاتجاه</Label>
              <Select value={direction} onValueChange={(value) => setDirection(value as Direction)}>
                <SelectTrigger className="bg-card w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">تنازلياً</SelectItem>
                  <SelectItem value="asc">تصاعدياً</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex h-10 items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" />
              {filtered.length} نتيجة
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "الأصناف المطابقة", value: formatNumber(summary.count), suffix: "صنف" },
            { label: "متوسط سعر المورد", value: formatNumber(summary.avgSupplier), suffix: "حسب عملة الصنف" },
            { label: "متوسط تكلفة الوحدة", value: formatNumber(summary.avgCost), suffix: "آخر حساب محفوظ" },
            { label: "متوسط هامش الربح", value: formatNumber(summary.avgMargin), suffix: "%" },
          ].map((card) => (
            <div key={card.label} className="ledger-card border-r-[3px] border-r-[var(--port-green)] p-4">
              <p className="text-[11px] text-muted-foreground">{card.label}</p>
              <p className="ledger-figure mt-1 text-xl text-[var(--ink)]" dir="ltr">{card.value}</p>
              <p className="text-[10px] text-muted-foreground">{card.suffix}</p>
            </div>
          ))}
        </div>

        <SectionCard title="نتائج التقرير" hint="سجل قابل للمقارنة حسب المرشحات المختارة" stamp="كشف تحليلي">
          {filtered.length === 0 ? (
            <EmptyHint text="لا توجد نتائج مطابقة. عدّل المرشحات أو أضف أصنافاً وحسابات تكلفة." />
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {filtered.map((row) => (
                  <div key={row.item.id} className="rounded border border-border bg-card p-3">
                    <div className="flex justify-between gap-3"><p className="font-semibold text-[var(--ink)]">{row.item.name}</p><Badge variant="outline">{row.item.category || "بدون تصنيف"}</Badge></div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{row.entity?.name ?? "غير مرتبط بجهة"} · {row.weight} · {row.material} · النوع: {row.type}</p>
                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                      <div className="rounded bg-secondary/70 p-1.5"><p className="text-[9px] text-muted-foreground">المورد الأصلي</p><p className="ledger-figure text-xs" dir="ltr">{row.supplierPrice == null ? "—" : formatMoney(row.supplierPrice, row.item.currency)}</p></div>
                      <div className="rounded bg-[var(--port-green-soft)] p-1.5"><p className="text-[9px] text-muted-foreground">التكلفة</p><p className="ledger-figure text-xs" dir="ltr">{row.unitCost == null ? "—" : formatNumber(row.unitCost)}</p></div>
                      <div className="rounded bg-[var(--port-green-soft)] p-1.5"><p className="text-[9px] text-muted-foreground">البيع</p><p className="ledger-figure text-xs" dir="ltr">{row.suggestedPrice == null ? "—" : formatNumber(row.suggestedPrice)}</p></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto touch-pan-x scrollbar-ledger">
                <table className="w-full min-w-[1040px] text-right text-sm">
                  <thead><tr className="border-b-2 border-[var(--ink)]/30 text-[11px] text-muted-foreground">
                    {["الصنف", "الجهة", "التصنيف", "الوزن", "الخامة", "النوع", "سعر المورد", "التكلفة", "سعر البيع", "الهامش", "تاريخ الإضافة"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3 font-semibold">{heading}</th>)}
                  </tr></thead>
                  <tbody>{filtered.map((row) => <tr key={row.item.id} className="border-b border-border/70 hover:bg-secondary/40">
                    <td className="px-3 py-3 font-semibold text-[var(--ink)]">{row.item.name}</td>
                    <td className="px-3 py-3">{row.entity?.name ?? "—"}</td><td className="px-3 py-3">{row.item.category || "—"}</td><td className="px-3 py-3" dir="ltr">{row.weight}</td><td className="px-3 py-3">{row.material}</td><td className="px-3 py-3">{row.type}</td>
                    <td className="ledger-figure px-3 py-3" dir="ltr">{row.supplierPrice == null ? "—" : formatMoney(row.supplierPrice, row.item.currency)}</td>
                    <td className="ledger-figure px-3 py-3" dir="ltr">{row.unitCost == null ? "—" : formatMoney(row.unitCost, row.costCurrency)}</td>
                    <td className="ledger-figure px-3 py-3 font-semibold text-[var(--ink)]" dir="ltr">{row.suggestedPrice == null ? "—" : formatMoney(row.suggestedPrice, row.costCurrency)}</td>
                    <td className="ledger-figure px-3 py-3" dir="ltr">{row.margin == null ? "—" : `${formatNumber(row.margin)}%`}</td><td className="px-3 py-3" dir="ltr">{formatDate(row.item.createdAt)}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </SectionCard>
        <div className="flex items-start gap-2 rounded border border-border bg-secondary/40 px-3 py-2.5 text-[11px] text-muted-foreground">
          <ChartNoAxesCombined className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink)]/70" />
          <p>تُستخرج التكلفة وسعر البيع من آخر عملية حساب محفوظة لكل صنف، أما سعر المورد فيأخذ السعر 1 المسجل للصنف. جميع البيانات تبقى على جهازك.</p>
        </div>
      </div>
    </AppLayout>
  );
}
