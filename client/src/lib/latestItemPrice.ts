/**
 * اختيار سعر الصنف الافتراضي — قاعدة دفتر الميناء:
 * يُختار السعر ذو آخر تاريخ اعتماد من قائمة الأسعار، ثم يبقى قابلاً للتعديل داخل ملف التكلفة.
 */
import type { ItemPriceRow, PriceLevel } from "@/lib/db";

export interface LatestItemPrice {
  level: PriceLevel;
  price: number;
  effectiveDate: string;
}

export function latestDatedItemPrice(row: ItemPriceRow | null): LatestItemPrice | null {
  if (!row) return null;
  const candidates: Array<LatestItemPrice & { fallback: number }> = [
    { level: 1 as PriceLevel, price: row.price1 ?? Number.NaN, effectiveDate: row.price1Date ?? "", fallback: 1 },
    { level: 2 as PriceLevel, price: row.price2 ?? Number.NaN, effectiveDate: row.price2Date ?? "", fallback: 2 },
    { level: 3 as PriceLevel, price: row.price3 ?? Number.NaN, effectiveDate: row.price3Date ?? "", fallback: 3 },
    { level: 4 as PriceLevel, price: row.price4 ?? Number.NaN, effectiveDate: row.price4Date ?? "", fallback: 4 },
  ].filter((candidate) => Number.isFinite(candidate.price) && Boolean(candidate.effectiveDate.trim()));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const byDate = (b.effectiveDate || "0000-00-00").localeCompare(a.effectiveDate || "0000-00-00");
    return byDate || b.fallback - a.fallback;
  });
  const selected = candidates[0];
  return { level: selected.level, price: selected.price, effectiveDate: selected.effectiveDate };
}
