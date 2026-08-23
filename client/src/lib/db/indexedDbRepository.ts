/**
 * تنفيذ المستودع باستخدام IndexedDB — اتجاه التصميم: "دفتر الميناء"
 * كل السجلات مسطحة ومطابقة لأسماء حقول SQLite، لتسهيل التحويل لاحقاً.
 */

import type { BackupPayload, Repository } from "./repository";
import {
  DB_NAME,
  SCHEMA_VERSION,
  TABLES,
  type AttachmentRow,
  type BackupLogRow,
  type CargoCostAllocationRow,
  type CargoCostItemRow,
  type CargoCostLineRow,
  type CargoCostRunRow,
  type CategoryRow,
  type EntityRow,
  type ItemPriceRow,
  type ItemRow,
  type ItemSpecRow,
  type LogisticsLocationRow,
  type LogisticsRateRow,
  type LogisticsRouteTemplateRow,
  type MetaRow,
  type PriceListItemRow,
  type PriceListRow,
  type PricingRunRow,
  type PriceHistoryRow,
  type SettingsRow,
  type SpecTemplateRow,
  type NoteRow,
  type TaskRow,
} from "./schema";

const STORES = Object.values(TABLES);

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function getAll<T>(store: string): Promise<T[]> {
  return withStore<T[]>(store, "readonly", (s) => s.getAll());
}

async function getById<T>(store: string, id: string): Promise<T | null> {
  const row = await withStore<T | undefined>(store, "readonly", (s) => s.get(id));
  return row ?? null;
}

async function put<T>(store: string, row: T): Promise<void> {
  await withStore(store, "readwrite", (s) => s.put(row as unknown as Record<string, unknown>));
}

async function remove(store: string, id: string): Promise<void> {
  await withStore(store, "readwrite", (s) => s.delete(id));
}

async function clearStore(store: string): Promise<void> {
  await withStore(store, "readwrite", (s) => s.clear());
}

const nowIso = () => new Date().toISOString();

/** يقبل مسميات الجداول القديمة ويحوّلها إلى بنية النسخة الحالية قبل أي حذف أو كتابة. */
function normalizeBackupPayload(payload: BackupPayload): BackupPayload {
  const raw = payload as unknown as { format?: string; schemaVersion?: number; exportedAt?: string; tables?: Record<string, unknown>; [key: string]: unknown };
  const source = raw.tables ?? (raw as unknown as Record<string, unknown>);
  const rows = <T>(...keys: string[]): T[] => {
    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value)) return value as T[];
    }
    return [];
  };
  const templates = rows<SpecTemplateRow>("spec_templates", "specTemplates").map((template) => ({
    ...template,
    category: template.category ?? "",
    unitOptions: template.unitOptions ?? template.defaultUnit ?? "",
  }));

  return {
    format: "smart-trader-backup",
    schemaVersion: typeof raw.schemaVersion === "number" ? raw.schemaVersion : 1,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : nowIso(),
    tables: {
      entities: rows<EntityRow>("entities").map((entity) => ({
        ...entity,
        defaultCurrency: entity.defaultCurrency ?? "دولار",
        defaultExchangeRate: Number(entity.defaultExchangeRate ?? 3.75),
      })),
      categories: rows<CategoryRow>("categories"),
      items: rows<ItemRow>("items").map((item) => ({
        ...item,
        defaultExchangeRate: Number(item.defaultExchangeRate ?? 3.75),
        customsRate: typeof item.customsRate === "number" && Number.isFinite(item.customsRate) ? Math.max(0, item.customsRate) : null,
      })),
      spec_templates: templates,
      item_specs: rows<ItemSpecRow>("item_specs", "itemSpecs", "specs"),
      item_prices: rows<ItemPriceRow>("item_prices", "itemPrices", "prices"),
      price_history: rows<PriceHistoryRow>("price_history", "priceHistory"),
      attachments: rows<AttachmentRow>("attachments"),
      notes: rows<NoteRow>("notes"),
      tasks: rows<TaskRow>("tasks"),
      backup_logs: rows<BackupLogRow>("backup_logs", "backupLogs"),
      pricing_runs: rows<PricingRunRow>("pricing_runs", "pricingRuns", "cost_calculations", "costCalculations"),
      cargo_cost_runs: rows<CargoCostRunRow>("cargo_cost_runs", "cargoCostRuns"),
      cargo_cost_items: rows<CargoCostItemRow>("cargo_cost_items", "cargoCostItems"),
      cargo_cost_lines: rows<CargoCostLineRow>("cargo_cost_lines", "cargoCostLines"),
      cargo_cost_allocations: rows<CargoCostAllocationRow>("cargo_cost_allocations", "cargoCostAllocations"),
      logistics_locations: rows<LogisticsLocationRow>("logistics_locations", "logisticsLocations"),
      logistics_rates: rows<LogisticsRateRow>("logistics_rates", "logisticsRates"),
      logistics_route_templates: rows<LogisticsRouteTemplateRow>("logistics_route_templates", "logisticsRouteTemplates"),
      price_lists: rows<PriceListRow>("price_lists", "priceLists"),
      price_list_items: rows<PriceListItemRow>("price_list_items", "priceListItems"),
      settings: rows<SettingsRow>("settings").map((settings) => ({
        ...settings,
        mainActivity: settings.mainActivity ?? "import-export",
        customActivity: settings.customActivity ?? "",
      })),
      meta: rows<MetaRow>("meta"),
    },
  };
}

const DEFAULT_SPEC_TEMPLATES: Array<Omit<SpecTemplateRow, "createdAt" | "updatedAt">> = [
  { id: "tpl_material", category: "", label: "الخامة", defaultUnit: "", unitOptions: "", placeholder: "مثال: بولي بروبلين", sortOrder: 10, isKeyDefault: 1, showInItem: 1, showInPrices: 1, showInReports: 1, showInExport: 1 },
  { id: "tpl_weight", category: "", label: "الوزن", defaultUnit: "جرام", unitOptions: "جرام|كجم|طن", placeholder: "مثال: 2000", sortOrder: 20, isKeyDefault: 1, showInItem: 1, showInPrices: 1, showInReports: 1, showInExport: 1 },
  { id: "tpl_type", category: "", label: "النوع", defaultUnit: "", unitOptions: "", placeholder: "مثال: سوبر شرنك", sortOrder: 30, isKeyDefault: 1, showInItem: 1, showInPrices: 1, showInReports: 1, showInExport: 1 },
  { id: "tpl_price", category: "", label: "السعر", defaultUnit: "", unitOptions: "دولار|ريال", placeholder: "مثال: 9.00", sortOrder: 40, isKeyDefault: 0, showInItem: 1, showInPrices: 0, showInReports: 0, showInExport: 0 },
  { id: "tpl_color", category: "", label: "اللون", defaultUnit: "", unitOptions: "", placeholder: "مثال: رمادي", sortOrder: 50, isKeyDefault: 0, showInItem: 1, showInPrices: 1, showInReports: 1, showInExport: 1 },
];

export const DEFAULT_SETTINGS: SettingsRow = {
  id: "app",
  localCurrency: "ريال",
  foreignCurrency: "دولار",
  defaultExchangeRate: 3.75,
  defaultCustomsRate: 0.12,
  defaultMarginRate: 0.2,
  companyName: "",
  mainActivity: "import-export",
  customActivity: "",
  updatedAt: nowIso(),
};

export const indexedDbRepository: Repository = {
  async init() {
    await openDb();
    const settings = await getById<SettingsRow>(TABLES.settings, "app");
    if (!settings) await put(TABLES.settings, { ...DEFAULT_SETTINGS, updatedAt: nowIso() });
    else if (typeof settings.mainActivity !== "string" || typeof settings.customActivity !== "string") {
      await put(TABLES.settings, {
        ...settings,
        mainActivity: settings.mainActivity ?? DEFAULT_SETTINGS.mainActivity,
        customActivity: settings.customActivity ?? "",
        updatedAt: settings.updatedAt || nowIso(),
      });
    }
    const meta = await getById<MetaRow>(TABLES.meta, "app");
    if (!meta) {
      await put(TABLES.meta, {
        id: "app",
        schemaVersion: SCHEMA_VERSION,
        lastBackupAt: "",
        updatedAt: nowIso(),
      } satisfies MetaRow);
    } else if (meta.schemaVersion < SCHEMA_VERSION) {
      await put(TABLES.meta, {
        ...meta,
        schemaVersion: SCHEMA_VERSION,
        updatedAt: nowIso(),
      } satisfies MetaRow);
    }
    if (!meta?.specTemplatesSeeded) {
      const templates = await getAll<SpecTemplateRow>(TABLES.specTemplates);
      if (templates.length === 0) {
        const timestamp = nowIso();
        await Promise.all(
          DEFAULT_SPEC_TEMPLATES.map((template) =>
            put(TABLES.specTemplates, { ...template, createdAt: timestamp, updatedAt: timestamp }),
          ),
        );
      }
      await put(TABLES.meta, {
        ...(meta ?? { id: "app", schemaVersion: SCHEMA_VERSION, lastBackupAt: "", updatedAt: nowIso() }),
        schemaVersion: SCHEMA_VERSION,
        specTemplatesSeeded: 1,
        updatedAt: nowIso(),
      } satisfies MetaRow);
    }
    const currentTemplates = await getAll<SpecTemplateRow>(TABLES.specTemplates);
    await Promise.all(
      currentTemplates
        .filter((template) => typeof template.category !== "string" || typeof template.unitOptions !== "string")
        .map((template) =>
          put(TABLES.specTemplates, {
            ...template,
            category: template.category ?? "",
            unitOptions: template.unitOptions ?? template.defaultUnit ?? "",
            updatedAt: nowIso(),
          }),
      ),
    );
    const [legacyEntities, legacyItems] = await Promise.all([getAll<EntityRow>(TABLES.entities), getAll<ItemRow>(TABLES.items)]);
    await Promise.all([
      ...legacyEntities
        .filter((entity) => typeof entity.defaultCurrency !== "string" || typeof entity.defaultExchangeRate !== "number")
        .map((entity) => put(TABLES.entities, {
          ...entity,
          defaultCurrency: entity.defaultCurrency ?? DEFAULT_SETTINGS.foreignCurrency,
          defaultExchangeRate: Number(entity.defaultExchangeRate ?? DEFAULT_SETTINGS.defaultExchangeRate),
          updatedAt: entity.updatedAt || nowIso(),
        })),
      ...legacyItems
        .filter((item) => typeof item.defaultExchangeRate !== "number" || (item.customsRate != null && (!Number.isFinite(item.customsRate) || item.customsRate < 0)) || !("customsRate" in item))
        .map((item) => put(TABLES.items, {
          ...item,
          defaultExchangeRate: DEFAULT_SETTINGS.defaultExchangeRate,
          customsRate: typeof item.customsRate === "number" && Number.isFinite(item.customsRate) ? Math.max(0, item.customsRate) : null,
          updatedAt: item.updatedAt || nowIso(),
        })),
    ]);
  },

  listEntities: () => getAll<EntityRow>(TABLES.entities),
  getEntity: (id) => getById<EntityRow>(TABLES.entities, id),
  saveEntity: (row) => put(TABLES.entities, row),
  deleteEntity: (id) => remove(TABLES.entities, id),

  async listCategories() {
    const all = await getAll<CategoryRow>(TABLES.categories);
    return all.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ar"));
  },
  saveCategory: (row) => put(TABLES.categories, row),
  deleteCategory: (id) => remove(TABLES.categories, id),

  async listSpecTemplates() {
    const all = await getAll<SpecTemplateRow>(TABLES.specTemplates);
    return all.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "ar"));
  },
  saveSpecTemplate: (row) => put(TABLES.specTemplates, row),
  deleteSpecTemplate: (id) => remove(TABLES.specTemplates, id),

  listItems: () => getAll<ItemRow>(TABLES.items),
  getItem: (id) => getById<ItemRow>(TABLES.items, id),
  saveItem: (row) => put(TABLES.items, row),
  deleteItem: (id) => remove(TABLES.items, id),

  async listSpecsByItem(itemId) {
    const all = await getAll<ItemSpecRow>(TABLES.itemSpecs);
    return all.filter((s) => s.itemId === itemId).sort((a, b) => a.sortOrder - b.sortOrder);
  },
  saveSpec: (row) => put(TABLES.itemSpecs, row),
  deleteSpec: (id) => remove(TABLES.itemSpecs, id),
  async deleteSpecsByItem(itemId) {
    const all = await getAll<ItemSpecRow>(TABLES.itemSpecs);
    await Promise.all(all.filter((s) => s.itemId === itemId).map((s) => remove(TABLES.itemSpecs, s.id)));
  },

  async getPriceByItem(itemId) {
    const all = await getAll<ItemPriceRow>(TABLES.itemPrices);
    return all.find((p) => p.itemId === itemId) ?? null;
  },
  listPrices: () => getAll<ItemPriceRow>(TABLES.itemPrices),
  savePrice: (row) => put(TABLES.itemPrices, row),
  async deletePriceByItem(itemId) {
    const all = await getAll<ItemPriceRow>(TABLES.itemPrices);
    await Promise.all(all.filter((p) => p.itemId === itemId).map((p) => remove(TABLES.itemPrices, p.id)));
  },

  async listPriceHistory(itemId) {
    const rows = await getAll<PriceHistoryRow>(TABLES.priceHistory);
    return rows
      .filter((row) => !itemId || row.itemId === itemId)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.createdAt.localeCompare(a.createdAt));
  },
  savePriceHistory: (row) => put(TABLES.priceHistory, row),

  async listAttachments(filter = {}) {
    const rows = await getAll<AttachmentRow>(TABLES.attachments);
    return rows
      .filter((row) => (!filter.entityId || row.entityId === filter.entityId) && (!filter.itemId || row.itemId === filter.itemId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  saveAttachment: (row) => put(TABLES.attachments, row),
  deleteAttachment: (id) => remove(TABLES.attachments, id),

  async listNotes(filter = {}) {
    const rows = await getAll<NoteRow>(TABLES.notes);
    return rows
      .filter((row) => (!filter.entityId || row.entityId === filter.entityId) && (!filter.itemId || row.itemId === filter.itemId))
      .sort((a, b) => b.isPinned - a.isPinned || b.updatedAt.localeCompare(a.updatedAt));
  },
  saveNote: (row) => put(TABLES.notes, row),
  deleteNote: (id) => remove(TABLES.notes, id),

  async listTasks(filter = {}) {
    const rows = await getAll<TaskRow>(TABLES.tasks);
    return rows
      .filter((row) => (!filter.entityId || row.entityId === filter.entityId) && (!filter.itemId || row.itemId === filter.itemId))
      .sort((a, b) => Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt)) || (a.dueAt || "9999").localeCompare(b.dueAt || "9999"));
  },
  saveTask: (row) => put(TABLES.tasks, row),
  deleteTask: (id) => remove(TABLES.tasks, id),

  async listBackupLogs() {
    const rows = await getAll<BackupLogRow>(TABLES.backupLogs);
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  saveBackupLog: (row) => put(TABLES.backupLogs, row),

  listPricingRuns: () => getAll<PricingRunRow>(TABLES.pricingRuns),
  savePricingRun: (row) => put(TABLES.pricingRuns, row),
  deletePricingRun: (id) => remove(TABLES.pricingRuns, id),

  async listCargoCostRuns() {
    const rows = await getAll<CargoCostRunRow>(TABLES.cargoCostRuns);
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  getCargoCostRun: (id) => getById<CargoCostRunRow>(TABLES.cargoCostRuns, id),
  saveCargoCostRun: (row) => put(TABLES.cargoCostRuns, row),
  async deleteCargoCostRun(id) {
    await remove(TABLES.cargoCostRuns, id);
    const [items, lines, allocations] = await Promise.all([
      getAll<CargoCostItemRow>(TABLES.cargoCostItems),
      getAll<CargoCostLineRow>(TABLES.cargoCostLines),
      getAll<CargoCostAllocationRow>(TABLES.cargoCostAllocations),
    ]);
    await Promise.all([
      ...items.filter((row) => row.runId === id).map((row) => remove(TABLES.cargoCostItems, row.id)),
      ...lines.filter((row) => row.runId === id).map((row) => remove(TABLES.cargoCostLines, row.id)),
      ...allocations.filter((row) => row.runId === id).map((row) => remove(TABLES.cargoCostAllocations, row.id)),
    ]);
  },
  async listCargoCostItems(runId) {
    const rows = await getAll<CargoCostItemRow>(TABLES.cargoCostItems);
    return rows.filter((row) => row.runId === runId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  saveCargoCostItem: (row) => put(TABLES.cargoCostItems, row),
  async deleteCargoCostItems(runId) {
    const rows = await getAll<CargoCostItemRow>(TABLES.cargoCostItems);
    await Promise.all(rows.filter((row) => row.runId === runId).map((row) => remove(TABLES.cargoCostItems, row.id)));
  },
  async listCargoCostLines(runId) {
    const rows = await getAll<CargoCostLineRow>(TABLES.cargoCostLines);
    return rows.filter((row) => row.runId === runId).sort((a, b) => a.sortOrder - b.sortOrder);
  },
  saveCargoCostLine: (row) => put(TABLES.cargoCostLines, row),
  async deleteCargoCostLines(runId) {
    const rows = await getAll<CargoCostLineRow>(TABLES.cargoCostLines);
    await Promise.all(rows.filter((row) => row.runId === runId).map((row) => remove(TABLES.cargoCostLines, row.id)));
  },
  async listCargoCostAllocations(runId) {
    const rows = await getAll<CargoCostAllocationRow>(TABLES.cargoCostAllocations);
    return rows.filter((row) => row.runId === runId);
  },
  saveCargoCostAllocation: (row) => put(TABLES.cargoCostAllocations, row),
  async deleteCargoCostAllocations(runId) {
    const rows = await getAll<CargoCostAllocationRow>(TABLES.cargoCostAllocations);
    await Promise.all(rows.filter((row) => row.runId === runId).map((row) => remove(TABLES.cargoCostAllocations, row.id)));
  },

  async listLogisticsLocations() {
    const rows = await getAll<LogisticsLocationRow>(TABLES.logisticsLocations);
    return rows.sort((a, b) => a.name.localeCompare(b.name, "ar"));
  },
  saveLogisticsLocation: (row) => put(TABLES.logisticsLocations, row),
  deleteLogisticsLocation: (id) => remove(TABLES.logisticsLocations, id),
  async listLogisticsRates() {
    const rows = await getAll<LogisticsRateRow>(TABLES.logisticsRates);
    return rows.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || a.name.localeCompare(b.name, "ar"));
  },
  saveLogisticsRate: (row) => put(TABLES.logisticsRates, row),
  deleteLogisticsRate: (id) => remove(TABLES.logisticsRates, id),
  async listLogisticsRouteTemplates() {
    const rows = await getAll<LogisticsRouteTemplateRow>(TABLES.logisticsRouteTemplates);
    return rows.sort((a, b) => a.name.localeCompare(b.name, "ar"));
  },
  saveLogisticsRouteTemplate: (row) => put(TABLES.logisticsRouteTemplates, row),
  deleteLogisticsRouteTemplate: (id) => remove(TABLES.logisticsRouteTemplates, id),

  listPriceLists: () => getAll<PriceListRow>(TABLES.priceLists),
  savePriceList: (row) => put(TABLES.priceLists, row),
  async deletePriceList(id) {
    await remove(TABLES.priceLists, id);
    const all = await getAll<PriceListItemRow>(TABLES.priceListItems);
    await Promise.all(
      all.filter((r) => r.priceListId === id).map((r) => remove(TABLES.priceListItems, r.id)),
    );
  },
  async listPriceListItems(priceListId) {
    const all = await getAll<PriceListItemRow>(TABLES.priceListItems);
    return all.filter((r) => r.priceListId === priceListId).sort((a, b) => a.sortOrder - b.sortOrder);
  },
  savePriceListItem: (row) => put(TABLES.priceListItems, row),
  async deletePriceListItems(priceListId) {
    const all = await getAll<PriceListItemRow>(TABLES.priceListItems);
    await Promise.all(
      all.filter((r) => r.priceListId === priceListId).map((r) => remove(TABLES.priceListItems, r.id)),
    );
  },

  async getSettings() {
    const row = await getById<SettingsRow>(TABLES.settings, "app");
    return row ?? DEFAULT_SETTINGS;
  },
  saveSettings: (row) => put(TABLES.settings, row),

  async getMeta() {
    const row = await getById<MetaRow>(TABLES.meta, "app");
    return (
      row ?? { id: "app", schemaVersion: SCHEMA_VERSION, lastBackupAt: "", updatedAt: nowIso() }
    );
  },
  saveMeta: (row) => put(TABLES.meta, row),

  async exportBackup() {
    const [
      entities,
      categories,
      items,
      spec_templates,
      item_specs,
      item_prices,
      price_history,
      attachments,
      notes,
      tasks,
      backup_logs,
      pricing_runs,
      cargo_cost_runs,
      cargo_cost_items,
      cargo_cost_lines,
      cargo_cost_allocations,
      logistics_locations,
      logistics_rates,
      logistics_route_templates,
      price_lists,
      price_list_items,
      settings,
      meta,
    ] = await Promise.all([
      getAll<EntityRow>(TABLES.entities),
      getAll<CategoryRow>(TABLES.categories),
      getAll<ItemRow>(TABLES.items),
      getAll<SpecTemplateRow>(TABLES.specTemplates),
      getAll<ItemSpecRow>(TABLES.itemSpecs),
      getAll<ItemPriceRow>(TABLES.itemPrices),
      getAll<PriceHistoryRow>(TABLES.priceHistory),
      getAll<AttachmentRow>(TABLES.attachments),
      getAll<NoteRow>(TABLES.notes),
      getAll<TaskRow>(TABLES.tasks),
      getAll<BackupLogRow>(TABLES.backupLogs),
      getAll<PricingRunRow>(TABLES.pricingRuns),
      getAll<CargoCostRunRow>(TABLES.cargoCostRuns),
      getAll<CargoCostItemRow>(TABLES.cargoCostItems),
      getAll<CargoCostLineRow>(TABLES.cargoCostLines),
      getAll<CargoCostAllocationRow>(TABLES.cargoCostAllocations),
      getAll<LogisticsLocationRow>(TABLES.logisticsLocations),
      getAll<LogisticsRateRow>(TABLES.logisticsRates),
      getAll<LogisticsRouteTemplateRow>(TABLES.logisticsRouteTemplates),
      getAll<PriceListRow>(TABLES.priceLists),
      getAll<PriceListItemRow>(TABLES.priceListItems),
      getAll<SettingsRow>(TABLES.settings),
      getAll<MetaRow>(TABLES.meta),
    ]);
    return {
      format: "smart-trader-backup",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(),
      tables: {
        entities,
        categories,
        items,
        spec_templates,
        item_specs,
        item_prices,
        price_history,
        attachments,
        notes,
        tasks,
        backup_logs,
        pricing_runs,
        cargo_cost_runs,
        cargo_cost_items,
        cargo_cost_lines,
        cargo_cost_allocations,
        logistics_locations,
        logistics_rates,
        logistics_route_templates,
        price_lists,
        price_list_items,
        settings,
        meta,
      },
    } satisfies BackupPayload;
  },

  async importBackup(payload, mode) {
    const rawPayload = payload as unknown as { format?: string; tables?: unknown; entities?: unknown; items?: unknown };
    if (rawPayload.format !== "smart-trader-backup" && !rawPayload.tables && !rawPayload.entities && !rawPayload.items) {
      throw new Error("صيغة الملف غير صحيحة");
    }
    const normalized = normalizeBackupPayload(payload);
    if (mode === "replace") {
      await Promise.all(
        [
          TABLES.entities,
          TABLES.categories,
          TABLES.items,
          TABLES.specTemplates,
          TABLES.itemSpecs,
          TABLES.itemPrices,
          TABLES.priceHistory,
          TABLES.attachments,
          TABLES.notes,
          TABLES.tasks,
          TABLES.backupLogs,
          TABLES.pricingRuns,
          TABLES.cargoCostRuns,
          TABLES.cargoCostItems,
          TABLES.cargoCostLines,
          TABLES.cargoCostAllocations,
          TABLES.logisticsLocations,
          TABLES.logisticsRates,
          TABLES.logisticsRouteTemplates,
          TABLES.priceLists,
          TABLES.priceListItems,
        ].map((store) => clearStore(store)),
      );
    }
    const t = normalized.tables;
    const jobs: Promise<void>[] = [];
    t.entities?.forEach((r) => jobs.push(put(TABLES.entities, r)));
    t.categories?.forEach((r) => jobs.push(put(TABLES.categories, r)));
    t.items?.forEach((r) => jobs.push(put(TABLES.items, r)));
    t.spec_templates?.forEach((r) => jobs.push(put(TABLES.specTemplates, r)));
    t.item_specs?.forEach((r) => jobs.push(put(TABLES.itemSpecs, r)));
    t.item_prices?.forEach((r) => jobs.push(put(TABLES.itemPrices, r)));
    t.price_history?.forEach((r) => jobs.push(put(TABLES.priceHistory, r)));
    t.attachments?.forEach((r) => jobs.push(put(TABLES.attachments, r)));
    t.notes?.forEach((r) => jobs.push(put(TABLES.notes, r)));
    t.tasks?.forEach((r) => jobs.push(put(TABLES.tasks, r)));
    t.backup_logs?.forEach((r) => jobs.push(put(TABLES.backupLogs, r)));
    t.pricing_runs?.forEach((r) => jobs.push(put(TABLES.pricingRuns, r)));
    t.cargo_cost_runs?.forEach((r) => jobs.push(put(TABLES.cargoCostRuns, r)));
    t.cargo_cost_items?.forEach((r) => jobs.push(put(TABLES.cargoCostItems, r)));
    t.cargo_cost_lines?.forEach((r) => jobs.push(put(TABLES.cargoCostLines, r)));
    t.cargo_cost_allocations?.forEach((r) => jobs.push(put(TABLES.cargoCostAllocations, r)));
    t.logistics_locations?.forEach((r) => jobs.push(put(TABLES.logisticsLocations, r)));
    t.logistics_rates?.forEach((r) => jobs.push(put(TABLES.logisticsRates, r)));
    t.logistics_route_templates?.forEach((r) => jobs.push(put(TABLES.logisticsRouteTemplates, r)));
    t.price_lists?.forEach((r) => jobs.push(put(TABLES.priceLists, r)));
    t.price_list_items?.forEach((r) => jobs.push(put(TABLES.priceListItems, r)));
    t.settings?.forEach((r) => jobs.push(put(TABLES.settings, r)));
    await Promise.all(jobs);
    if (!t.spec_templates?.length) {
      const existingTemplates = await getAll<SpecTemplateRow>(TABLES.specTemplates);
      if (existingTemplates.length === 0) {
        const timestamp = nowIso();
        await Promise.all(
          DEFAULT_SPEC_TEMPLATES.map((template) =>
            put(TABLES.specTemplates, { ...template, createdAt: timestamp, updatedAt: timestamp }),
          ),
        );
      }
    }
    const currentMeta = await getById<MetaRow>(TABLES.meta, "app");
    await put(TABLES.meta, {
      ...(currentMeta ?? { id: "app", schemaVersion: SCHEMA_VERSION, lastBackupAt: "", updatedAt: nowIso() }),
      schemaVersion: SCHEMA_VERSION,
      specTemplatesSeeded: 1,
      updatedAt: nowIso(),
    } satisfies MetaRow);
  },

  async clearAll() {
    await Promise.all(
      [
        TABLES.entities,
        TABLES.categories,
        TABLES.items,
        TABLES.specTemplates,
        TABLES.itemSpecs,
        TABLES.itemPrices,
        TABLES.priceHistory,
        TABLES.attachments,
        TABLES.notes,
        TABLES.tasks,
        TABLES.backupLogs,
        TABLES.pricingRuns,
        TABLES.cargoCostRuns,
        TABLES.cargoCostItems,
        TABLES.cargoCostLines,
        TABLES.cargoCostAllocations,
        TABLES.logisticsLocations,
        TABLES.logisticsRates,
        TABLES.logisticsRouteTemplates,
        TABLES.priceLists,
        TABLES.priceListItems,
      ].map((s) => clearStore(s)),
    );
  },
};
