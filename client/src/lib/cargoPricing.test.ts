import { describe, expect, it } from "vitest";
import { calculateCargoPricing } from "./cargoPricing";
import type { CargoCostItemRow, CargoCostLineRow } from "@/lib/db";

const now = "2026-08-23T00:00:00.000Z";

const item = (id: string, price: number, quantity: number): CargoCostItemRow => ({
  id: `row-${id}`,
  runId: "run-1",
  itemId: id,
  itemName: id,
  priceLevel: 1,
  priceSource: "latest-dated",
  priceEffectiveDate: "2026-08-01",
  unitPrice: price,
  currency: "ريال",
  exchangeRate: 1,
  quantity,
  unit: "قطعة",
  customsCategory: "عام",
  customsRate: 0.1,
  goodsValue: 0,
  allocatedCost: 0,
  finalUnitCost: 0,
  suggestedPrice: 0,
  createdAt: now,
  updatedAt: now,
});

const line = (id: string, name: string, overrides: Partial<CargoCostLineRow> = {}): CargoCostLineRow => ({
  id,
  runId: "run-1",
  name,
  stage: "port",
  status: "entered",
  method: "fixed",
  allocationBasis: "value",
  currency: "ريال",
  exchangeRate: 1,
  amount: 0,
  referenceQuantity: 0,
  referenceUnit: "",
  percentageBase: 0,
  itemIds: "",
  sourceLabel: "",
  rateId: "",
  templateId: "",
  effectiveDate: "2026-08-01",
  reason: "",
  sortOrder: 10,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe("calculateCargoPricing", () => {
  it("يوزع الجمارك بالقيمة والمصروفات المشتركة بالقيمة، ويقصر تكلفة الوحدة على الصنف المستهدف", () => {
    const result = calculateCargoPricing({
      items: [item("a", 10, 10), item("b", 10, 30)],
      costLines: [
        line("freight", "الشحن الدولي", { amount: 100 }),
        line("customs", "الجمارك", { stage: "customs", method: "percentage" }),
        line("handling-a", "تحميل لكل وحدة", { stage: "warehouse", method: "per-unit", amount: 2, itemIds: "a" }),
      ],
      customsBaseExtra: 40,
      marginRate: 0.2,
    });

    expect(result.invoiceValue).toBe(400);
    expect(result.customsBase).toBe(440);
    expect(result.customsAmount).toBe(44);
    expect(result.items.find((row) => row.itemId === "a")?.allocatedCost).toBe(56);
    expect(result.items.find((row) => row.itemId === "b")?.allocatedCost).toBe(108);
    expect(result.totalCost).toBe(564);
  });

  it("لا يضيف الشحن المشمول في CIF إلى تكلفة الحمولة مرة ثانية", () => {
    const result = calculateCargoPricing({
      items: [item("a", 10, 10)],
      costLines: [line("freight", "الشحن الدولي", { amount: 900, status: "included" }), line("customs", "الجمارك", { stage: "customs", method: "percentage" })],
      customsBaseExtra: 0,
      marginRate: 0,
    });

    expect(result.stageTotals.port).toBe(0);
    expect(result.totalCost).toBe(110);
  });
});
