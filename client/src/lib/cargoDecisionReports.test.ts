import { describe, expect, it } from "vitest";
import { buildCostBreakdown, buildRouteComparisonRows } from "./cargoDecisionReports";
import type { CargoCostItemRow, CargoCostLineRow, CargoCostRunRow, LogisticsLocationRow } from "./db";

const run = (id: string, totalCost = 0): CargoCostRunRow => ({
  id, name: `شحنة ${id}`, reference: id, operationType: "import", entityId: null, status: "approved", parentRunId: "", version: 1,
  currency: "SAR", marginRate: 0.2, customsBaseExtra: 0, routeTemplateId: "", originLocationId: "origin", unloadingLocationId: "unload", deliveryLocationId: "delivery",
  incoterm: "FOB", transportMode: "بحري", clearanceOffice: "مكتب الاختبار", invoiceValue: 0, customsBase: 0, customsAmount: 0, totalCost, totalSuggestedRevenue: 0,
  notes: "", approvedAt: "2026-08-23T00:00:00.000Z", createdAt: "2026-08-23T00:00:00.000Z", updatedAt: "2026-08-23T00:00:00.000Z",
});

const item: CargoCostItemRow = {
  id: "item-row", runId: "r1", itemId: "item-1", itemName: "صنف اختبار", priceLevel: 1, priceSource: "manual", priceEffectiveDate: "2026-08-23",
  unitPrice: 10, currency: "SAR", exchangeRate: 1, quantity: 10, unit: "قطعة", customsCategory: "عام", customsRate: 0.12,
  goodsValue: 100, allocatedCost: 0, finalUnitCost: 0, suggestedPrice: 0, createdAt: "2026-08-23T00:00:00.000Z", updatedAt: "2026-08-23T00:00:00.000Z",
};

const line = (id: string, name: string, stage: CargoCostLineRow["stage"], amount: number, status: CargoCostLineRow["status"] = "entered"): CargoCostLineRow => ({
  id, runId: "r1", name, stage, status, method: "fixed", allocationBasis: "value", currency: "SAR", exchangeRate: 1, amount, referenceQuantity: 0,
  referenceUnit: "", percentageBase: 0, itemIds: "", sourceLabel: "اختبار", rateId: "", templateId: "", effectiveDate: "2026-08-23", reason: "", sortOrder: 1,
  createdAt: "2026-08-23T00:00:00.000Z", updatedAt: "2026-08-23T00:00:00.000Z",
});

const locations: LogisticsLocationRow[] = [
  { id: "origin", name: "الصين", kind: "origin", country: "", city: "", entityId: null, active: 1, notes: "", createdAt: "", updatedAt: "" },
  { id: "unload", name: "جدة", kind: "unloading", country: "", city: "", entityId: null, active: 1, notes: "", createdAt: "", updatedAt: "" },
  { id: "delivery", name: "الرياض", kind: "delivery", country: "", city: "", entityId: null, active: 1, notes: "", createdAt: "", updatedAt: "" },
];

describe("تقارير قرار الحمولة", () => {
  it("يفكك قيمة البضاعة والشحن والجمارك من لقطة الحمولة", () => {
    const detail = { run: run("r1"), items: [item], lines: [line("freight", "الشحن", "port", 50), line("customs", "الجمارك", "customs", 0), line("missing", "تأمين", "other", 0, "missing")] };
    const breakdown = buildCostBreakdown(detail);
    expect(breakdown.totalCost).toBe(162);
    expect(breakdown.stages.find((stage) => stage.key === "factory")?.amount).toBe(100);
    expect(breakdown.stages.find((stage) => stage.key === "port")?.amount).toBe(50);
    expect(breakdown.stages.find((stage) => stage.key === "customs")?.amount).toBe(12);
    expect(breakdown.lines.find((entry) => entry.line.id === "missing")?.localAmount).toBe(0);
  });

  it("يرتب المسارات بالتكلفة ويعرض المسار وبنود نقص التسعير", () => {
    const higher = { run: run("r1"), items: [item], lines: [line("freight", "الشحن", "port", 50), line("missing", "تأمين", "other", 0, "missing")] };
    const lower = { run: run("r2", 120), items: [{ ...item, id: "item-row-2", runId: "r2" }], lines: [] };
    const rows = buildRouteComparisonRows([higher, lower], locations);
    expect(rows[0].run.id).toBe("r2");
    expect(rows[1].routeLabel).toContain("الصين ← جدة ← الرياض");
    expect(rows[1].missingLines.map((entry) => entry.name)).toEqual(["تأمين"]);
  });
});
