/**
 * محرك تكلفة الحمولة — اتجاه التصميم: دفتر الميناء.
 * القواعد: الجمارك توزع بالقيمة، والمصروفات المشتركة توزع بالقيمة افتراضياً،
 * والمصروف لكل وحدة يطبق فقط على الأصناف المستهدفة ومتوافقة الوحدة.
 */
import type { CargoAllocationBasis, CargoCostItemRow, CargoCostLineRow } from "@/lib/db";

export interface CargoAllocation {
  costLineId: string;
  itemId: string;
  amount: number;
}

export interface CargoPricingItemResult {
  itemId: string;
  goodsValue: number;
  customsAmount: number;
  allocatedCost: number;
  finalCost: number;
  unitCost: number;
  suggestedPrice: number;
}

export interface CargoPricingResult {
  invoiceValue: number;
  customsBase: number;
  customsAmount: number;
  sharedCosts: number;
  totalCost: number;
  totalSuggestedRevenue: number;
  allocations: CargoAllocation[];
  items: CargoPricingItemResult[];
  stageTotals: Record<"factory" | "port" | "customs" | "warehouse" | "other", number>;
}

const safe = (value: number) => (Number.isFinite(value) ? value : 0);
const idsFrom = (value: string) => value.split("|").map((id) => id.trim()).filter(Boolean);
const goodsValueOf = (item: CargoCostItemRow) => safe(item.unitPrice) * safe(item.exchangeRate) * safe(item.quantity);

function localAmount(line: CargoCostLineRow, eligible: CargoCostItemRow[]) {
  if (line.status === "included" || line.status === "third-party" || line.status === "missing" || line.status === "disabled") return 0;
  const amount = safe(line.amount) * Math.max(1, safe(line.exchangeRate));
  if (line.method === "percentage") return safe(line.percentageBase) * amount;
  if (line.method !== "per-unit") return amount;
  return amount * eligible.reduce((sum, item) => sum + safe(item.quantity), 0);
}

function allocationWeights(items: CargoCostItemRow[], basis: CargoAllocationBasis): number[] {
  const raw = items.map((item) => {
    if (basis === "quantity") return safe(item.quantity);
    // الوحدات المغايرة لا تقبل وزناً أو مساحة من دون حقول مصدرية مستقلة؛ القيمة هي البديل الآمن.
    if (basis === "weight" || basis === "area" || basis === "volume" || basis === "manual") return goodsValueOf(item);
    return goodsValueOf(item);
  });
  const total = raw.reduce((sum, value) => sum + value, 0);
  return total > 0 ? raw.map((value) => value / total) : items.map(() => (items.length ? 1 / items.length : 0));
}

export function calculateCargoPricing(params: {
  items: CargoCostItemRow[];
  costLines: CargoCostLineRow[];
  customsBaseExtra: number;
  marginRate: number;
}): CargoPricingResult {
  const items = params.items.filter((item) => safe(item.quantity) > 0);
  const invoiceValue = items.reduce((sum, item) => sum + safe(item.unitPrice) * safe(item.exchangeRate) * safe(item.quantity), 0);
  const customsBase = invoiceValue + safe(params.customsBaseExtra);
  const allocations: CargoAllocation[] = [];
  const allocatedByItem = new Map(items.map((item) => [item.itemId, 0]));
  const customsByItem = new Map(items.map((item) => [item.itemId, 0]));
  const stageTotals: CargoPricingResult["stageTotals"] = { factory: invoiceValue, port: 0, customs: 0, warehouse: 0, other: 0 };

  for (const line of params.costLines.filter((candidate) => candidate.status !== "disabled")) {
    const requestedIds = idsFrom(line.itemIds);
    const eligible = items.filter((item) => requestedIds.length === 0 || requestedIds.includes(item.itemId));
    if (eligible.length === 0) continue;
    const isCustoms = line.stage === "customs" && line.name.trim() === "الجمارك";
    if (isCustoms) {
      for (const item of items) {
        const share = invoiceValue > 0 ? goodsValueOf(item) / invoiceValue : 0;
        const value = customsBase * share * safe(item.customsRate);
        customsByItem.set(item.itemId, safe(customsByItem.get(item.itemId) ?? 0) + value);
        allocatedByItem.set(item.itemId, safe(allocatedByItem.get(item.itemId) ?? 0) + value);
        allocations.push({ costLineId: line.id, itemId: item.itemId, amount: value });
        stageTotals.customs += value;
      }
      continue;
    }
    const total = localAmount(line, eligible);
    const weights = allocationWeights(eligible, line.allocationBasis);
    eligible.forEach((item, index) => {
      const value = total * weights[index];
      allocatedByItem.set(item.itemId, safe(allocatedByItem.get(item.itemId) ?? 0) + value);
      allocations.push({ costLineId: line.id, itemId: item.itemId, amount: value });
    });
    stageTotals[line.stage] += total;
  }

  const results = items.map((item) => {
    const goodsValue = goodsValueOf(item);
    const customsAmount = safe(customsByItem.get(item.itemId) ?? 0);
    const allocatedCost = safe(allocatedByItem.get(item.itemId) ?? 0);
    const finalCost = goodsValue + allocatedCost;
    const unitCost = item.quantity > 0 ? finalCost / item.quantity : 0;
    const suggestedPrice = unitCost * (1 + safe(params.marginRate));
    return { itemId: item.itemId, goodsValue, customsAmount, allocatedCost, finalCost, unitCost, suggestedPrice };
  });
  const customsAmount = results.reduce((sum, item) => sum + item.customsAmount, 0);
  const totalCost = results.reduce((sum, item) => sum + item.finalCost, 0);
  const totalSuggestedRevenue = results.reduce((sum, item) => sum + item.suggestedPrice * params.items.find((source) => source.itemId === item.itemId)!.quantity, 0);
  return {
    invoiceValue,
    customsBase,
    customsAmount,
    sharedCosts: totalCost - invoiceValue - customsAmount,
    totalCost,
    totalSuggestedRevenue,
    allocations,
    items: results,
    stageTotals,
  };
}
