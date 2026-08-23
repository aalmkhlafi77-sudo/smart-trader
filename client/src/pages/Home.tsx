/** لوحة العمل — دفتر ميناء متكيف؛ الهوية والمؤشرات والتقويم تتغير مع النشاط والتخطيط المحلي. */
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import ActivityKpiCards from "@/components/ActivityKpiCards";
import TaskCalendarCard from "@/components/TaskCalendarCard";
import AppLayout from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useActivityTheme } from "@/contexts/ActivityThemeContext";
import { type DashboardWidgetId, useWorkspacePreferences } from "@/contexts/WorkspacePreferencesContext";
import { db, type PricingRunRow, type TaskRow } from "@/lib/db";
import { formatCount, formatMoney } from "@/lib/pricing";
import { Building2, Calculator, Database, FileDown, HardDrive, Package, Tags } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

const ENTRIES = [
  { href: "/entities", labelKey: "entities.title", descKey: "entities.subtitle", icon: Building2 },
  { href: "/items", labelKey: "items.title", descKey: "home.entry.itemsDesc", icon: Package },
  { href: "/prices", labelKey: "prices.title", descKey: "home.entry.pricesDesc", icon: Tags },
  { href: "/pricing", labelKey: "pricing.title", descKey: "home.entry.pricingDesc", icon: Calculator },
  { href: "/export", labelKey: "export.title", descKey: "home.entry.exportDesc", icon: FileDown },
  { href: "/backup", labelKey: "backup.title", descKey: "home.entry.backupDesc", icon: Database },
];
const ACTIVITY_LABEL_KEYS: Record<string, string> = { "import-export": "activity.importExport", wholesale: "activity.wholesale", retail: "activity.retail", manufacturing: "activity.manufacturing", logistics: "activity.logistics" };

export default function Home() {
  const { t } = useLanguage(); const { visibleWidgets } = useWorkspacePreferences(); const { icon: ActivityIcon } = useActivityTheme();
  const [counts, setCounts] = useState({ entities: 0, items: 0, runs: 0, lists: 0 }); const [recent, setRecent] = useState<PricingRunRow[]>([]); const [tasks, setTasks] = useState<TaskRow[]>([]); const [activity, setActivity] = useState("import-export"); const [customActivity, setCustomActivity] = useState("");
  useEffect(() => { let cancelled = false; (async () => { await db.init(); const [entities, items, runs, lists, settings, taskRows] = await Promise.all([db.listEntities(), db.listItems(), db.listPricingRuns(), db.listPriceLists(), db.getSettings(), db.listTasks()]); if (cancelled) return; setCounts({ entities: entities.length, items: items.length, runs: runs.length, lists: lists.length }); setRecent([...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)); setTasks(taskRows); setActivity(settings.mainActivity ?? "import-export"); setCustomActivity(settings.customActivity ?? ""); })(); return () => { cancelled = true; }; }, []);
  const activityLabel = activity === "custom" && customActivity ? customActivity : t(ACTIVITY_LABEL_KEYS[activity] ?? "activity.importExport");
  const renderWidget = (widget: DashboardWidgetId) => {
    if (widget === "hero") return <section key={widget} className="relative overflow-hidden rounded-[0.65rem] ledger-sheet lg:col-span-2"><img src="/assets/home-hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-l from-[var(--paper)]/95 via-[var(--paper)]/80 to-[var(--paper)]/35" /><div className="relative max-w-xl px-5 py-7 sm:px-8 sm:py-10"><p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-[var(--port-green)]"><ActivityIcon className="h-3.5 w-3.5" />{activityLabel}</p><h2 className="mt-2 font-display text-2xl font-black leading-snug text-[var(--ink-deep)] sm:text-3xl">{t("home.heroTitle")}</h2><p className="mt-3 text-sm leading-relaxed text-foreground/75">{t("home.heroText")}</p><div className="mt-6 flex flex-wrap gap-2.5"><Button asChild size="lg"><Link href="/items">{t("home.addItem")}</Link></Button><Button asChild variant="outline" size="lg" className="bg-card/95"><Link href="/pricing">{t("home.calculateContainer")}</Link></Button></div><div className="mt-5 inline-flex items-center gap-2 rounded border border-[var(--port-green)]/20 bg-card/70 px-2.5 py-1.5 text-[11px] text-muted-foreground"><HardDrive className="h-3.5 w-3.5" />{t("home.localData")}</div></div></section>;
    if (widget === "summary") return <div key={widget} className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4">{[{ label: t("entities.title"), value: counts.entities }, { label: t("items.title"), value: counts.items }, { label: t("home.costRuns"), value: counts.runs }, { label: t("home.priceLists"), value: counts.lists }].map((item) => <div key={item.label} className="metric-card rounded-[0.45rem] px-4 py-3.5"><p className="text-[11px] text-muted-foreground">{item.label}</p><p className="ledger-figure mt-1 text-3xl text-[var(--ink)]">{formatCount(item.value)}</p></div>)}</div>;
    if (widget === "kpis") { const done = tasks.filter((task) => Boolean(task.completedAt)).length; const averageMargin = recent.length ? recent.reduce((sum, run) => sum + (run.unitCost ? ((run.suggestedPrice - run.unitCost) / run.unitCost) * 100 : 0), 0) / recent.length : 0; return <ActivityKpiCards key={widget} activity={activity} entities={counts.entities} items={counts.items} runs={counts.runs} openTasks={tasks.length - done} averageMargin={averageMargin} />; }
    if (widget === "entries") return <SectionCard key={widget} title={t("home.entries")} hint={t("home.entriesHint")} stamp={t("home.ledgerIndex")}><div className="grid gap-2.5 sm:grid-cols-2">{ENTRIES.map(({ href, labelKey, descKey, icon: Icon }) => <Link key={href} href={href} className="record-card group flex items-start gap-3 rounded-[0.45rem] px-3.5 py-3"><span className="mt-0.5 rounded-[0.35rem] border border-border bg-secondary p-2 text-[var(--ink)]"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-sm font-semibold text-[var(--ink)]">{t(labelKey)}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{t(descKey)}</span></span></Link>)}</div></SectionCard>;
    if (widget === "calendar") return <TaskCalendarCard key={widget} tasks={tasks} />;
    return <SectionCard key={widget} title={t("home.latestCosts")} hint={t("home.latestCostsHint")} stamp={t("home.costRegister")}>{recent.length === 0 ? <p className="text-sm text-muted-foreground">{t("home.noCosts")}</p> : <ul className="calc-line">{recent.map((run) => <li key={run.id} className="calc-node flex items-center justify-between gap-3 border-b border-border/70 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-medium">{run.itemName}</p><p className="text-[11px] text-muted-foreground">{t("home.unitCost")} {formatMoney(run.unitCost, run.currency)}</p></div><span className="ledger-figure shrink-0 rounded bg-[var(--port-green-soft)] px-2.5 py-1 text-sm text-[var(--ink-deep)]">{formatMoney(run.suggestedPrice, run.currency)}</span></li>)}</ul>}</SectionCard>;
  };
  return <AppLayout title={t("home.title")} subtitle={t("home.ledgerSubtitle")}><div className="grid gap-5 lg:grid-cols-2">{visibleWidgets.map(renderWidget)}</div></AppLayout>;
}
