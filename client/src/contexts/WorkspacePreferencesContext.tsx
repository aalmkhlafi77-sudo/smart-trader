/** تخصيص لوحة العمل محلياً: تخطيطات محفوظة، ترتيب الوحدات وإظهارها، بلا أثر على سجلات العمل أو النسخ الاحتياطية. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const DASHBOARD_WIDGETS = ["hero", "summary", "kpis", "entries", "recent", "calendar"] as const;
export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number];
export type WorkspaceLayout = { id: string; name: string; layout: DashboardWidgetId[]; hidden: DashboardWidgetId[] };

type StoredWorkspacePreferences = { id: "workspace-dashboard"; activeLayoutId: string; layouts: WorkspaceLayout[] };
type WorkspacePreferencesValue = {
  ready: boolean; layouts: WorkspaceLayout[]; activeLayout: WorkspaceLayout; visibleWidgets: DashboardWidgetId[];
  toggleWidget: (widget: DashboardWidgetId) => void; moveWidget: (widget: DashboardWidgetId, direction: -1 | 1) => void;
  resetDashboard: () => void; selectLayout: (id: string) => void; saveLayout: (name: string) => boolean; duplicateLayout: () => void; deleteLayout: (id: string) => boolean;
};
const DB_NAME = "smart-trader-ui-preferences"; const STORE_NAME = "preferences"; const KEY = "workspace-dashboard";
const baseLayout = (): WorkspaceLayout => ({ id: "default", name: "الدفتر الأساسي", layout: [...DASHBOARD_WIDGETS], hidden: [] });
const defaultPrefs = (): StoredWorkspacePreferences => ({ id: KEY, activeLayoutId: "default", layouts: [baseLayout()] });
const WorkspacePreferencesContext = createContext<WorkspacePreferencesValue | null>(null);

function normalizeLayout(value: Partial<WorkspaceLayout> | undefined, fallbackName: string): WorkspaceLayout {
  const raw = Array.isArray(value?.layout) ? value.layout.filter((item): item is DashboardWidgetId => DASHBOARD_WIDGETS.includes(item as DashboardWidgetId)) : [];
  return { id: typeof value?.id === "string" && value.id ? value.id : `layout-${Date.now()}`, name: typeof value?.name === "string" && value.name.trim() ? value.name.trim() : fallbackName, layout: [...raw, ...DASHBOARD_WIDGETS.filter((item) => !raw.includes(item))], hidden: Array.isArray(value?.hidden) ? value.hidden.filter((item): item is DashboardWidgetId => DASHBOARD_WIDGETS.includes(item as DashboardWidgetId)) : [] };
}
function normalize(value: Partial<StoredWorkspacePreferences> | null): StoredWorkspacePreferences {
  const legacy = value ? (value as unknown as Partial<WorkspaceLayout>) : undefined;
  const layouts = Array.isArray(value?.layouts) && value.layouts.length ? value.layouts.map((item, index) => normalizeLayout(item, `تخطيط ${index + 1}`)) : [normalizeLayout(legacy, "الدفتر الأساسي")];
  const activeLayoutId = layouts.some((item) => item.id === value?.activeLayoutId) ? String(value?.activeLayoutId) : layouts[0].id;
  return { id: KEY, activeLayoutId, layouts };
}
function openDb() { return new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(DB_NAME, 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function readPrefs() { const db = await openDb(); return new Promise<StoredWorkspacePreferences | null>((resolve, reject) => { const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(KEY); request.onsuccess = () => { db.close(); resolve(request.result ?? null); }; request.onerror = () => { db.close(); reject(request.error); }; }); }
async function writePrefs(value: StoredWorkspacePreferences) { const db = await openDb(); return new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE_NAME, "readwrite"); tx.objectStore(STORE_NAME).put(value); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }); }

export function WorkspacePreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<StoredWorkspacePreferences>(defaultPrefs); const [ready, setReady] = useState(false);
  useEffect(() => { void readPrefs().then((saved) => setPreferences(normalize(saved))).catch(() => setPreferences(defaultPrefs())).finally(() => setReady(true)); }, []);
  const persist = useCallback((next: StoredWorkspacePreferences) => { setPreferences(next); void writePrefs(next); }, []);
  const activeLayout = preferences.layouts.find((item) => item.id === preferences.activeLayoutId) ?? preferences.layouts[0];
  const updateActive = useCallback((update: (layout: WorkspaceLayout) => WorkspaceLayout) => { persist({ ...preferences, layouts: preferences.layouts.map((item) => item.id === activeLayout.id ? update(item) : item) }); }, [activeLayout.id, persist, preferences]);
  const toggleWidget = useCallback((widget: DashboardWidgetId) => { const visible = activeLayout.layout.filter((item) => !activeLayout.hidden.includes(item)); if (!activeLayout.hidden.includes(widget) && visible.length === 1) return; updateActive((layout) => ({ ...layout, hidden: layout.hidden.includes(widget) ? layout.hidden.filter((item) => item !== widget) : [...layout.hidden, widget] })); }, [activeLayout, updateActive]);
  const moveWidget = useCallback((widget: DashboardWidgetId, direction: -1 | 1) => { const from = activeLayout.layout.indexOf(widget); const to = from + direction; if (from < 0 || to < 0 || to >= activeLayout.layout.length) return; updateActive((item) => { const layout = [...item.layout]; [layout[from], layout[to]] = [layout[to], layout[from]]; return { ...item, layout }; }); }, [activeLayout.layout, updateActive]);
  const resetDashboard = useCallback(() => updateActive((layout) => ({ ...layout, layout: [...DASHBOARD_WIDGETS], hidden: [] })), [updateActive]);
  const selectLayout = useCallback((id: string) => { if (preferences.layouts.some((item) => item.id === id)) persist({ ...preferences, activeLayoutId: id }); }, [persist, preferences]);
  const saveLayout = useCallback((name: string) => { const label = name.trim(); if (!label || preferences.layouts.some((item) => item.name === label)) return false; const id = `layout-${Date.now()}`; persist({ ...preferences, activeLayoutId: id, layouts: [...preferences.layouts, { ...activeLayout, id, name: label }] }); return true; }, [activeLayout, persist, preferences]);
  const duplicateLayout = useCallback(() => { const id = `layout-${Date.now()}`; persist({ ...preferences, activeLayoutId: id, layouts: [...preferences.layouts, { ...activeLayout, id, name: `${activeLayout.name} · نسخة` }] }); }, [activeLayout, persist, preferences]);
  const deleteLayout = useCallback((id: string) => { if (preferences.layouts.length === 1) return false; const layouts = preferences.layouts.filter((item) => item.id !== id); persist({ ...preferences, layouts, activeLayoutId: preferences.activeLayoutId === id ? layouts[0].id : preferences.activeLayoutId }); return true; }, [persist, preferences]);
  const visibleWidgets = useMemo(() => activeLayout.layout.filter((item) => !activeLayout.hidden.includes(item)), [activeLayout]);
  const value = useMemo(() => ({ ready, layouts: preferences.layouts, activeLayout, visibleWidgets, toggleWidget, moveWidget, resetDashboard, selectLayout, saveLayout, duplicateLayout, deleteLayout }), [activeLayout, deleteLayout, duplicateLayout, moveWidget, preferences.layouts, ready, resetDashboard, saveLayout, selectLayout, toggleWidget, visibleWidgets]);
  return <WorkspacePreferencesContext.Provider value={value}>{children}</WorkspacePreferencesContext.Provider>;
}
export function useWorkspacePreferences() { const context = useContext(WorkspacePreferencesContext); if (!context) throw new Error("useWorkspacePreferences must be used inside WorkspacePreferencesProvider"); return context; }
