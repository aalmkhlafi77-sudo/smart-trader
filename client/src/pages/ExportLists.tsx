/**
 * قوائم التصدير — اتجاه التصميم: "دفتر الميناء"
 * قاعدة إلزامية: التصدير أحادي الاتجاه، ولا تظهر أي تكلفة أو هامش ربح في الملف الصادر.
 */

import AppLayout from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import EmptyHint from "@/components/EmptyHint";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  type ItemPriceRow,
  type ItemRow,
  type ItemSpecRow,
  type PriceLevel,
  type PricingRunRow,
  type SpecTemplateRow,
} from "@/lib/db";
import { exportExcel, exportPdf } from "@/lib/exporters";
import { formatDate, formatNumber } from "@/lib/pricing";
import { AlertTriangle, FileDown, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const LEVELS: PriceLevel[] = [1, 2, 3, 4];
type ExportPriceMode = "supplier" | "cost" | "sale" | "all" | "manual";

const priceModeLabel: Record<ExportPriceMode, string> = {
  supplier: "سعر المورد",
  cost: "سعر التكلفة",
  sale: "سعر البيع",
  all: "جميع الأسعار",
  manual: "سعر مسجل",
};

function priceAtLevel(row: ItemPriceRow | undefined, level: PriceLevel): number | null {
  if (!row) return null;
  if (level === 1) return row.price1;
  if (level === 2) return row.price2;
  if (level === 3) return row.price3;
  return row.price4;
}

export default function ExportLists() {
  const { t } = useLanguage();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [prices, setPrices] = useState<ItemPriceRow[]>([]);
  const [runs, setRuns] = useState<PricingRunRow[]>([]);
  const [specTemplates, setSpecTemplates] = useState<SpecTemplateRow[]>([]);
  const [specs, setSpecs] = useState<Record<string, ItemSpecRow[]>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [itemSearch, setItemSearch] = useState("");
  const [clientName, setClientName] = useState("");
  const [level, setLevel] = useState<PriceLevel>(4);
  const [priceMode, setPriceMode] = useState<ExportPriceMode>("sale");
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await db.init();
      const [itemList, priceList, runList, templateList] = await Promise.all([
        db.listItems(),
        db.listPrices(),
        db.listPricingRuns(),
        db.listSpecTemplates(),
      ]);
      if (cancelled) return;
      const sorted = [...itemList].sort((a, b) => a.name.localeCompare(b.name, "ar"));
      setItems(sorted);
      setPrices(priceList);
      setRuns(runList);
      setSpecTemplates(templateList);
      const settings = await db.getSettings();
      if (!cancelled) setCompanyName(settings.companyName);
      const map: Record<string, ItemSpecRow[]> = {};
      for (const it of sorted) map[it.id] = await db.listSpecsByItem(it.id);
      if (!cancelled) setSpecs(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(
    () => {
      const templateFor = (label: string, category: string) =>
        specTemplates.find((template) => template.label === label && template.category === category) ??
        specTemplates.find((template) => template.label === label && template.category === "");
      return items
        .filter((i) => selected[i.id])
        .map((i) => {
          const itemPrice = prices.find((p) => p.itemId === i.id);
          const latest = runs
            .filter((run) => run.itemId === i.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
          const exportSpecs = [...(specs[i.id] ?? [])]
            .filter((spec) => templateFor(spec.label, i.category)?.showInExport !== 0)
            .sort((a, b) => (templateFor(a.label, i.category)?.sortOrder ?? 10000 + a.sortOrder) - (templateFor(b.label, i.category)?.sortOrder ?? 10000 + b.sortOrder));
          const keys = exportSpecs.filter((spec) => spec.isKey === 1 || templateFor(spec.label, i.category)?.isKeyDefault === 1);
          return {
            item: i,
            manualPrice: priceAtLevel(itemPrice, level),
            supplierPrice: itemPrice?.price1 ?? null,
            unitCost: latest?.unitCost ?? null,
            suggestedPrice: latest?.suggestedPrice ?? null,
            calculatedCurrency: latest?.currency ?? i.currency,
            exportSpecs,
            specSummary: (() => {
            // المواصفات المميزة أو التي عُينت للمقارنة في القالب تظهر أولاً.
            return (keys.length > 0 ? keys : exportSpecs)
              .map((s) => `${s.label}: ${s.value} ${s.unit}`.trim())
              .join(" | ");
          })(),
          };
        });
    },
    [items, prices, runs, specs, specTemplates, selected, level],
  );

  const matchingItems = items.filter((item) =>
    [item.name, item.code, item.category].join(" ").toLowerCase().includes(itemSearch.trim().toLowerCase()),
  );

  /** جدول القائمة الموجهة للعميل أو الاستخدام الداخلي حسب نوع السعر المختار. */
  const buildTable = () => {
    const baseHeader = ["الصنف", "الكود", "المواصفات", "الوحدة"];
    const priceHeaders =
      priceMode === "all"
        ? ["سعر المورد", "سعر التكلفة", "سعر البيع", "العملة"]
        : [priceModeLabel[priceMode], "العملة"];
    const header = [...baseHeader, ...priceHeaders];
    const body = rows.map((r) => {
      const base = [r.item.name, r.item.code || "—", r.specSummary || "—", r.item.unit];
      if (priceMode === "all") {
        return [
          ...base,
          r.supplierPrice == null ? "—" : formatNumber(r.supplierPrice),
          r.unitCost == null ? "—" : formatNumber(r.unitCost),
          r.suggestedPrice == null ? "—" : formatNumber(r.suggestedPrice),
          r.calculatedCurrency,
        ];
      }
      const price =
        priceMode === "supplier"
          ? r.supplierPrice
          : priceMode === "cost"
            ? r.unitCost
            : priceMode === "sale"
              ? r.suggestedPrice
              : r.manualPrice;
      const currency = priceMode === "supplier" || priceMode === "manual" ? r.item.currency : r.calculatedCurrency;
      return [...base, price == null ? "—" : formatNumber(price), currency];
    });
    return { header, body };
  };

  /** ملف Excel تفصيلي: كل مواصفة في عمود مستقل بدلاً من دمجها في خلية واحدة. */
  const buildExcelTable = () => {
    const specColumns = Array.from(
      new Set(
        rows.flatMap((row) =>
          row.exportSpecs.map((spec) => spec.label.trim()).filter(Boolean),
        ),
      ),
    ).sort((a, b) => a.localeCompare(b, "ar"));
    const priceHeaders =
      priceMode === "all"
        ? ["سعر المورد", "سعر التكلفة", "سعر البيع", "العملة"]
        : [priceModeLabel[priceMode], "العملة"];
    const header = ["الصنف", "الكود", "الوحدة", ...specColumns, ...priceHeaders];
    const body = rows.map((row) => {
      const specValues = row.exportSpecs.reduce<Record<string, string>>((acc, spec) => {
        const value = `${spec.value} ${spec.unit}`.trim();
        acc[spec.label] = acc[spec.label] ? `${acc[spec.label]} | ${value}` : value;
        return acc;
      }, {});
      const base = [
        row.item.name,
        row.item.code || "—",
        row.item.unit,
        ...specColumns.map((column) => specValues[column] || "—"),
      ];
      if (priceMode === "all") {
        return [
          ...base,
          row.supplierPrice == null ? "—" : formatNumber(row.supplierPrice),
          row.unitCost == null ? "—" : formatNumber(row.unitCost),
          row.suggestedPrice == null ? "—" : formatNumber(row.suggestedPrice),
          row.calculatedCurrency,
        ];
      }
      const price =
        priceMode === "supplier"
          ? row.supplierPrice
          : priceMode === "cost"
            ? row.unitCost
            : priceMode === "sale"
              ? row.suggestedPrice
              : row.manualPrice;
      const currency =
        priceMode === "supplier" || priceMode === "manual"
          ? row.item.currency
          : row.calculatedCurrency;
      return [...base, price == null ? "—" : formatNumber(price), currency];
    });
    return { header, body };
  };

  const previewColumns =
    priceMode === "all" ? ["سعر المورد", "سعر التكلفة", "سعر البيع"] : [priceModeLabel[priceMode]];
  const previewValues = (row: (typeof rows)[number]) => {
    if (priceMode === "all") {
      return [
        { value: row.supplierPrice, currency: row.item.currency },
        { value: row.unitCost, currency: row.calculatedCurrency },
        { value: row.suggestedPrice, currency: row.calculatedCurrency },
      ];
    }
    const value =
      priceMode === "supplier"
        ? row.supplierPrice
        : priceMode === "cost"
          ? row.unitCost
          : priceMode === "sale"
            ? row.suggestedPrice
            : row.manualPrice;
    return [{ value, currency: priceMode === "supplier" || priceMode === "manual" ? row.item.currency : row.calculatedCurrency }];
  };

  const exportToExcel = () => {
    if (rows.length === 0) {
      toast.error(t("export.selectOne"));
      return;
    }
    const { header, body } = buildExcelTable();
    exportExcel({
      sheetName: t("export.sheetName"),
      header,
      rows: body,
      fileName: `${t("export.fileName")}-${clientName.trim() || t("export.customer")}-${formatDate(new Date())}`,
    });
    toast.success(t("export.excelExported"));
  };

  const exportPdfList = () => {
    if (rows.length === 0) {
      toast.error(t("export.selectOne"));
      return;
    }
    const { header, body } = buildTable();
    const ok = exportPdf({
      title: t("export.pdfTitle"),
      subtitle: companyName || undefined,
      meta: [
        `${t("export.customer")}: ${clientName.trim() || t("export.unspecified")}`,
        `${t("export.priceType")}: ${priceModeLabel[priceMode]}${priceMode === "manual" ? ` ${level}` : ""}`,
        `${t("export.date")}: ${formatDate(new Date())}`,
      ],
      header,
      rows: body,
      footerNote:
        priceMode === "cost" || priceMode === "all"
          ? t("export.internalNote")
          : t("export.shareNote"),
    });
    if (!ok) {
      toast.error(t("export.printFailed"));
      return;
    }
    toast.success(t("export.pdfReady"));
  };

  return (
    <AppLayout title={t("export.title")} subtitle={t("export.subtitle")}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr] items-start">
        <SectionCard
          title="بيانات القائمة"
          hint="اختر العميل ونوع السعر المعروض"
          stamp="ترويسة القائمة"
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ex-client">اسم العميل</Label>
              <Input
                id="ex-client"
                className="field-input"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="مؤسسة الإعمار"
              />
            </div>
            <div className="space-y-1.5">
              <Label>نوع السعر المعروض</Label>
              <Select value={priceMode} onValueChange={(v) => setPriceMode(v as ExportPriceMode)}>
                <SelectTrigger className="field-input w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplier">سعر المورد</SelectItem>
                  <SelectItem value="cost">سعر التكلفة</SelectItem>
                  <SelectItem value="sale">سعر البيع</SelectItem>
                  <SelectItem value="all">جميع الأسعار</SelectItem>
                  <SelectItem value="manual">سعر مسجل (يدوي)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {priceMode === "manual" ? (
              <div className="space-y-1.5">
                <Label>مستوى السعر المسجل</Label>
                <Select value={String(level)} onValueChange={(v) => setLevel(Number(v) as PriceLevel)}>
                  <SelectTrigger className="field-input w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => <SelectItem key={l} value={String(l)}>السعر {l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="flex items-start gap-2 rounded border border-[var(--amber-line)] bg-[var(--amber-field)] px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-[#9a6700]" />
              <p className="text-[11px] leading-relaxed text-[#7a5200]">
                {priceMode === "cost" || priceMode === "all"
                  ? "التصدير يتضمن سعر التكلفة؛ استخدمه داخلياً فقط ولا تشاركه مع العملاء."
                  : "لن تظهر التكاليف أو نسبة الجمارك أو هوامش الربح في الملف المُصدَّر."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={exportToExcel}>
                <FileDown className="h-4 w-4" />
                تصدير Excel
              </Button>
              <Button variant="outline" className="bg-card" onClick={exportPdfList}>
                <Printer className="h-4 w-4" />
                تصدير PDF
              </Button>
            </div>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard
            title="اختيار الأصناف"
            hint={`${t("export.selected")} ${rows.length} ${t("export.items")}`}
            stamp="بنود القائمة"
          >
            {items.length === 0 ? (
              <EmptyHint text="لا توجد أصناف. أضف الأصناف أولاً." />
            ) : (
              <div className="space-y-2">
                <Input
                  className="field-input"
                  placeholder="ابحث بالاسم أو الكود أو التصنيف..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                />
                {matchingItems.length === 0 ? (
                  <EmptyHint text="لا توجد أصناف مطابقة للبحث." />
                ) : (
                <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                {matchingItems.map((it) => {
                  const p = priceAtLevel(prices.find((x) => x.itemId === it.id), level);
                  return (
                    <li
                      key={it.id}
                      className="flex items-center gap-3 rounded border border-border bg-card px-3 py-2.5"
                    >
                      <Checkbox
                        id={`sel-${it.id}`}
                        checked={!!selected[it.id]}
                        onCheckedChange={(v) =>
                          setSelected((prev) => ({ ...prev, [it.id]: v === true }))
                        }
                      />
                      <Label htmlFor={`sel-${it.id}`} className="flex-1 min-w-0 cursor-pointer">
                        <span className="block text-sm font-medium truncate">{it.name}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {it.unit}
                        </span>
                      </Label>
                      <span className="ledger-figure shrink-0 text-sm text-[var(--ink)]" dir="ltr">
                        {priceMode === "supplier"
                          ? (prices.find((x) => x.itemId === it.id)?.price1 ?? "—")
                          : priceMode === "manual"
                            ? (p == null ? "—" : `${p} ${it.currency}`)
                            : priceMode === "cost" || priceMode === "sale"
                              ? "من الحاسبة"
                              : "3 أسعار"}
                      </span>
                    </li>
                  );
                })}
              </ul>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="معاينة القائمة"
            hint={clientName ? `موجهة إلى: ${clientName}` : "أدخل اسم العميل"}
            stamp="نسخة العميل"
          >
            {rows.length === 0 ? (
              <EmptyHint text="لم تُختر أصناف بعد." />
            ) : (
              <div className="touch-scroll-x">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-border text-right">
                      <th className="py-2 pe-3 text-xs font-semibold text-[var(--ink)]">الصنف</th>
                      <th className="py-2 px-2 text-xs font-semibold text-[var(--ink)]">
                        المواصفات
                      </th>
                      {previewColumns.map((column) => (
                        <th key={column} className="py-2 px-2 text-xs font-semibold text-[var(--ink)]">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.item.id} className="border-b border-border/70 align-top">
                        <td className="py-2.5 pe-3 font-medium">{r.item.name}</td>
                        <td className="py-2.5 px-2 text-[11px] text-muted-foreground">
                          {r.specSummary || "—"}
                        </td>
                        {previewValues(r).map((entry, index) => (
                          <td key={index} className="ledger-figure py-2.5 px-2 whitespace-nowrap text-[var(--ink)]" dir="ltr">
                            {entry.value == null ? "—" : `${formatNumber(entry.value)} ${entry.currency}`}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </AppLayout>
  );
}
