/**
 * واجهة مستودع البيانات — اتجاه التصميم: "دفتر الميناء"
 * الواجهة لا تعرف نوع محرك التخزين. أي شاشة تستدعي هذه الدوال فقط.
 * عند التحويل إلى SQLite يكفي إضافة تنفيذ جديد لهذه الواجهة نفسها.
 */

import type {
  AttachmentRow,
  BackupLogRow,
  CargoCostAllocationRow,
  CargoCostItemRow,
  CargoCostLineRow,
  CargoCostRunRow,
  CategoryRow,
  EntityRow,
  ItemPriceRow,
  ItemRow,
  ItemSpecRow,
  LogisticsLocationRow,
  LogisticsRateRow,
  LogisticsRouteTemplateRow,
  MetaRow,
  PriceListItemRow,
  PriceListRow,
  PricingRunRow,
  PriceHistoryRow,
  SettingsRow,
  SpecTemplateRow,
  NoteRow,
  TaskRow,
} from "./schema";

export interface BackupPayload {
  format: "smart-trader-backup";
  schemaVersion: number;
  exportedAt: string;
  tables: {
    entities: EntityRow[];
    categories: CategoryRow[];
    items: ItemRow[];
    spec_templates: SpecTemplateRow[];
    item_specs: ItemSpecRow[];
    item_prices: ItemPriceRow[];
    price_history: PriceHistoryRow[];
    attachments: AttachmentRow[];
    notes: NoteRow[];
    tasks: TaskRow[];
    backup_logs: BackupLogRow[];
    pricing_runs: PricingRunRow[];
    cargo_cost_runs: CargoCostRunRow[];
    cargo_cost_items: CargoCostItemRow[];
    cargo_cost_lines: CargoCostLineRow[];
    cargo_cost_allocations: CargoCostAllocationRow[];
    logistics_locations: LogisticsLocationRow[];
    logistics_rates: LogisticsRateRow[];
    logistics_route_templates: LogisticsRouteTemplateRow[];
    price_lists: PriceListRow[];
    price_list_items: PriceListItemRow[];
    settings: SettingsRow[];
    meta: MetaRow[];
  };
}

export interface Repository {
  init(): Promise<void>;

  listEntities(): Promise<EntityRow[]>;
  getEntity(id: string): Promise<EntityRow | null>;
  saveEntity(row: EntityRow): Promise<void>;
  deleteEntity(id: string): Promise<void>;

  listCategories(): Promise<CategoryRow[]>;
  saveCategory(row: CategoryRow): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  listSpecTemplates(): Promise<SpecTemplateRow[]>;
  saveSpecTemplate(row: SpecTemplateRow): Promise<void>;
  deleteSpecTemplate(id: string): Promise<void>;

  listItems(): Promise<ItemRow[]>;
  getItem(id: string): Promise<ItemRow | null>;
  saveItem(row: ItemRow): Promise<void>;
  deleteItem(id: string): Promise<void>;

  listSpecsByItem(itemId: string): Promise<ItemSpecRow[]>;
  saveSpec(row: ItemSpecRow): Promise<void>;
  deleteSpec(id: string): Promise<void>;
  deleteSpecsByItem(itemId: string): Promise<void>;

  getPriceByItem(itemId: string): Promise<ItemPriceRow | null>;
  listPrices(): Promise<ItemPriceRow[]>;
  savePrice(row: ItemPriceRow): Promise<void>;
  deletePriceByItem(itemId: string): Promise<void>;

  listPriceHistory(itemId?: string): Promise<PriceHistoryRow[]>;
  savePriceHistory(row: PriceHistoryRow): Promise<void>;

  listAttachments(filter?: { entityId?: string; itemId?: string }): Promise<AttachmentRow[]>;
  saveAttachment(row: AttachmentRow): Promise<void>;
  deleteAttachment(id: string): Promise<void>;

  listNotes(filter?: { entityId?: string; itemId?: string }): Promise<NoteRow[]>;
  saveNote(row: NoteRow): Promise<void>;
  deleteNote(id: string): Promise<void>;

  listTasks(filter?: { entityId?: string; itemId?: string }): Promise<TaskRow[]>;
  saveTask(row: TaskRow): Promise<void>;
  deleteTask(id: string): Promise<void>;

  listBackupLogs(): Promise<BackupLogRow[]>;
  saveBackupLog(row: BackupLogRow): Promise<void>;

  listPricingRuns(): Promise<PricingRunRow[]>;
  savePricingRun(row: PricingRunRow): Promise<void>;
  deletePricingRun(id: string): Promise<void>;

  listCargoCostRuns(): Promise<CargoCostRunRow[]>;
  getCargoCostRun(id: string): Promise<CargoCostRunRow | null>;
  saveCargoCostRun(row: CargoCostRunRow): Promise<void>;
  deleteCargoCostRun(id: string): Promise<void>;
  listCargoCostItems(runId: string): Promise<CargoCostItemRow[]>;
  saveCargoCostItem(row: CargoCostItemRow): Promise<void>;
  deleteCargoCostItems(runId: string): Promise<void>;
  listCargoCostLines(runId: string): Promise<CargoCostLineRow[]>;
  saveCargoCostLine(row: CargoCostLineRow): Promise<void>;
  deleteCargoCostLines(runId: string): Promise<void>;
  listCargoCostAllocations(runId: string): Promise<CargoCostAllocationRow[]>;
  saveCargoCostAllocation(row: CargoCostAllocationRow): Promise<void>;
  deleteCargoCostAllocations(runId: string): Promise<void>;

  listLogisticsLocations(): Promise<LogisticsLocationRow[]>;
  saveLogisticsLocation(row: LogisticsLocationRow): Promise<void>;
  deleteLogisticsLocation(id: string): Promise<void>;
  listLogisticsRates(): Promise<LogisticsRateRow[]>;
  saveLogisticsRate(row: LogisticsRateRow): Promise<void>;
  deleteLogisticsRate(id: string): Promise<void>;
  listLogisticsRouteTemplates(): Promise<LogisticsRouteTemplateRow[]>;
  saveLogisticsRouteTemplate(row: LogisticsRouteTemplateRow): Promise<void>;
  deleteLogisticsRouteTemplate(id: string): Promise<void>;

  listPriceLists(): Promise<PriceListRow[]>;
  savePriceList(row: PriceListRow): Promise<void>;
  deletePriceList(id: string): Promise<void>;
  listPriceListItems(priceListId: string): Promise<PriceListItemRow[]>;
  savePriceListItem(row: PriceListItemRow): Promise<void>;
  deletePriceListItems(priceListId: string): Promise<void>;

  getSettings(): Promise<SettingsRow>;
  saveSettings(row: SettingsRow): Promise<void>;

  getMeta(): Promise<MetaRow>;
  saveMeta(row: MetaRow): Promise<void>;

  exportBackup(): Promise<BackupPayload>;
  importBackup(payload: BackupPayload, mode: "replace" | "merge"): Promise<void>;
  clearAll(): Promise<void>;
}
