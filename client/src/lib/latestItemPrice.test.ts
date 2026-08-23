import { describe, expect, it } from "vitest";
import { latestDatedItemPrice } from "./latestItemPrice";
import type { ItemPriceRow } from "@/lib/db";

const row: ItemPriceRow = {
  id: "price-1", itemId: "item-1", price1: 8, price1Date: "2026-08-01", price2: 9.2, price2Date: "2026-08-22",
  price3: 9.5, price3Date: "2026-08-20", price4: 10, price4Date: "", currency: "دولار", notes: "",
  createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z",
};

describe("latestDatedItemPrice", () => {
  it("يعيد السعر ذي آخر تاريخ فعالية، لا آخر مستوى سعري في السجل", () => {
    expect(latestDatedItemPrice(row)).toEqual({ level: 2, price: 9.2, effectiveDate: "2026-08-22" });
  });

  it("يعيد null عندما لا يوجد سعر مؤرخ صالح", () => {
    expect(latestDatedItemPrice({ ...row, price1Date: "", price2Date: "", price3Date: "", price4Date: "" })).toBeNull();
  });
});
