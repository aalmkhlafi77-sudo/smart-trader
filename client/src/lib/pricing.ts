/**
 * محرك حساب التكلفة والتسعير — اتجاه التصميم: "دفتر الميناء"
 * قاعدة إلزامية: المصاريف المقطوعة تُجمع على مستوى الحاوية أولاً، ثم تُقسم على الكمية.
 * الجمارك تُحسب على قيمة البضاعة وتظهر كمبلغ صريح، لا كنسبة فقط.
 */

export interface PricingInput {
  unitPriceForeign: number;
  exchangeRate: number;
  quantity: number;
  freight: number;
  /** عملة الشحن الدولي: أجنبية (دولار) أو محلية (ريال) */
  freightCurrency?: "foreign" | "local";
  customsRate: number;
  clearance: number;
  transport: number;
  otherCosts: number;
  marginRate: number;
}

export interface PricingResult {
  goodsValue: number;
  /** الشحن الدولي بعد التحويل إلى العملة المحلية */
  freightLocal: number;
  customsAmount: number;
  totalContainerCost: number;
  unitCost: number;
  suggestedPrice: number;
  unitProfit: number;
}

const safe = (n: number) => (Number.isFinite(n) ? n : 0);

export function computePricing(input: PricingInput): PricingResult {
  const quantity = safe(input.quantity);
  const rate = safe(input.exchangeRate);
  const goodsValue = safe(input.unitPriceForeign) * quantity * rate;
  // الشحن يُدخل بالدولار أو بالريال، ويظهر دائماً بالريال في خط الحساب
  const freightLocal =
    input.freightCurrency === "foreign" ? safe(input.freight) * rate : safe(input.freight);
  const customsAmount = goodsValue * safe(input.customsRate);
  const totalContainerCost =
    goodsValue +
    freightLocal +
    customsAmount +
    safe(input.clearance) +
    safe(input.transport) +
    safe(input.otherCosts);
  const unitCost = quantity > 0 ? totalContainerCost / quantity : 0;
  const suggestedPrice = unitCost * (1 + safe(input.marginRate));
  return {
    goodsValue,
    freightLocal,
    customsAmount,
    totalContainerCost,
    unitCost,
    suggestedPrice,
    unitProfit: suggestedPrice - unitCost,
  };
}

/** كل الأرقام تُعرض بالصيغة الإنجليزية (0-9) في جميع أنحاء التطبيق */
export function formatMoney(value: number, currency = "ريال"): string {
  const n = safe(value);
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function formatNumber(value: number): string {
  return safe(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatCount(value: number): string {
  return safe(value).toLocaleString("en-US");
}

/** تنسيق التاريخ بالأرقام الإنجليزية: YYYY-MM-DD */
export function formatDate(value?: string | number | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** تنسيق التاريخ والوقت بالأرقام الإنجليزية */
export function formatDateTime(value?: string | number | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)} ${hh}:${mm}`;
}

export function parseNumber(value: string): number {
  const cleaned = value.replace(/[^\d.-]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
