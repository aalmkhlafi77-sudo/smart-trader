/**
 * تقارير قرار الحمولة — أسلوب: دفتر الميناء التحليلي.
 * اللوحة تضع القرار قبل الجداول: المسار الأرخص، أسباب التكلفة، ثم مصدر كل مبلغ.
 */
import EmptyHint from "@/components/EmptyHint";
import SectionCard from "@/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildCostBreakdown, buildRouteComparisonRows, type CargoDecisionRun, type CostStageKey } from "@/lib/cargoDecisionReports";
import { db, type CargoCostItemRow, type CargoCostLineRow, type CargoCostRunRow, type LogisticsLocationRow } from "@/lib/db";
import { exportExcel, exportPdf } from "@/lib/exporters";
import { formatDate, formatMoney, formatNumber } from "@/lib/pricing";
import { AlertTriangle, Boxes, FileSpreadsheet, MapPinned, Printer, ReceiptText, Route, ShipWheel, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const stageMeta: Record<CostStageKey, { label: string; color: string }> = {
  factory: { label: "قيمة البضاعة", color: "var(--calc-cyan)" },
  port: { label: "الميناء والشحن", color: "var(--calc-blue)" },
  customs: { label: "الجمارك", color: "var(--calc-amber)" },
  warehouse: { label: "النقل والتسليم", color: "var(--calc-green)" },
  other: { label: "مصاريف أخرى", color: "var(--calc-purple)" },
};

const stagePdfColors: Record<CostStageKey, string> = {
  factory: "#145B8C",
  port: "#2E74B5",
  customs: "#C98517",
  warehouse: "#1F6F54",
  other: "#7655A5",
};

const statusLabel: Record<CargoCostRunRow["status"], string> = {
  draft: "مسودة",
  review: "قيد المراجعة",
  approved: "معتمد",
  archived: "مؤرشف",
};

const costStatusLabel: Record<CargoCostLineRow["status"], string> = {
  entered: "مدخل",
  included: "مشمول",
  "third-party": "طرف ثالث",
  missing: "يلزم تسعير",
  disabled: "معطل",
};

export default function CargoDecisionReports() {
  const [details, setDetails] = useState<CargoDecisionRun[]>([]);
  const [locations, setLocations] = useState<LogisticsLocationRow[]>([]);
  const [operation, setOperation] = useState<"all" | CargoCostRunRow["operationType"]>("all");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await db.init();
      const [runs, locationRows] = await Promise.all([db.listCargoCostRuns(), db.listLogisticsLocations()]);
      const loaded = await Promise.all(runs.map(async (run) => ({
        run,
        items: await db.listCargoCostItems(run.id),
        lines: await db.listCargoCostLines(run.id),
      })));
      if (cancelled) return;
      setDetails(loaded);
      setLocations(locationRows);
      setSelectedRunId(loaded.find((entry) => entry.run.status !== "archived")?.run.id ?? "");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredDetails = useMemo(
    () => details.filter((entry) => entry.run.status !== "archived" && (operation === "all" || entry.run.operationType === operation)),
    [details, operation],
  );
  const routeRows = useMemo(() => buildRouteComparisonRows(filteredDetails, locations), [filteredDetails, locations]);
  const selectedDetail = useMemo(
    () => filteredDetails.find((entry) => entry.run.id === selectedRunId) ?? filteredDetails[0] ?? null,
    [filteredDetails, selectedRunId],
  );
  const breakdown = useMemo(() => selectedDetail ? buildCostBreakdown(selectedDetail) : null, [selectedDetail]);
  const bestTotal = routeRows[0] ?? null;
  const bestUnit = useMemo(() => routeRows.filter((row) => row.unitCost != null).sort((a, b) => (a.unitCost ?? Infinity) - (b.unitCost ?? Infinity))[0] ?? null, [routeRows]);
  const missingCount = routeRows.reduce((sum, row) => sum + row.missingLines.length, 0);

  const exportRoutes = () => {
    exportExcel({
      sheetName: "مقارنة المسارات",
      fileName: "مقارنة-مسارات-التاجر-الذكي",
      header: ["ملف الحمولة", "المسار", "الحالة", "تاريخ الحفظ", "قيمة الفاتورة", "الجمارك", "اللوجستيات", "الإجمالي", "تكلفة الوحدة", "نقص التسعير"],
      rows: routeRows.map((row) => [row.run.name || row.run.reference || row.run.id, row.routeLabel, statusLabel[row.run.status], formatDate(row.run.updatedAt), formatNumber(row.invoiceValue), formatNumber(row.customsAmount), formatNumber(row.logisticsCost), formatNumber(row.totalCost), row.unitCost == null ? "—" : formatNumber(row.unitCost), row.missingLines.map((line) => line.name).join("، ") || "—"]),
    });
  };

  const exportBreakdown = () => {
    if (!selectedDetail || !breakdown) return;
    exportPdf({
      title: "تفكيك تكلفة الشحنة",
      subtitle: selectedDetail.run.name || selectedDetail.run.reference || "ملف تكلفة حمولة",
      meta: [`الحالة: ${statusLabel[selectedDetail.run.status]}`, `تاريخ الحفظ: ${formatDate(selectedDetail.run.updatedAt)}`, `الإجمالي: ${formatMoney(breakdown.totalCost, selectedDetail.run.currency)}`],
      header: ["البند", "المرحلة", "الحالة", "المصدر", "المبلغ المحلي"],
      rows: breakdown.lines.map(({ line, localAmount }) => [line.name, stageMeta[line.stage].label, costStatusLabel[line.status], line.sourceLabel || "تعديل/إدخال محلي", formatNumber(localAmount)]),
      footerNote: "يعتمد التقرير على لقطة ملف التكلفة المحفوظة ولا يعيد احتساب أسعار القوالب الحالية.",
    });
  };

  const exportComprehensivePdf = () => {
    if (!selectedDetail || !breakdown || routeRows.length === 0) return;
    exportPdf({
      title: "تقرير قرار الشحن والتكلفة",
      subtitle: "مقارنة المسارات وتفكيك ملف تكلفة حمولة محفوظ",
      meta: [
        `عدد المسارات المقارنة: ${routeRows.length}`,
        `ملف التفكيك: ${selectedDetail.run.name || selectedDetail.run.reference || selectedDetail.run.id}`,
        `تاريخ التقرير: ${formatDate(new Date().toISOString())}`,
      ],
      header: [],
      rows: [],
      sections: [
        {
          title: "1. مقارنة المسارات",
          description: "يرتب الجدول الملفات المحفوظة حسب إجمالي التكلفة. لا تعني المرتبة الأقل توصية مطلقة عند اختلاف محتوى الشحنة أو كمياتها.",
          header: ["ملف الحمولة", "المسار", "الحالة", "الفاتورة", "الجمارك", "اللوجستيات", "الإجمالي", "تكلفة الوحدة", "نقص التسعير"],
          rows: routeRows.map((row) => [
            row.run.name || row.run.reference || row.run.id,
            row.routeLabel,
            statusLabel[row.run.status],
            formatMoney(row.invoiceValue, row.run.currency),
            formatMoney(row.customsAmount, row.run.currency),
            formatMoney(row.logisticsCost, row.run.currency),
            formatMoney(row.totalCost, row.run.currency),
            row.unitCost == null ? "—" : formatMoney(row.unitCost, row.run.currency),
            row.missingLines.map((line) => line.name).join("، ") || "—",
          ]),
        },
        {
          title: "2. توزيع مراحل التكلفة",
          description: "يظهر الرسم الدائري نسبة كل مرحلة من إجمالي التكلفة؛ لا تظهر البنود الصفرية أو المشمولة في الرسم.",
          donutChart: {
            title: "توزيع نسب تكلفة الشحنة",
            entries: breakdown.stages.map((stage) => ({
              label: stageMeta[stage.key].label,
              value: stage.amount,
              color: stagePdfColors[stage.key],
            })),
          },
          header: ["المرحلة", "المبلغ", "النسبة"],
          rows: breakdown.stages.map((stage) => [
            stageMeta[stage.key].label,
            formatMoney(stage.amount, selectedDetail.run.currency),
            `${formatNumber(stage.share * 100)}%`,
          ]),
        },
        {
          title: "3. مؤشرات ملف التكلفة المختار",
          description: `${selectedDetail.run.incoterm || "بدون شرط شراء"} · ${selectedDetail.run.transportMode || "بدون نوع نقل"} · ${selectedDetail.run.clearanceOffice || "مكتب غير محدد"}`,
          header: ["المؤشر", "القيمة"],
          rows: [
            ["قيمة الفاتورة", formatMoney(breakdown.calculation.invoiceValue, selectedDetail.run.currency)],
            ["وعاء الجمارك", formatMoney(breakdown.calculation.customsBase, selectedDetail.run.currency)],
            ["إجمالي التكلفة", formatMoney(breakdown.totalCost, selectedDetail.run.currency)],
            ["سعر البيع المقترح", formatMoney(breakdown.calculation.totalSuggestedRevenue, selectedDetail.run.currency)],
          ],
        },
        {
          title: "4. تفكيك بنود تكلفة الشحنة",
          description: "المبالغ مبنية على لقطة الملف المحفوظة ولا يعاد احتسابها بأسعار القوالب الحالية.",
          header: ["البند", "المرحلة", "الحالة", "المصدر", "المبلغ المحلي"],
          rows: breakdown.lines.map(({ line, localAmount }) => [
            line.name,
            stageMeta[line.stage].label,
            costStatusLabel[line.status],
            line.sourceLabel || line.reason || "تعديل أو إدخال محلي",
            line.status === "missing" ? "يلزم تسعير" : formatMoney(localAmount, selectedDetail.run.currency),
          ]),
        },
      ],
      footerNote: "يُعرض بند «يلزم تسعير» كبيان ناقص ولا يُعامل كقيمة صفرية. تبقى كل البيانات محلية على الجهاز.",
      landscape: true,
    });
  };

  return (
    <section className="space-y-5" aria-label="تقارير قرار الشحن والتكلفة">
      <SectionCard
        title="تقارير قرار الشحن والتكلفة"
        hint="قارن ملفات الحمولة المحفوظة ثم افهم مصدر كل بند قبل اعتماد القرار"
        stamp="قرار المرحلة 1"
        action={<div className="flex flex-wrap gap-1.5"><Button size="sm" variant="outline" onClick={exportRoutes} disabled={!routeRows.length}><FileSpreadsheet className="h-3.5 w-3.5" /> Excel</Button><Button size="sm" variant="outline" onClick={exportBreakdown} disabled={!breakdown}><Printer className="h-3.5 w-3.5" /> تفكيك PDF</Button><Button size="sm" onClick={exportComprehensivePdf} disabled={!breakdown || !routeRows.length}><Printer className="h-3.5 w-3.5" /> PDF شامل</Button></div>}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-1.5"><Label>نوع العملية للمقارنة</Label><Select value={operation} onValueChange={(value) => setOperation(value as typeof operation)}><SelectTrigger className="field-input w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل العمليات</SelectItem><SelectItem value="import">استيراد</SelectItem><SelectItem value="local">نقل محلي</SelectItem></SelectContent></Select></div>
          <p className="rounded border border-[var(--port-green)]/25 bg-[var(--port-green-soft)] px-3 py-2 text-xs text-[var(--ink)]"><ShipWheel className="ml-1 inline h-3.5 w-3.5" /> المقارنة تستخدم لقطات ملفات الحمولة المحفوظة فقط.</p>
        </div>
      </SectionCard>

      {loading ? <div className="ledger-card p-5 text-sm text-muted-foreground">جارٍ تحميل ملفات التكلفة المحلية…</div> : routeRows.length === 0 ? <EmptyHint text="لا توجد ملفات تكلفة حمولة محفوظة بعد. احفظ ملف تكلفة من الحاسبة ليظهر تفكيكه ومقارنته هنا." /> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "أقل تكلفة شحنة", value: bestTotal ? formatMoney(bestTotal.totalCost, bestTotal.run.currency) : "—", detail: bestTotal?.routeLabel ?? "" , icon: WalletCards, accent: "var(--port-green)" },
            { label: "أقل تكلفة وحدة", value: bestUnit?.unitCost == null ? "—" : formatMoney(bestUnit.unitCost, bestUnit.run.currency), detail: bestUnit?.routeLabel ?? "" , icon: Boxes, accent: "var(--calc-cyan)" },
            { label: "ملفات قابلة للمقارنة", value: formatNumber(routeRows.length), detail: "ملفات غير مؤرشفة" , icon: Route, accent: "var(--calc-blue)" },
            { label: "بنود تحتاج تسعيراً", value: formatNumber(missingCount), detail: missingCount ? "لا تعامل كقيمة صفرية" : "تغطية مكتملة في الملفات المعروضة" , icon: AlertTriangle, accent: missingCount ? "var(--calc-amber)" : "var(--port-green)" },
          ].map((card) => { const Icon = card.icon; return <div key={card.label} className="ledger-card border-r-[3px] p-4" style={{ borderRightColor: card.accent }}><div className="flex items-center justify-between"><p className="text-[11px] text-muted-foreground">{card.label}</p><Icon className="h-4 w-4" style={{ color: card.accent }} /></div><p className="ledger-figure mt-1 truncate text-lg text-[var(--ink)]" dir="ltr">{card.value}</p><p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{card.detail}</p></div>; })}
        </div>

        <SectionCard title="مقارنة المسارات" hint="الأفضل هنا يعني الأقل ضمن ملفات محفوظة قابلة للمقارنة، وليس توصية مطلقة" stamp="مصفوفة المسار">
          <div className="space-y-2 md:hidden">
            {routeRows.map((row, index) => <article key={row.run.id} className="rounded border border-border bg-card p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-[var(--ink)]">{row.run.name || row.run.reference || "ملف بدون اسم"}</p><p className="mt-1 text-[11px] text-muted-foreground">{row.routeLabel}</p></div><Badge variant="outline">{statusLabel[row.run.status]}</Badge></div><div className="mt-3 grid grid-cols-2 gap-2 text-center"><div className="rounded bg-secondary/70 p-2"><p className="text-[9px] text-muted-foreground">الإجمالي</p><p className="ledger-figure text-xs" dir="ltr">{formatMoney(row.totalCost, row.run.currency)}</p></div><div className="rounded bg-[var(--port-green-soft)] p-2"><p className="text-[9px] text-muted-foreground">تكلفة الوحدة</p><p className="ledger-figure text-xs" dir="ltr">{row.unitCost == null ? "—" : formatMoney(row.unitCost, row.run.currency)}</p></div></div>{row.missingLines.length > 0 && <p className="mt-2 text-[10px] text-[var(--calc-amber)]">يلزم تسعير: {row.missingLines.map((line) => line.name).join("، ")}</p>}{index === 0 && <p className="mt-2 text-[10px] text-[var(--port-green)]">الأقل تكلفة إجمالاً ضمن البيانات المعروضة</p>}</article>)}
          </div>
          <div className="hidden overflow-x-auto md:block touch-pan-x scrollbar-ledger"><table className="w-full min-w-[1040px] text-right text-sm"><thead><tr className="border-b-2 border-[var(--ink)]/30 text-[11px] text-muted-foreground">{["ملف الحمولة", "المسار", "الحالة", "الفاتورة", "الجمارك", "اللوجستيات", "الإجمالي", "تكلفة الوحدة", "نقص التسعير", "تاريخ الحفظ"].map((heading) => <th className="whitespace-nowrap px-3 py-3 font-semibold" key={heading}>{heading}</th>)}</tr></thead><tbody>{routeRows.map((row, index) => <tr className="border-b border-border/70 hover:bg-secondary/40" key={row.run.id}><td className="px-3 py-3 font-semibold text-[var(--ink)]">{row.run.name || row.run.reference || "—"}{index === 0 && <span className="mr-1.5 rounded bg-[var(--port-green-soft)] px-1.5 py-0.5 text-[9px] text-[var(--port-green)]">الأقل</span>}</td><td className="max-w-[260px] px-3 py-3 text-xs">{row.routeLabel}</td><td className="px-3 py-3"><Badge variant="outline">{statusLabel[row.run.status]}</Badge></td><td className="ledger-figure px-3 py-3" dir="ltr">{formatMoney(row.invoiceValue, row.run.currency)}</td><td className="ledger-figure px-3 py-3" dir="ltr">{formatMoney(row.customsAmount, row.run.currency)}</td><td className="ledger-figure px-3 py-3" dir="ltr">{formatMoney(row.logisticsCost, row.run.currency)}</td><td className="ledger-figure px-3 py-3 font-semibold" dir="ltr">{formatMoney(row.totalCost, row.run.currency)}</td><td className="ledger-figure px-3 py-3" dir="ltr">{row.unitCost == null ? "—" : formatMoney(row.unitCost, row.run.currency)}</td><td className="px-3 py-3 text-xs text-[var(--calc-amber)]">{row.missingLines.map((line) => line.name).join("، ") || "—"}</td><td className="px-3 py-3 text-xs" dir="ltr">{formatDate(row.run.updatedAt)}</td></tr>)}</tbody></table></div>
        </SectionCard>

        <SectionCard title="تفكيك تكلفة الشحنة" hint="اختر ملفاً محفوظاً لرؤية مراحل التكلفة وبطاقات المصروف الفعلية" stamp="خط الحساب">
          <div className="mb-4 max-w-xl space-y-1.5"><Label>ملف تكلفة الحمولة</Label><Select value={selectedDetail?.run.id ?? ""} onValueChange={setSelectedRunId}><SelectTrigger className="field-input w-full"><SelectValue placeholder="اختر ملف تكلفة" /></SelectTrigger><SelectContent>{filteredDetails.map((entry) => <SelectItem key={entry.run.id} value={entry.run.id}>{entry.run.name || entry.run.reference || entry.run.id} · {formatDate(entry.run.updatedAt)}</SelectItem>)}</SelectContent></Select></div>
          {selectedDetail && breakdown && <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.82fr)]"><div className="space-y-3 rounded border border-border bg-secondary/30 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-[var(--ink)]">{selectedDetail.run.name || selectedDetail.run.reference || "ملف تكلفة حمولة"}</p><p className="text-[11px] text-muted-foreground">{selectedDetail.run.incoterm || "بدون شرط شراء"} · {selectedDetail.run.transportMode || "بدون نوع نقل"} · {selectedDetail.run.clearanceOffice || "مكتب غير محدد"}</p></div><Badge variant="outline">{statusLabel[selectedDetail.run.status]}</Badge></div>{breakdown.stages.map((stage) => <div key={stage.key}><div className="mb-1 flex justify-between gap-3 text-xs"><span>{stageMeta[stage.key].label}</span><span className="ledger-figure" dir="ltr">{formatMoney(stage.amount, selectedDetail.run.currency)} · {formatNumber(stage.share * 100)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${Math.min(100, Math.max(0, stage.share * 100))}%`, backgroundColor: stageMeta[stage.key].color }} /></div></div>)}<div className="mt-3 flex items-center justify-between border-t border-border pt-3"><span className="font-semibold">إجمالي التكلفة</span><span className="ledger-figure text-lg font-bold text-[var(--ink)]" dir="ltr">{formatMoney(breakdown.totalCost, selectedDetail.run.currency)}</span></div></div><div className="rounded border border-border bg-card p-3"><p className="mb-2 text-sm font-semibold text-[var(--ink)]">مؤشرات القرار</p><div className="space-y-2 text-xs"><p className="flex justify-between gap-3"><span className="text-muted-foreground">قيمة الفاتورة</span><strong className="ledger-figure" dir="ltr">{formatMoney(breakdown.calculation.invoiceValue, selectedDetail.run.currency)}</strong></p><p className="flex justify-between gap-3"><span className="text-muted-foreground">وعاء الجمارك</span><strong className="ledger-figure" dir="ltr">{formatMoney(breakdown.calculation.customsBase, selectedDetail.run.currency)}</strong></p><p className="flex justify-between gap-3"><span className="text-muted-foreground">سعر البيع المقترح</span><strong className="ledger-figure" dir="ltr">{formatMoney(breakdown.calculation.totalSuggestedRevenue, selectedDetail.run.currency)}</strong></p><p className="border-t border-border pt-2 text-[10px] text-muted-foreground">المصادر والتعديلات التالية تخص هذه اللقطة المحفوظة فقط.</p></div></div></div>}
          {selectedDetail && breakdown && <div className="mt-4 overflow-x-auto touch-pan-x scrollbar-ledger"><table className="w-full min-w-[780px] text-right text-xs"><thead><tr className="border-b border-border text-muted-foreground">{["بند المصروف", "المرحلة", "الحالة", "المصدر", "المبلغ المحلي"].map((heading) => <th key={heading} className="px-2 py-2 font-semibold">{heading}</th>)}</tr></thead><tbody>{breakdown.lines.map(({ line, localAmount }) => <tr key={line.id} className="border-b border-border/60"><td className="px-2 py-2 font-medium">{line.name}</td><td className="px-2 py-2">{stageMeta[line.stage].label}</td><td className="px-2 py-2"><Badge variant="outline" className="text-[9px]">{costStatusLabel[line.status]}</Badge></td><td className="max-w-[220px] truncate px-2 py-2 text-muted-foreground">{line.sourceLabel || line.reason || "تعديل أو إدخال محلي"}</td><td className="ledger-figure px-2 py-2" dir="ltr">{line.status === "missing" ? "يلزم تسعير" : formatMoney(localAmount, selectedDetail.run.currency)}</td></tr>)}</tbody></table></div>}
        </SectionCard>

        <div className="flex items-start gap-2 rounded border border-border bg-secondary/40 px-3 py-2.5 text-[11px] text-muted-foreground"><ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink)]/70" /><p>لا تُقرأ أسعار القوالب الحالية في هذه التقارير؛ تُعرض لقطات ملفات التكلفة المحفوظة، وتُعامل قيمة الصفر المشمولة وغياب التسعير كحالتين مختلفتين.</p></div>
      </>}
    </section>
  );
}
