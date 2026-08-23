/**
 * التخطيط العام — اتجاه التصميم: "دفتر الميناء"
 * شريط جانبي حبري على الشاشات الكبيرة، وشريط سفلي على الهاتف. لا توسيط للمحتوى.
 */

import { STORAGE_ENGINE } from "@/lib/db";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAccess } from "@/contexts/AccessContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Building2,
  Calculator,
  Database,
  FileDown,
  HardDrive,
  LayoutDashboard,
  Menu,
  Package,
  ChartNoAxesCombined,
  ClipboardList,
  Settings as SettingsIcon,
  Tags,
  LockKeyhole,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const NAV = [
  { href: "/", labelKey: "nav.home", icon: LayoutDashboard },
  { href: "/entities", labelKey: "nav.entities", icon: Building2 },
  { href: "/items", labelKey: "nav.items", icon: Package },
  { href: "/prices", labelKey: "nav.prices", icon: Tags },
  { href: "/pricing", labelKey: "nav.pricing", icon: Calculator },
  { href: "/reports", labelKey: "nav.reports", icon: ChartNoAxesCombined },
  { href: "/follow-up", labelKey: "nav.followUp", icon: ClipboardList },
  { href: "/export", labelKey: "nav.export", icon: FileDown },
  { href: "/backup", labelKey: "nav.backup", icon: Database },
  { href: "/settings", labelKey: "nav.settings", icon: SettingsIcon },
];

const MOBILE_NAV = NAV.slice(0, 4);

export default function AppLayout({
  children,
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { direction, t } = useLanguage();
  const { lock } = useAccess();

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 px-5 py-6 border-b border-sidebar-border">
          <img
            src="/assets/port-ledger-mark.webp"
              alt={t("app.name")}
            className="brand-seal h-11 w-11 bg-[#f7f2e8] p-1.5"
          />
          <div>
              <p className="font-display text-lg font-extrabold leading-tight tracking-tight">{t("app.name")}</p>
            <p className="text-[11px] text-sidebar-foreground/65">{t("app.tagline")}</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, labelKey, icon: Icon }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors duration-150",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold border-e-2 border-e-[var(--port-green)]"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-sidebar-border">
          <Button type="button" variant="ghost" onClick={lock} className="mb-3 h-9 w-full justify-start gap-2 border border-white/15 bg-white/5 text-xs text-sidebar-foreground hover:bg-white/12 hover:text-white">
            <LockKeyhole className="h-3.5 w-3.5" />
            {t("access.lockNow")}
          </Button>
          <div className="local-ledger-seal flex items-start gap-2 text-[11px] leading-relaxed text-sidebar-foreground/80">
            <HardDrive className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <strong>{t("app.localSaved")}</strong> ({STORAGE_ENGINE}). {t("app.localNote")}
            </span>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-[var(--ink)] text-white/95 lg:bg-card lg:text-foreground border-b border-border">
          <div className="flex items-center gap-3 px-4 py-3.5 lg:px-8">
            <img
              src="/assets/port-ledger-mark.webp"
              alt=""
              className="brand-seal h-9 w-9 bg-[#f7f2e8] p-1 lg:hidden"
            />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-base sm:text-lg lg:text-xl font-bold truncate">
                {title}
              </h1>
              {subtitle ? (
                <p className="text-[11px] sm:text-xs text-white/70 lg:text-muted-foreground truncate">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {action}
            <LanguageSwitcher tone="dark" className="lg:hidden" />
            <LanguageSwitcher tone="light" className="hidden lg:flex" />
          </div>
        </header>

        <main className="flex-1 px-4 py-5 lg:px-8 lg:py-7 pb-24 lg:pb-10">{children}</main>

        <footer className="px-4 lg:px-8 pb-24 lg:pb-6 pt-2">
          <div className="flex items-center justify-center gap-2 border-t border-border pt-4">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--port-green)]" />
            <p className="text-[11px] tracking-wide text-muted-foreground">
              {t("app.design")} <span className="font-semibold text-[var(--ink)]" dir="ltr">Abdullah Almkhlafi</span>{" "}
              <span dir="ltr">2026</span>
            </p>
          </div>
        </footer>

        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--ink)] border-t border-white/10">
          <div className="grid grid-cols-5">
            {MOBILE_NAV.map(({ href, labelKey, icon: Icon }) => {
              const active = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors duration-150",
                    active ? "text-white" : "text-white/60",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  <span className="truncate px-0.5">{t(labelKey)}</span>
                  {active ? <span className="h-0.5 w-6 rounded bg-[var(--port-green)]" /> : null}
                </Link>
              );
            })}
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto flex flex-col items-center gap-1 rounded-none py-2.5 text-[10px] text-white/60 hover:bg-transparent hover:text-white"
                >
                  <Menu className="h-[18px] w-[18px]" />
                  <span>{t("app.more")}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-[1.25rem] border-t-[3px] border-t-[var(--port-green)] px-4 pb-7 pt-3" dir={direction}>
                <SheetHeader className={cn("mb-4", direction === "rtl" ? "text-right" : "text-left")}>
                  <SheetTitle className="font-display text-[var(--ink)]">{t("app.moreTools")}</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-2 gap-2">
                  {NAV.slice(4).map(({ href, labelKey, icon: Icon }) => {
                    const active = location === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded border px-3 py-3 text-sm transition-colors",
                          active
                            ? "border-[var(--port-green)] bg-[var(--port-green-soft)] font-semibold text-[var(--ink)]"
                            : "border-border bg-card text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 text-[var(--ink)]" />
                        {t(labelKey)}
                      </Link>
                    );
                  })}
                </div>
                <Button type="button" variant="outline" onClick={() => { setMoreOpen(false); lock(); }} className="mt-3 w-full border-[var(--ink)]/20 text-[var(--ink)]">
                  <LockKeyhole className="h-4 w-4" />
                  {t("access.lockNow")}
                </Button>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    </div>
  );
}
