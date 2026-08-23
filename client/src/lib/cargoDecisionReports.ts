/**
 * تحليل تقارير القرار — أسلوب: دفتر الميناء.
 * يحوّل لقطات ملفات الحمولة المحفوظة إلى صفوف مقارنة وتفكيك قابل للتدقيق.
 * لا يقرأ أسعار القوالب الحالية كي لا تتغير نتائج عمليات تاريخية مع الوقت.
 */
import type { CargoCostItemRow, CargoCostLineRow, CargoCostRunRow, LogisticsLocationRow } from "@/lib/db";
import { calculateCargoPricing } from "@/lib/cargoPricing";

export type CargoDecisionRun = {
  run: CargoCostRunRow;
  items: CargoCostItemRow[];
  lines: CargoCostLineRow[];
};

export type CostStageKey = "factory" | "port" | "customs" | "warehouse" | "other";

export type CostBreakdownStage = {
  key: CostStageKey;
  amount: number;
  share: number;
};

export type RouteComparisonRow = {
  run: CargoCostRunRow;
  routeLabel: string;
  totalQuantity: number;
  totalCost: number;
  invoiceValue: number;
  customsAmount: number;
  logisticsCost: number;
  unitCost: number | null;
  missingLines: CargoCostLineRow[];
};

const safe = (value: number | undefined | null) => Number.isFinite(value) ? Number(value) : 0;

const eligibleItems = (line: CargoCostLineRow, items: CargoCostItemRow[]) => {
  const requested = line.itemIds.split("|").map((id) => id.trim()).filter(Boolean);
  return requested.length ? items.filter((item) => requested.includes(item.itemId)) : items;
};

export function localCostLineAmount(line: CargoCostLineRow, items: CargoCostItemRow[], customsAmount: number) {
  if (line.status === "included" || line.status === "third-party" || line.status === "missing" || line.status === "disabled") return 0;
  const amount = safe(line.amount) * Math.max(1, safe(line.exchangeRate));
  if (line.stage === "customs" && line.name.trim() === "الجمارك") return customsAmount;
  if (line.method === "percentage") return safe(line.percentageBase) * amount;
  if (line.method === "per-unit") return amount * eligibleItems(line, items).reduce((sum, item) => sum + safe(item.quantity), 0);
  return amount;
}

export function routeLabelFor(run: CargoCostRunRow, locations: LogisticsLocationRow[]) {
  const location = (id: string) => locations.find((row) => row.id === id)?.name || "غير محدد";
  const segments = [location(run.originLocationId), location(run.unloadingLocationId), location(run.deliveryLocationId)]
    .filter((name, index, list) => name !== "غير محدد" || index === 0 || list.length === 1);
  const route = segments.filter((name) => name !== "غير محدد").join(" ← ") || "مسار غير مكتمل";
  return [route, run.incoterm || "بدون شرط شراء", run.transportMode || "بدون نوع نقل"].filter(Boolean).join(" · ");
}

export function buildRouteComparisonRows(runs: CargoDecisionRun[], locations: LogisticsLocationRow[]): RouteComparisonRow[] {
  return runs
    .filter(({ run }) => run.status !== "archived")
    .map(({ run, items, lines }) => {
      const calculation = calculateCargoPricing({
        items,
        costLines: lines,
        customsBaseExtra: run.customsBaseExtra,
        marginRate: run.marginRate,
      });
      const totalQuantity = items.reduce((sum, item) => sum + safe(item.quantity), 0);
      const totalCost = safe(run.totalCost) || calculation.totalCost;
      const customsAmount = safe(run.customsAmount) || calculation.customsAmount;
      const invoiceValue = safe(run.invoiceValue) || calculation.invoiceValue;
      return {
        run,
        routeLabel: routeLabelFor(run, locations),
        totalQuantity,
        totalCost,
        invoiceValue,
        customsAmount,
        logisticsCost: Math.max(0, totalCost - invoiceValue - customsAmount),
        unitCost: totalQuantity > 0 ? totalCost / totalQuantity : null,
        missingLines: lines.filter((line) => line.status === "missing"),
      };
    })
    .sort((a, b) => a.totalCost - b.totalCost || b.run.updatedAt.localeCompare(a.run.updatedAt));
}

export function buildCostBreakdown(run: CargoDecisionRun) {
  const calculation = calculateCargoPricing({
    items: run.items,
    costLines: run.lines,
    customsBaseExtra: run.run.customsBaseExtra,
    marginRate: run.run.marginRate,
  });
  const totalCost = safe(run.run.totalCost) || calculation.totalCost;
  const totalForShare = totalCost > 0 ? totalCost : 1;
  const stages: CostBreakdownStage[] = (Object.keys(calculation.stageTotals) as CostStageKey[]).map((key) => ({
    key,
    amount: calculation.stageTotals[key],
    share: calculation.stageTotals[key] / totalForShare,
  }));
  const lines = run.lines
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((line) => ({
      line,
      localAmount: localCostLineAmount(line, run.items, calculation.customsAmount),
    }));
  return { calculation, totalCost, stages, lines };
}
