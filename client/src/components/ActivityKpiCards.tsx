/** مؤشرات الأداء — حسابات محلية تتغير دلالتها وأيقونتها بحسب النشاط الرئيسي. */
import { Activity, BadgeDollarSign, CalendarClock, Factory, PackageCheck, ShipWheel, ShoppingBag, Truck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatCount } from "@/lib/pricing";

type Props = { activity: string; entities: number; items: number; runs: number; openTasks: number; averageMargin: number };
const ACTIVITY_CARD = { "import-export": { key: "kpi.import", icon: ShipWheel }, wholesale: { key: "kpi.wholesale", icon: PackageCheck }, retail: { key: "kpi.retail", icon: ShoppingBag }, manufacturing: { key: "kpi.manufacturing", icon: Factory }, logistics: { key: "kpi.logistics", icon: Truck }, custom: { key: "kpi.custom", icon: Activity } } as const;

export default function ActivityKpiCards({ activity, entities, items, runs, openTasks, averageMargin }: Props) {
  const { t } = useLanguage(); const activityCard = ACTIVITY_CARD[activity as keyof typeof ACTIVITY_CARD] ?? ACTIVITY_CARD["import-export"]; const ActivityIcon = activityCard.icon;
  const cards = [
    { label: t(activityCard.key), value: formatCount(activity === "logistics" ? runs : activity === "manufacturing" ? items : entities), icon: ActivityIcon, tone: "text-[var(--port-green)]" },
    { label: t("kpi.catalog"), value: formatCount(items), icon: PackageCheck, tone: "text-[var(--ink)]" },
    { label: t("kpi.margin"), value: `${averageMargin.toFixed(1)}%`, icon: BadgeDollarSign, tone: "text-[var(--port-green)]" },
    { label: t("kpi.openTasks"), value: formatCount(openTasks), icon: CalendarClock, tone: openTasks ? "text-[var(--amber-line)]" : "text-[var(--port-green)]" },
  ];
  return <section className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4">{cards.map((card) => <div key={card.label} className="metric-card relative overflow-hidden rounded-[0.45rem] px-4 py-3.5"><card.icon className={`absolute end-3 top-3 h-4 w-4 ${card.tone}`} /><p className="text-[11px] text-muted-foreground">{card.label}</p><p className="ledger-figure mt-1 text-3xl text-[var(--ink)]">{card.value}</p></div>)}</section>;
}
