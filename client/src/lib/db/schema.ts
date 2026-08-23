/**
 * نموذج البيانات — اتجاه التصميم: "دفتر الميناء"
 * قاعدة إلزامية: كل سجل مسطح بحقول صريحة حتى يمكن نقله إلى SQLite دون تعديل الواجهة.
 * لا كائنات متداخلة، المفاتيح نصية، التواريخ ISO، القيم المالية أرقام.
 */

export const SCHEMA_VERSION = 10;
export const DB_NAME = "smart_trader_db";

export type EntityKind = "supplier" | "customer" | "factory" | "other";

/** تصنيف رئيسي يُدار من الإعدادات ويظهر كقائمة منسدلة في شاشة الأصناف */
export interface CategoryRow {
  id: string;
  name: string;
  notes: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EntityRow {
  id: string;
  name: string;
  kind: EntityKind;
  country: string;
  city: string;
  phone: string;
  email: string;
  contactPerson: string;
  notes: string;
  /** عملة الشراء المرجعية لهذه الجهة، تُورَّث للصنف الجديد المرتبط بها. */
  defaultCurrency: string;
  /** سعر الصرف المرجعي لهذه الجهة، يُستخدم افتراضياً في الصنف والحاسبة. */
  defaultExchangeRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface ItemRow {
  id: string;
  name: string;
  code: string;
  category: string;
  entityId: string | null;
  unit: string;
  currency: string;
  /** سعر صرف مرجعي يرثه الصنف من الجهة ويمكن تعديله للصنف نفسه. */
  defaultExchangeRate: number;
  /** نسبة جمارك الصنف كعدد عشري (0.12 = 12%). null = استخدام الإعداد العام. */
  customsRate?: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** قالب مواصفة يديره المستخدم من الإعدادات ويحدد شكلها ومواضع ظهورها الافتراضية. */
export interface SpecTemplateRow {
  id: string;
  /** فارغ = قالب عام، وإلا يطابق اسم التصنيف الرئيسي للصنف. */
  category: string;
  label: string;
  defaultUnit: string;
  /** وحدات متاحة مفصولة بعلامة |، قابلة للتحويل لاحقاً إلى جدول SQLite مستقل. */
  unitOptions: string;
  placeholder: string;
  sortOrder: number;
  isKeyDefault: number;
  showInItem: number;
  showInPrices: number;
  showInReports: number;
  showInExport: number;
  createdAt: string;
  updatedAt: string;
}

export interface ItemSpecRow {
  id: string;
  itemId: string;
  label: string;
  value: string;
  unit: string;
  sortOrder: number;
  /** 1 = مواصفة مميزة تظهر في جدول المقارنة والأسعار، 0 = مواصفة عادية */
  isKey: number;
  createdAt: string;
  updatedAt: string;
}

/** أربعة أسعار يدوية، ولكل سعر تاريخ اعتماد مستقل يدخله المستخدم. */
export interface ItemPriceRow {
  id: string;
  itemId: string;
  price1: number | null;
  price1Date: string;
  price2: number | null;
  price2Date: string;
  price3: number | null;
  price3Date: string;
  price4: number | null;
  price4Date: string;
  currency: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type PriceLevel = 1 | 2 | 3 | 4;

/** لقطة مؤرخة لقيمة مستوى سعر قبل تعديله، للحفاظ على تاريخ التفاوض. */
export interface PriceHistoryRow {
  id: string;
  itemId: string;
  priceLevel: PriceLevel;
  price: number | null;
  effectiveDate: string;
  currency: string;
  notes: string;
  createdAt: string;
}

/** ملف محلي مرتبط بجهة أو صنف. dataUrl قابل للنقل إلى SQLite لاحقاً. */
export interface AttachmentRow {
  id: string;
  entityId: string | null;
  itemId: string | null;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  createdAt: string;
}

export interface NoteRow {
  id: string;
  title: string;
  body: string;
  entityId: string | null;
  itemId: string | null;
  isPinned: number;
  createdAt: string;
  updatedAt: string;
}

export type TaskPriority = "low" | "medium" | "high";

export interface TaskRow {
  id: string;
  title: string;
  details: string;
  entityId: string | null;
  itemId: string | null;
  dueAt: string;
  priority: TaskPriority;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type BackupLogAction = "export" | "restore" | "merge";

export interface BackupLogRow {
  id: string;
  action: BackupLogAction;
  fileName: string;
  summary: string;
  createdAt: string;
}

export interface PricingRunRow {
  id: string;
  itemId: string;
  itemName: string;
  priceLevel: PriceLevel;
  unitPriceForeign: number;
  exchangeRate: number;
  quantity: number;
  freight: number;
  /** عملة الشحن الدولي كما أدخلها المستخدم: foreign | local */
  freightCurrency: string;
  /** مسار الشحن المدخل من المستخدم، مثل: ميناء شنغهاي ← ميناء جدة */
  shippingRoute: string;
  /** نوع الشحن: بحري أو بري أو جوي أو آخر */
  shippingType: string;
  /** الشحن بعد التحويل إلى العملة المحلية */
  freightLocal: number;
  customsRate: number;
  clearance: number;
  transport: number;
  otherCosts: number;
  marginRate: number;
  goodsValue: number;
  customsAmount: number;
  totalContainerCost: number;
  unitCost: number;
  suggestedPrice: number;
  currency: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** رأس ملف تكلفة الحمولة؛ يحتفظ بالإصدار والمصدر كي لا تتغير العمليات المعتمدة لاحقاً. */
export type CargoRunStatus = "draft" | "review" | "approved" | "archived";
export type CargoOperationType = "import" | "local";

export interface CargoCostRunRow {
  id: string;
  name: string;
  reference: string;
  operationType: CargoOperationType;
  entityId: string | null;
  status: CargoRunStatus;
  parentRunId: string;
  version: number;
  currency: string;
  marginRate: number;
  customsBaseExtra: number;
  routeTemplateId: string;
  originLocationId: string;
  unloadingLocationId: string;
  deliveryLocationId: string;
  incoterm: string;
  transportMode: string;
  clearanceOffice: string;
  invoiceValue: number;
  customsBase: number;
  customsAmount: number;
  totalCost: number;
  totalSuggestedRevenue: number;
  notes: string;
  approvedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** صف صنف داخل حمولة؛ يحمل نسخة السعر والسعر المؤرخ المستخدم فعلياً. */
export interface CargoCostItemRow {
  id: string;
  runId: string;
  itemId: string;
  itemName: string;
  priceLevel: PriceLevel;
  priceSource: "latest-dated" | "manual" | "selected-level";
  priceEffectiveDate: string;
  unitPrice: number;
  currency: string;
  exchangeRate: number;
  quantity: number;
  unit: string;
  customsCategory: string;
  customsRate: number;
  goodsValue: number;
  allocatedCost: number;
  finalUnitCost: number;
  suggestedPrice: number;
  createdAt: string;
  updatedAt: string;
}

export type CargoCostStage = "factory" | "port" | "customs" | "warehouse" | "other";
export type CargoCostStatus = "entered" | "included" | "third-party" | "missing" | "disabled";
export type CargoCostMethod = "fixed" | "per-unit" | "percentage" | "manual" | "included";
export type CargoAllocationBasis = "value" | "quantity" | "weight" | "area" | "volume" | "manual";

/** بطاقة مصروف قابلة للتوسع؛ يمكن حفظها وتوزيعها بصورة مستقلة. */
export interface CargoCostLineRow {
  id: string;
  runId: string;
  name: string;
  stage: CargoCostStage;
  status: CargoCostStatus;
  method: CargoCostMethod;
  allocationBasis: CargoAllocationBasis;
  currency: string;
  exchangeRate: number;
  amount: number;
  referenceQuantity: number;
  referenceUnit: string;
  percentageBase: number;
  itemIds: string;
  sourceLabel: string;
  rateId: string;
  templateId: string;
  effectiveDate: string;
  reason: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** لقطة توزيع مصروف محدد على صنف محدد بعد الحفظ أو الاعتماد. */
export interface CargoCostAllocationRow {
  id: string;
  runId: string;
  costLineId: string;
  itemId: string;
  amount: number;
  createdAt: string;
}

export type LogisticsLocationKind = "origin" | "unloading" | "delivery" | "other";
export interface LogisticsLocationRow {
  id: string;
  name: string;
  kind: LogisticsLocationKind;
  country: string;
  city: string;
  entityId: string | null;
  active: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type LogisticsRateKind = "freight" | "clearance-fee" | "clearance-office" | "transport" | "handling" | "other";
export interface LogisticsRateRow {
  id: string;
  name: string;
  kind: LogisticsRateKind;
  originLocationId: string;
  destinationLocationId: string;
  incoterm: string;
  transportMode: string;
  clearanceOffice: string;
  shipmentDescriptor: string;
  currency: string;
  amount: number;
  method: CargoCostMethod;
  referenceUnit: string;
  effectiveDate: string;
  active: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** قالب مسار مرجعي؛ لا يطبق القيم إلا بعد معاينة المستخدم وتأكيده. */
export interface LogisticsRouteTemplateRow {
  id: string;
  name: string;
  operationType: CargoOperationType;
  originLocationId: string;
  unloadingLocationId: string;
  deliveryLocationId: string;
  incoterm: string;
  transportMode: string;
  clearanceOffice: string;
  customsCategory: string;
  fixedRates: number;
  freightRateId: string;
  clearanceFeeRateId: string;
  clearanceOfficeRateId: string;
  transportRateId: string;
  active: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PriceListRow {
  id: string;
  title: string;
  clientName: string;
  priceLevel: PriceLevel;
  currency: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PriceListItemRow {
  id: string;
  priceListId: string;
  itemId: string;
  itemName: string;
  specSummary: string;
  price: number | null;
  currency: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsRow {
  id: string;
  localCurrency: string;
  foreignCurrency: string;
  defaultExchangeRate: number;
  defaultCustomsRate: number;
  defaultMarginRate: number;
  companyName: string;
  /** نشاط المنشأة الرئيس؛ محفوظ ضمن النسخة الاحتياطية لأنه جزء من هوية العمل. */
  mainActivity: string;
  /** وصف حرّ للنشاط عندما يختار المستخدم "نشاط آخر". */
  customActivity: string;
  updatedAt: string;
}

export interface MetaRow {
  id: string;
  schemaVersion: number;
  lastBackupAt: string;
  /** يمنع إعادة إنشاء القوالب الافتراضية بعد حذفها المتعمد. */
  specTemplatesSeeded?: number;
  updatedAt: string;
}

export const TABLES = {
  entities: "entities",
  categories: "categories",
  items: "items",
  specTemplates: "spec_templates",
  itemSpecs: "item_specs",
  itemPrices: "item_prices",
  priceHistory: "price_history",
  attachments: "attachments",
  notes: "notes",
  tasks: "tasks",
  backupLogs: "backup_logs",
  pricingRuns: "pricing_runs",
  cargoCostRuns: "cargo_cost_runs",
  cargoCostItems: "cargo_cost_items",
  cargoCostLines: "cargo_cost_lines",
  cargoCostAllocations: "cargo_cost_allocations",
  logisticsLocations: "logistics_locations",
  logisticsRates: "logistics_rates",
  logisticsRouteTemplates: "logistics_route_templates",
  priceLists: "price_lists",
  priceListItems: "price_list_items",
  settings: "settings",
  meta: "meta",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];

/**
 * مخطط SQL المكافئ — يُستخدم عند التحويل إلى تطبيق مغلف يعتمد SQLite.
 * محفوظ هنا حتى يبقى نموذج IndexedDB ونموذج SQLite متطابقين في الحقول.
 */
export const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, notes TEXT, sortOrder INTEGER,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL,
  country TEXT, city TEXT, phone TEXT, email TEXT, contactPerson TEXT,
  notes TEXT, defaultCurrency TEXT, defaultExchangeRate REAL,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, category TEXT,
  entityId TEXT, unit TEXT, currency TEXT, defaultExchangeRate REAL, customsRate REAL, notes TEXT,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
  FOREIGN KEY (entityId) REFERENCES entities(id)
);
CREATE TABLE IF NOT EXISTS spec_templates (
  id TEXT PRIMARY KEY, category TEXT, label TEXT NOT NULL, defaultUnit TEXT, unitOptions TEXT, placeholder TEXT,
  sortOrder INTEGER, isKeyDefault INTEGER DEFAULT 0,
  showInItem INTEGER DEFAULT 1, showInPrices INTEGER DEFAULT 1,
  showInReports INTEGER DEFAULT 1, showInExport INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS item_specs (
  id TEXT PRIMARY KEY, itemId TEXT NOT NULL, label TEXT NOT NULL,
  value TEXT, unit TEXT, sortOrder INTEGER, isKey INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
  FOREIGN KEY (itemId) REFERENCES items(id)
);
CREATE TABLE IF NOT EXISTS item_prices (
  id TEXT PRIMARY KEY, itemId TEXT NOT NULL,
  price1 REAL, price1Date TEXT, price2 REAL, price2Date TEXT,
  price3 REAL, price3Date TEXT, price4 REAL, price4Date TEXT,
  currency TEXT, notes TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
  FOREIGN KEY (itemId) REFERENCES items(id)
);
CREATE TABLE IF NOT EXISTS price_history (
  id TEXT PRIMARY KEY, itemId TEXT NOT NULL, priceLevel INTEGER NOT NULL,
  price REAL, effectiveDate TEXT, currency TEXT, notes TEXT, createdAt TEXT NOT NULL,
  FOREIGN KEY (itemId) REFERENCES items(id)
);
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY, entityId TEXT, itemId TEXT, name TEXT, mimeType TEXT,
  size INTEGER, dataUrl TEXT, createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY, title TEXT, body TEXT, entityId TEXT, itemId TEXT,
  isPinned INTEGER DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, title TEXT, details TEXT, entityId TEXT, itemId TEXT,
  dueAt TEXT, priority TEXT, completedAt TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS backup_logs (
  id TEXT PRIMARY KEY, action TEXT, fileName TEXT, summary TEXT, createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pricing_runs (
  id TEXT PRIMARY KEY, itemId TEXT NOT NULL, itemName TEXT,
  priceLevel INTEGER, unitPriceForeign REAL, exchangeRate REAL, quantity REAL,
  freight REAL, freightCurrency TEXT, shippingRoute TEXT, shippingType TEXT, freightLocal REAL,
  customsRate REAL, clearance REAL, transport REAL, otherCosts REAL,
  marginRate REAL, goodsValue REAL, customsAmount REAL, totalContainerCost REAL,
  unitCost REAL, suggestedPrice REAL, currency TEXT, notes TEXT,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cargo_cost_runs (
  id TEXT PRIMARY KEY, name TEXT, reference TEXT, operationType TEXT, entityId TEXT,
  status TEXT, parentRunId TEXT, version INTEGER, currency TEXT, marginRate REAL,
  customsBaseExtra REAL, routeTemplateId TEXT, originLocationId TEXT, unloadingLocationId TEXT,
  deliveryLocationId TEXT, incoterm TEXT, transportMode TEXT, clearanceOffice TEXT,
  invoiceValue REAL, customsBase REAL, customsAmount REAL, totalCost REAL,
  totalSuggestedRevenue REAL, notes TEXT, approvedAt TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cargo_cost_items (
  id TEXT PRIMARY KEY, runId TEXT NOT NULL, itemId TEXT, itemName TEXT, priceLevel INTEGER,
  priceSource TEXT, priceEffectiveDate TEXT, unitPrice REAL, currency TEXT, exchangeRate REAL,
  quantity REAL, unit TEXT, customsCategory TEXT, customsRate REAL, goodsValue REAL,
  allocatedCost REAL, finalUnitCost REAL, suggestedPrice REAL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
  FOREIGN KEY (runId) REFERENCES cargo_cost_runs(id)
);
CREATE TABLE IF NOT EXISTS cargo_cost_lines (
  id TEXT PRIMARY KEY, runId TEXT NOT NULL, name TEXT, stage TEXT, status TEXT, method TEXT,
  allocationBasis TEXT, currency TEXT, exchangeRate REAL, amount REAL, referenceQuantity REAL,
  referenceUnit TEXT, percentageBase REAL, itemIds TEXT, sourceLabel TEXT, rateId TEXT,
  templateId TEXT, effectiveDate TEXT, reason TEXT, sortOrder INTEGER,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, FOREIGN KEY (runId) REFERENCES cargo_cost_runs(id)
);
CREATE TABLE IF NOT EXISTS cargo_cost_allocations (
  id TEXT PRIMARY KEY, runId TEXT NOT NULL, costLineId TEXT NOT NULL, itemId TEXT NOT NULL,
  amount REAL, createdAt TEXT NOT NULL, FOREIGN KEY (runId) REFERENCES cargo_cost_runs(id)
);
CREATE TABLE IF NOT EXISTS logistics_locations (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT, country TEXT, city TEXT, entityId TEXT,
  active INTEGER DEFAULT 1, notes TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS logistics_rates (
  id TEXT PRIMARY KEY, name TEXT, kind TEXT, originLocationId TEXT, destinationLocationId TEXT,
  incoterm TEXT, transportMode TEXT, clearanceOffice TEXT, shipmentDescriptor TEXT,
  currency TEXT, amount REAL, method TEXT, referenceUnit TEXT, effectiveDate TEXT,
  active INTEGER DEFAULT 1, notes TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS logistics_route_templates (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, operationType TEXT, originLocationId TEXT,
  unloadingLocationId TEXT, deliveryLocationId TEXT, incoterm TEXT, transportMode TEXT,
  clearanceOffice TEXT, customsCategory TEXT, fixedRates INTEGER DEFAULT 0,
  freightRateId TEXT, clearanceFeeRateId TEXT, clearanceOfficeRateId TEXT, transportRateId TEXT,
  active INTEGER DEFAULT 1, notes TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS price_lists (
  id TEXT PRIMARY KEY, title TEXT, clientName TEXT, priceLevel INTEGER,
  currency TEXT, notes TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS price_list_items (
  id TEXT PRIMARY KEY, priceListId TEXT NOT NULL, itemId TEXT NOT NULL,
  itemName TEXT, specSummary TEXT, price REAL, currency TEXT, sortOrder INTEGER,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
  FOREIGN KEY (priceListId) REFERENCES price_lists(id)
);
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY, localCurrency TEXT, foreignCurrency TEXT,
  defaultExchangeRate REAL, defaultCustomsRate REAL, defaultMarginRate REAL,
  companyName TEXT, mainActivity TEXT, customActivity TEXT, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  id TEXT PRIMARY KEY, schemaVersion INTEGER, lastBackupAt TEXT, updatedAt TEXT NOT NULL
);
`;
