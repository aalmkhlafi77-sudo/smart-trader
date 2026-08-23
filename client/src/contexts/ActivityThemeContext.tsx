/** هوية النشاط — تقرأ النشاط من إعدادات العمل وتطبّق سمة لونية وأيقونة على الواجهة كاملة. */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Boxes, Factory, ShoppingBag, ShipWheel, Truck, type LucideIcon } from "lucide-react";
import { db } from "@/lib/db";

type ActivityTheme = { activity: string; icon: LucideIcon; iconName: string };
const ACTIVITY_META: Record<string, Omit<ActivityTheme, "activity">> = {
  "import-export": { icon: ShipWheel, iconName: "shipping" },
  wholesale: { icon: Boxes, iconName: "wholesale" },
  retail: { icon: ShoppingBag, iconName: "retail" },
  manufacturing: { icon: Factory, iconName: "manufacturing" },
  logistics: { icon: Truck, iconName: "logistics" },
  custom: { icon: ShipWheel, iconName: "custom" },
};
const ActivityThemeContext = createContext<ActivityTheme>({ activity: "import-export", ...ACTIVITY_META["import-export"] });

export function ActivityThemeProvider({ children }: { children: ReactNode }) {
  const [activity, setActivity] = useState("import-export");
  useEffect(() => {
    const load = async () => {
      await db.init();
      const settings = await db.getSettings();
      setActivity(settings.mainActivity || "import-export");
    };
    void load();
    window.addEventListener("smart-trader:activity-updated", load);
    return () => window.removeEventListener("smart-trader:activity-updated", load);
  }, []);
  useEffect(() => { document.documentElement.dataset.activity = activity; }, [activity]);
  const value = useMemo(() => ({ activity, ...(ACTIVITY_META[activity] ?? ACTIVITY_META["import-export"]) }), [activity]);
  return <ActivityThemeContext.Provider value={value}>{children}</ActivityThemeContext.Provider>;
}

export const useActivityTheme = () => useContext(ActivityThemeContext);
