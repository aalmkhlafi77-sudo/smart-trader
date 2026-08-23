/** تخصيص لوحة العمل — تخطيطات متعددة محلية، ترتيب الوحدات وإظهارها دون التأثير في سجلات العمل. */
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, LayoutDashboard, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type DashboardWidgetId, useWorkspacePreferences } from "@/contexts/WorkspacePreferencesContext";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const WIDGET_KEYS: Record<DashboardWidgetId, string> = { hero: "dashboard.widget.hero", summary: "dashboard.widget.summary", kpis: "dashboard.widget.kpis", entries: "dashboard.widget.entries", recent: "dashboard.widget.recent", calendar: "dashboard.widget.calendar" };

export default function WorkspaceCustomizationCard() {
  const { activeLayout, layouts, moveWidget, resetDashboard, toggleWidget, selectLayout, saveLayout, duplicateLayout, deleteLayout } = useWorkspacePreferences();
  const { t } = useLanguage(); const [name, setName] = useState("");
  const create = () => { if (!saveLayout(name)) return toast.error(t("dashboard.layoutNameError")); setName(""); toast.success(t("dashboard.layoutSaved")); };
  return (
    <SectionCard title={t("dashboard.title")} hint={t("dashboard.hint")} stamp={t("dashboard.stamp")}>
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <Select value={activeLayout.id} onValueChange={selectLayout}><SelectTrigger className="field-input w-full"><SelectValue /></SelectTrigger><SelectContent>{layouts.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
          <Button type="button" variant="outline" className="bg-card" onClick={() => { duplicateLayout(); toast.success(t("dashboard.layoutCopied")); }}><Copy className="h-4 w-4" />{t("dashboard.copy")}</Button>
          <Button type="button" variant="outline" className="bg-card text-destructive" disabled={layouts.length === 1} onClick={() => { if (deleteLayout(activeLayout.id)) toast.success(t("dashboard.layoutDeleted")); }}><Trash2 className="h-4 w-4" />{t("dashboard.delete")}</Button>
        </div>
        <div className="flex gap-2"><Input className="field-input flex-1" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("dashboard.layoutPlaceholder")} /><Button type="button" onClick={create}><Plus className="h-4 w-4" />{t("dashboard.saveLayout")}</Button></div>
        {activeLayout.layout.map((widget, index) => {
          const isHidden = activeLayout.hidden.includes(widget);
          return <div key={widget} className="record-card flex items-center gap-2 rounded px-2.5 py-2"><LayoutDashboard className="h-4 w-4 shrink-0 text-[var(--ink)]" /><span className="min-w-0 flex-1 text-sm font-semibold text-[var(--ink)]">{t(WIDGET_KEYS[widget])}</span><Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={index === 0} aria-label={t("dashboard.moveUp")} onClick={() => moveWidget(widget, -1)}><ChevronUp className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={index === activeLayout.layout.length - 1} aria-label={t("dashboard.moveDown")} onClick={() => moveWidget(widget, 1)}><ChevronDown className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={isHidden ? t("dashboard.show") : t("dashboard.hide")} onClick={() => toggleWidget(widget)}>{isHidden ? <EyeOff className="h-4 w-4 opacity-45" /> : <Eye className="h-4 w-4 text-[var(--port-green)]" />}</Button></div>;
        })}
        <Button type="button" variant="outline" className="w-full" onClick={() => { resetDashboard(); toast.success(t("dashboard.restored")); }}><RotateCcw className="h-4 w-4" />{t("dashboard.restore")}</Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t("dashboard.note")}</p>
      </div>
    </SectionCard>
  );
}
