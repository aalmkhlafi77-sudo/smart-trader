/**
 * شاشة الإعدادات — اتجاه التصميم: "دفتر الميناء"
 * الحقول الكهرمانية يدخلها المستخدم، والقيم المحفوظة تُستخدم كقيم افتراضية في الحاسبة.
 * التخزين محلي بالكامل ضمن جدول settings المتوافق مع SQLite.
 */

import AppLayout from "@/components/AppLayout";
import AccessSettingsCard from "@/components/AccessSettingsCard";
import FloatingCalculatorSettingsCard from "@/components/FloatingCalculatorSettingsCard";
import LoginBackgroundSettingsCard from "@/components/LoginBackgroundSettingsCard";
import LogisticsTemplatesSettingsCard from "@/components/LogisticsTemplatesSettingsCard";
import SettingsFold from "@/components/SettingsFold";
import WorkspaceCustomizationCard from "@/components/WorkspaceCustomizationCard";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db, type CategoryRow, type SettingsRow, type SpecTemplateRow } from "@/lib/db";
import { newId, nowIso } from "@/lib/id";
import { formatMoney, parseNumber } from "@/lib/pricing";
import { ChevronDown, ChevronUp, Copy, Eye, FileSpreadsheet, Info, LayoutList, Pencil, Plus, RotateCcw, Save, Star, Tags, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const BASE_LOCAL = ["ريال", "درهم", "دينار", "جنيه"];
const BASE_FOREIGN = ["دولار", "يورو", "يوان", "روبية"];
const emptyTemplateDraft = {
  category: "",
  label: "",
  defaultUnit: "",
  unitOptions: "",
  placeholder: "",
  isKeyDefault: true,
  showInItem: true,
  showInPrices: true,
  showInReports: true,
  showInExport: true,
};

export default function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const [deviceLanguage, setDeviceLanguage] = useState(language);
  const [row, setRow] = useState<SettingsRow | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [mainActivity, setMainActivity] = useState("import-export");
  const [customActivity, setCustomActivity] = useState("");
  const [localCurrency, setLocalCurrency] = useState("ريال");
  const [foreignCurrency, setForeignCurrency] = useState("دولار");
  const [localOptions, setLocalOptions] = useState<string[]>(BASE_LOCAL);
  const [foreignOptions, setForeignOptions] = useState<string[]>(BASE_FOREIGN);
  const [addingLocal, setAddingLocal] = useState(false);
  const [addingForeign, setAddingForeign] = useState(false);
  const [newLocal, setNewLocal] = useState("");
  const [newForeign, setNewForeign] = useState("");
  const [rate, setRate] = useState("3.75");
  const [customs, setCustoms] = useState("12");
  const [margin, setMargin] = useState("20");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [templates, setTemplates] = useState<SpecTemplateRow[]>([]);
  const [templateDraft, setTemplateDraft] = useState(emptyTemplateDraft);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [copySourceCategory, setCopySourceCategory] = useState("__all__");
  const [copyTargetCategory, setCopyTargetCategory] = useState("");

  const apply = (s: SettingsRow) => {
    setRow(s);
    setCompanyName(s.companyName);
    setMainActivity(s.mainActivity ?? "import-export");
    setCustomActivity(s.customActivity ?? "");
    setLocalCurrency(s.localCurrency);
    setForeignCurrency(s.foreignCurrency);
    setLocalOptions((prev) => Array.from(new Set([...prev, s.localCurrency])));
    setForeignOptions((prev) => Array.from(new Set([...prev, s.foreignCurrency])));
    setRate(String(s.defaultExchangeRate));
    setCustoms(String(Math.round(s.defaultCustomsRate * 100)));
    setMargin(String(Math.round(s.defaultMarginRate * 100)));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await db.init();
      const s = await db.getSettings();
      const [cats, templateList] = await Promise.all([db.listCategories(), db.listSpecTemplates()]);
      if (cancelled) return;
      apply(s);
      setCategories(cats);
      setTemplates(templateList);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setDeviceLanguage(language);
  }, [language]);

  const saveDeviceLanguage = () => {
    setLanguage(deviceLanguage);
    toast.success(t("settings.defaultLanguageSaved"));
  };

  const save = async () => {
    if (!row) return;
    const rateVal = parseNumber(rate);
    if (rateVal <= 0) {
      toast.error("سعر الصرف يجب أن يكون أكبر من صفر");
      return;
    }
    const next: SettingsRow = {
      ...row,
      companyName: companyName.trim(),
      mainActivity,
      customActivity: customActivity.trim(),
      localCurrency: localCurrency.trim() || "ريال",
      foreignCurrency: foreignCurrency.trim() || "دولار",
      defaultExchangeRate: rateVal,
      defaultCustomsRate: parseNumber(customs) / 100,
      defaultMarginRate: parseNumber(margin) / 100,
      updatedAt: nowIso(),
    };
    await db.saveSettings(next);
    setRow(next);
    window.dispatchEvent(new Event("smart-trader:activity-updated"));
    toast.success("تم حفظ الإعدادات على جهازك");
  };

  const restore = () => {
    setLocalCurrency("ريال");
    setForeignCurrency("دولار");
    setRate("3.75");
    setCustoms("12");
    setMargin("20");
    toast.info("تمت استعادة القيم الأولية. اضغط حفظ لاعتمادها.");
  };

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) {
      toast.error("أدخل اسم التصنيف");
      return;
    }
    if (categories.some((c) => c.name === name)) {
      toast.error("هذا التصنيف مسجل مسبقاً");
      return;
    }
    const now = nowIso();
    const row: CategoryRow = {
      id: newId("cat"),
      name,
      notes: "",
      sortOrder: categories.length,
      createdAt: now,
      updatedAt: now,
    };
    await db.saveCategory(row);
    setCategories(await db.listCategories());
    setNewCategory("");
    toast.success("تمت إضافة التصنيف");
  };

  const removeCategory = async (id: string) => {
    await db.deleteCategory(id);
    setCategories(await db.listCategories());
    toast.success("تم حذف التصنيف");
  };

  const resetTemplateDraft = () => {
    setTemplateDraft(emptyTemplateDraft);
    setEditingTemplateId(null);
  };

  const saveTemplate = async () => {
    const label = templateDraft.label.trim();
    if (!label) {
      toast.error("أدخل اسم المواصفة الفنية");
      return;
    }
    const duplicate = templates.some(
      (template) => template.label === label && template.category === templateDraft.category && template.id !== editingTemplateId,
    );
    if (duplicate) {
      toast.error("هذه المواصفة مسجلة مسبقاً");
      return;
    }
    const existing = editingTemplateId ? templates.find((template) => template.id === editingTemplateId) ?? null : null;
    const timestamp = nowIso();
    const units = templateDraft.unitOptions
      .split(/[|,،]/)
      .map((unit) => unit.trim())
      .filter(Boolean);
    const defaultUnit = templateDraft.defaultUnit.trim() || units[0] || "";
    await db.saveSpecTemplate({
      id: existing?.id ?? newId("tpl"),
      category: templateDraft.category,
      label,
      defaultUnit,
      unitOptions: Array.from(new Set(units)).join("|"),
      placeholder: templateDraft.placeholder.trim(),
      sortOrder: existing?.sortOrder ?? (templates.length + 1) * 10,
      isKeyDefault: templateDraft.isKeyDefault ? 1 : 0,
      showInItem: templateDraft.showInItem ? 1 : 0,
      showInPrices: templateDraft.showInPrices ? 1 : 0,
      showInReports: templateDraft.showInReports ? 1 : 0,
      showInExport: templateDraft.showInExport ? 1 : 0,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    setTemplates(await db.listSpecTemplates());
    resetTemplateDraft();
    toast.success(existing ? "تم تحديث قالب المواصفة" : "تمت إضافة قالب المواصفة");
  };

  const editTemplate = (template: SpecTemplateRow) => {
    setEditingTemplateId(template.id);
    setTemplateDraft({
      category: template.category,
      label: template.label,
      defaultUnit: template.defaultUnit,
      unitOptions: template.unitOptions,
      placeholder: template.placeholder,
      isKeyDefault: template.isKeyDefault === 1,
      showInItem: template.showInItem === 1,
      showInPrices: template.showInPrices === 1,
      showInReports: template.showInReports === 1,
      showInExport: template.showInExport === 1,
    });
  };

  const removeTemplate = async (template: SpecTemplateRow) => {
    if (!window.confirm(`حذف قالب «${template.label}»؟ لن تُحذف المواصفات المسجلة سابقاً داخل الأصناف.`)) return;
    await db.deleteSpecTemplate(template.id);
    setTemplates(await db.listSpecTemplates());
    if (editingTemplateId === template.id) resetTemplateDraft();
    toast.success("تم حذف القالب من الإعدادات");
  };

  const moveTemplate = async (id: string, direction: -1 | 1) => {
    const current = templates.find((template) => template.id === id);
    if (!current) return;
    const ordered = templates.filter((template) => template.category === current.category);
    const index = ordered.findIndex((template) => template.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const timestamp = nowIso();
    await Promise.all(
      ordered.map((template, sortOrder) => db.saveSpecTemplate({ ...template, sortOrder: (sortOrder + 1) * 10, updatedAt: timestamp })),
    );
    setTemplates(await db.listSpecTemplates());
  };

  const copyTemplates = async () => {
    if (!copyTargetCategory) {
      toast.error("اختر التصنيف الذي ستنسخ إليه القوالب");
      return;
    }
    const sourceCategory = copySourceCategory === "__all__" ? "" : copySourceCategory;
    if (sourceCategory === copyTargetCategory) {
      toast.error("اختر تصنيفاً مختلفاً للنسخ إليه");
      return;
    }
    const source = templates.filter((template) => template.category === sourceCategory);
    if (source.length === 0) {
      toast.error("لا توجد قوالب في المصدر المحدد");
      return;
    }
    const existingNames = new Set(
      templates.filter((template) => template.category === copyTargetCategory).map((template) => template.label),
    );
    const toCopy = source.filter((template) => !existingNames.has(template.label));
    if (toCopy.length === 0) {
      toast.info("جميع قوالب المصدر موجودة بالفعل في التصنيف الهدف");
      return;
    }
    const timestamp = nowIso();
    const offset = templates.filter((template) => template.category === copyTargetCategory).length;
    await Promise.all(
      toCopy.map((template, index) =>
        db.saveSpecTemplate({
          ...template,
          id: newId("tpl"),
          category: copyTargetCategory,
          sortOrder: (offset + index + 1) * 10,
          createdAt: timestamp,
          updatedAt: timestamp,
        }),
      ),
    );
    setTemplates(await db.listSpecTemplates());
    toast.success(`تم نسخ ${toCopy.length} قالب إلى تصنيف ${copyTargetCategory}`);
  };

  // مثال حي يوضح أثر الإعدادات: وحدة واحدة بسعر 10 من العملة الأجنبية
  const sampleGoods = 10 * parseNumber(rate);
  const sampleCustoms = sampleGoods * (parseNumber(customs) / 100);
  const sampleCost = sampleGoods + sampleCustoms;
  const samplePrice = sampleCost * (1 + parseNumber(margin) / 100);

  return (
    <AppLayout title={t("settings.title")} subtitle={t("settings.localSubtitle")}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,460px)_1fr] items-start">
        <div className="space-y-5">
          <SettingsFold title="هوية الجهاز ومساحة العمل" hint="اللغة، الحماية، الخلفية والنشاط وتفضيلات مساحة العمل" stamp="مستوى عام" level="general" defaultOpen>
            <div className="space-y-3">
          <SettingsFold title={t("settings.defaultLanguageTitle")} hint={t("settings.defaultLanguageHint")} stamp={t("settings.language")} defaultOpen>
          <SectionCard
            title={t("settings.defaultLanguageTitle")}
            hint={t("settings.defaultLanguageHint")}
            stamp={t("settings.language")}
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
              <Label htmlFor="ui-language">{t("settings.defaultLanguageLabel")}</Label>
              <Select value={deviceLanguage} onValueChange={(value) => setDeviceLanguage(value as typeof language)}>
                <SelectTrigger id="ui-language" className="field-input w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="tr">Türkçe</SelectItem>
                </SelectContent>
              </Select>
              </div>
              <Button type="button" className="w-full" onClick={saveDeviceLanguage}>{t("settings.saveDefaultLanguage")}</Button>
            </div>
          </SectionCard>
          </SettingsFold>

          <SettingsFold title="حماية الدفتر" hint="رمز الدخول وحالة الحماية المحلية" stamp="فرع"><AccessSettingsCard /></SettingsFold>
          <SettingsFold title="خلفية شاشة الدخول" hint="صورة الخلفية والهوية البصرية عند القفل" stamp="فرع"><LoginBackgroundSettingsCard /></SettingsFold>

          <SettingsFold title={t("activity.title")} hint={t("activity.hint")} stamp={t("activity.stamp")} defaultOpen>
          <SectionCard title={t("activity.title")} hint={t("activity.hint")} stamp={t("activity.stamp")}>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="main-activity">{t("activity.label")}</Label>
                <Select value={mainActivity} onValueChange={setMainActivity}>
                  <SelectTrigger id="main-activity" className="field-input w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="import-export">{t("activity.importExport")}</SelectItem>
                    <SelectItem value="wholesale">{t("activity.wholesale")}</SelectItem>
                    <SelectItem value="retail">{t("activity.retail")}</SelectItem>
                    <SelectItem value="manufacturing">{t("activity.manufacturing")}</SelectItem>
                    <SelectItem value="logistics">{t("activity.logistics")}</SelectItem>
                    <SelectItem value="custom">{t("activity.custom")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {mainActivity === "custom" ? <div className="space-y-1.5"><Label htmlFor="custom-activity">{t("activity.customLabel")}</Label><Input id="custom-activity" className="field-input" value={customActivity} onChange={(event) => setCustomActivity(event.target.value)} placeholder={t("activity.customPlaceholder")} /></div> : null}
              <p className="text-[11px] leading-relaxed text-muted-foreground">{t("activity.note")}</p>
            </div>
          </SectionCard>
          </SettingsFold>

          <SettingsFold title="تخصيص لوحة العمل" hint="التخطيطات والوحدات ومؤشرات النشاط" stamp="فرع"><WorkspaceCustomizationCard /></SettingsFold>
          <SettingsFold title="الحاسبة العائمة" hint="إظهار الزر وحفظ موضعه على الشاشة" stamp="فرع"><FloatingCalculatorSettingsCard /></SettingsFold>
            </div>
          </SettingsFold>

          <SettingsFold title="هوية العمل والإعدادات المالية" hint="اسم المنشأة والعملات والقيم الافتراضية للحساب" stamp="مستوى عام" level="general" defaultOpen>
            <div className="space-y-3">
          <SettingsFold title="بيانات المنشأة" hint="اسم يظهر في ترويسات المستندات المصدّرة" stamp="فرع" defaultOpen>
          <SectionCard
            title="بيانات المنشأة"
            hint="يظهر الاسم في ترويسة قوائم الأسعار المصدّرة"
            stamp="هوية الدفتر"
          >
            <div className="space-y-1.5">
              <Label htmlFor="st-company">اسم المنشأة</Label>
              <Input
                id="st-company"
                className="field-input"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="مثال: مؤسسة الإعمار التجارية"
              />
              <p className="text-[11px] text-muted-foreground">
                اتركه فارغاً إن لم ترغب بإظهار اسم في التقارير
              </p>
            </div>
          </SectionCard>
          </SettingsFold>

          <SettingsFold title="العملات" hint="العملة المحلية للتكلفة والأجنبية لأسعار الشراء" stamp="فرع">
          <SectionCard
            title="العملات"
            hint="العملة المحلية للتكلفة، والأجنبية لأسعار الشراء"
            stamp="أساس التحويل"
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>العملة المحلية</Label>
                {addingLocal ? (
                  <div className="flex gap-1.5">
                    <Input
                      className="field-input flex-1"
                      autoFocus
                      placeholder="اسم العملة"
                      value={newLocal}
                      onChange={(e) => setNewLocal(e.target.value)}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="bg-card shrink-0"
                      onClick={() => {
                        const v = newLocal.trim();
                        if (!v) return;
                        setLocalOptions((p) => Array.from(new Set([...p, v])));
                        setLocalCurrency(v);
                        setNewLocal("");
                        setAddingLocal(false);
                      }}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={localCurrency}
                    onValueChange={(v) =>
                      v === "__new__" ? setAddingLocal(true) : setLocalCurrency(v)
                    }
                  >
                    <SelectTrigger className="field-input w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {localOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">+ إضافة عملة أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>العملة الأجنبية</Label>
                {addingForeign ? (
                  <div className="flex gap-1.5">
                    <Input
                      className="field-input flex-1"
                      autoFocus
                      placeholder="اسم العملة"
                      value={newForeign}
                      onChange={(e) => setNewForeign(e.target.value)}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="bg-card shrink-0"
                      onClick={() => {
                        const v = newForeign.trim();
                        if (!v) return;
                        setForeignOptions((p) => Array.from(new Set([...p, v])));
                        setForeignCurrency(v);
                        setNewForeign("");
                        setAddingForeign(false);
                      }}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={foreignCurrency}
                    onValueChange={(v) =>
                      v === "__new__" ? setAddingForeign(true) : setForeignCurrency(v)
                    }
                  >
                    <SelectTrigger className="field-input w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {foreignOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">+ إضافة عملة أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </SectionCard>
          </SettingsFold>

          <SettingsFold title="القيم الافتراضية للحساب" hint="سعر الصرف والجمارك وهامش الربح" stamp="فرع" defaultOpen>
          <SectionCard
            title="القيم الافتراضية للحساب"
            hint="تُحمّل تلقائياً عند فتح حاسبة التكلفة"
            stamp="ثوابت الحساب"
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="st-rate">
                  سعر الصرف ({foreignCurrency} إلى {localCurrency})
                </Label>
                <Input
                  id="st-rate"
                  className="field-input"
                  dir="ltr"
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  أدخل الرقم — يمكن تعديله داخل كل عملية حساب
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="st-customs">نسبة الجمارك %</Label>
                  <Input
                    id="st-customs"
                    className="field-input"
                    dir="ltr"
                    inputMode="decimal"
                    value={customs}
                    onChange={(e) => setCustoms(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">أدخل النسبة الأكثر تكراراً</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-margin">هامش الربح %</Label>
                  <Input
                    id="st-margin"
                    className="field-input"
                    dir="ltr"
                    inputMode="decimal"
                    value={margin}
                    onChange={(e) => setMargin(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">أدخل هامشك المستهدف</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={save} className="flex-1">
                  <Save className="h-4 w-4" />
                  حفظ الإعدادات
                </Button>
                <Button variant="outline" className="bg-card" onClick={restore}>
                  <RotateCcw className="h-4 w-4" />
                  القيم الأولية
                </Button>
              </div>
            </div>
          </SectionCard>
          </SettingsFold>
            </div>
          </SettingsFold>

          <SettingsFold title="مكتبة الشحن والتخليص" hint="المواقع المفتوحة وأسعار الخدمات وقوالب المسارات لحاسبة الحمولة" stamp="مستوى عام" level="general">
            <LogisticsTemplatesSettingsCard />
          </SettingsFold>

          <SettingsFold title="كتالوج الأصناف والمواصفات" hint="التصنيفات وقوالب المواصفات الفنية الظاهرة في الشاشات والتقارير" stamp="مستوى عام" level="general">
            <div className="space-y-3">
          <SettingsFold title="التصنيفات الرئيسية" hint="فهرس التصنيفات المتاح عند تسجيل الصنف" stamp="فرع" defaultOpen>
          <SectionCard
            title="التصنيفات الرئيسية"
            hint="تظهر كقائمة منسدلة في حقل تصنيف الصنف"
            stamp="فهرس التصنيف"
          >
            <div className="space-y-3">
              <div className="flex gap-1.5">
                <Input
                  className="field-input flex-1"
                  placeholder="مثال: موكيت، سيراميك، باركيه"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addCategory();
                  }}
                />
                <Button onClick={addCategory} className="shrink-0">
                  <Plus className="h-4 w-4" />
                  إضافة
                </Button>
              </div>
              {categories.length === 0 ? (
                <div className="rounded border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  لا توجد تصنيفات بعد. أضف تصنيفاتك الرئيسية لتظهر عند تسجيل الأصناف.
                </div>
              ) : (
                <ul className="divide-y divide-border rounded border border-border bg-card">
                  {categories.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="flex items-center gap-2 text-sm">
                        <Tags className="h-3.5 w-3.5 text-[var(--ink)]/60" />
                        {c.name}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeCategory(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground">
                حذف التصنيف لا يحذف الأصناف المرتبطة به، لكنه يزيله من القائمة المنسدلة.
              </p>
            </div>
          </SectionCard>
          </SettingsFold>

          <SettingsFold title="قوالب المواصفات الفنية" hint="إضافة القوالب ونسخها وإدارة ظهورها" stamp="فرع" defaultOpen>
          <SectionCard
            title="قوالب المواصفات الفنية"
            hint="تحكم بالمواصفات الافتراضية وترتيبها ومواضع ظهورها في التطبيق"
            stamp="فهرس المواصفات"
          >
            <div className="space-y-3">
              <SettingsFold level="detail" title={editingTemplateId ? "تعديل قالب مواصفة" : "إضافة مواصفة فنية"} hint="الحقول والوحدات ومواضع الظهور" stamp="تفاصيل" defaultOpen>
              <div className="rounded border border-[var(--amber-line)] bg-[var(--amber-field)] p-3">
                <p className="mb-2 text-xs font-semibold text-[var(--ink)]">
                  {editingTemplateId ? "تعديل قالب المواصفة" : "إضافة مواصفة فنية"}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[11px]">التصنيف المرتبط</Label>
                    <Select value={templateDraft.category || "__all__"} onValueChange={(value) => setTemplateDraft({ ...templateDraft, category: value === "__all__" ? "" : value })}>
                      <SelectTrigger className="field-input w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">قالب عام لجميع التصنيفات</SelectItem>
                        {categories.map((category) => <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">اسم المواصفة</Label>
                    <Input className="field-input" placeholder="مثال: الكثافة" value={templateDraft.label} onChange={(e) => setTemplateDraft({ ...templateDraft, label: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">الوحدة الافتراضية</Label>
                    <Input className="field-input" placeholder="مثال: جرام" value={templateDraft.defaultUnit} onChange={(e) => setTemplateDraft({ ...templateDraft, defaultUnit: e.target.value })} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[11px]">الوحدات المتاحة</Label>
                    <Input className="field-input" placeholder="مثال: جرام | كجم | طن" value={templateDraft.unitOptions} onChange={(e) => setTemplateDraft({ ...templateDraft, unitOptions: e.target.value })} />
                    <p className="text-[10px] text-muted-foreground">افصل الوحدات بعلامة | أو فاصلة. ستظهر كقائمة اختيار عند إدخال الصنف.</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[11px]">نص مساعد عند الإدخال</Label>
                    <Input className="field-input" placeholder="مثال: أدخل الوزن بالجرام" value={templateDraft.placeholder} onChange={(e) => setTemplateDraft({ ...templateDraft, placeholder: e.target.value })} />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[
                    { key: "isKeyDefault" as const, label: "مميزة للمقارنة", icon: Star },
                    { key: "showInItem" as const, label: "بطاقة الصنف", icon: LayoutList },
                    { key: "showInPrices" as const, label: "جدول الأسعار", icon: Tags },
                    { key: "showInReports" as const, label: "التقارير", icon: Eye },
                    { key: "showInExport" as const, label: "Excel والتصدير", icon: FileSpreadsheet },
                  ].map(({ key, label, icon: Icon }) => (
                    <Button
                      key={key}
                      type="button"
                      variant={templateDraft[key] ? "default" : "outline"}
                      className={templateDraft[key] ? "justify-start" : "justify-start bg-card"}
                      onClick={() => setTemplateDraft({ ...templateDraft, [key]: !templateDraft[key] })}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-[11px]">{label}</span>
                    </Button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => void saveTemplate()} className="flex-1"><Save className="h-4 w-4" />{editingTemplateId ? "حفظ التعديل" : "إضافة المواصفة"}</Button>
                  {editingTemplateId ? <Button variant="outline" className="bg-card" onClick={resetTemplateDraft}><RotateCcw className="h-4 w-4" />إلغاء</Button> : null}
                </div>
              </div>
              </SettingsFold>

              <SettingsFold level="detail" title="نسخ القوالب بين التصنيفات" hint="انسخ الإعدادات دون تكرار القوالب الموجودة" stamp="تفاصيل">
              <div className="rounded border border-border bg-secondary/45 p-3">
                <p className="text-xs font-semibold text-[var(--ink)]">نسخ القوالب بين التصنيفات</p>
                <p className="mt-1 text-[10px] text-muted-foreground">انسخ الوحدات والترتيب ومواضع الظهور دفعة واحدة، دون نسخ القوالب المتكررة.</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">المصدر</Label>
                    <Select value={copySourceCategory} onValueChange={setCopySourceCategory}>
                      <SelectTrigger className="field-input w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">القوالب العامة</SelectItem>
                        {categories.map((category) => <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">التصنيف الهدف</Label>
                    <Select value={copyTargetCategory} onValueChange={setCopyTargetCategory} disabled={categories.length === 0}>
                      <SelectTrigger className="field-input w-full"><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="mt-2 w-full" variant="outline" disabled={categories.length === 0} onClick={() => void copyTemplates()}><Copy className="h-4 w-4" />نسخ القوالب</Button>
              </div>
              </SettingsFold>

              <SettingsFold level="detail" title="سجل القوالب المحفوظة" hint="ترتيب القوالب وتعديلها أو حذفها" stamp={`${templates.length} قالب`}>
              {templates.length === 0 ? (
                <div className="rounded border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">لا توجد قوالب مواصفات بعد.</div>
              ) : (
                <ul className="overflow-hidden rounded border border-border bg-card">
                  {templates.map((template, index) => (
                    <li key={template.id} className="border-b border-border p-2.5 last:border-b-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--ink)]">{template.label} {template.defaultUnit ? <span className="text-[11px] font-normal text-muted-foreground">({template.defaultUnit})</span> : null}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{template.category ? `تصنيف: ${template.category}` : "قالب عام"}{template.unitOptions ? ` · وحدات: ${template.unitOptions.split("|").join("، ")}` : ""}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {template.isKeyDefault === 1 ? <span className="rounded bg-[var(--port-green-soft)] px-1.5 py-0.5 text-[9px] text-[var(--ink)]">مقارنة</span> : null}
                            {template.showInItem === 1 ? <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px]">الصنف</span> : null}
                            {template.showInPrices === 1 ? <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px]">الأسعار</span> : null}
                            {template.showInReports === 1 ? <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px]">التقارير</span> : null}
                            {template.showInExport === 1 ? <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px]">التصدير</span> : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} title="رفع" onClick={() => void moveTemplate(template.id, -1)}><ChevronUp className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === templates.length - 1} title="خفض" onClick={() => void moveTemplate(template.id, 1)}><ChevronDown className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="تعديل" onClick={() => editTemplate(template)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="حذف" onClick={() => void removeTemplate(template)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] leading-relaxed text-muted-foreground">إخفاء قالب من مكان ما يؤثر في الظهور الجديد في تلك الصفحة، ولا يحذف بيانات المواصفة المخزنة داخل الأصناف.</p>
              </SettingsFold>
            </div>
          </SectionCard>
          </SettingsFold>
            </div>
          </SettingsFold>
        </div>

        <SectionCard
          title="أثر الإعدادات"
          hint="مثال توضيحي على وحدة واحدة بسعر 10 من العملة الأجنبية"
          stamp="معاينة"
        >
          <div className="calc-line">
            <ul>
              {[
                { k: `قيمة الوحدة (10 × ${parseNumber(rate)})`, v: sampleGoods },
                { k: `الجمارك ${parseNumber(customs)}%`, v: sampleCustoms },
              ].map((r) => (
                <li
                  key={r.k}
                  className="calc-node flex items-center justify-between gap-3 border-b border-border/70 py-2.5"
                >
                  <span className="text-sm text-foreground/85">{r.k}</span>
                  <span className="ledger-figure text-sm text-[var(--ink)]" dir="ltr">
                    {formatMoney(r.v, localCurrency)}
                  </span>
                </li>
              ))}
              <li className="calc-node pt-3" data-total="true">
                <div className="result-card rounded px-4 py-3.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[var(--ink)]">تكلفة الوحدة</span>
                  <span className="ledger-figure text-lg text-[var(--ink-deep)]" dir="ltr">
                    {formatMoney(sampleCost, localCurrency)}
                  </span>
                </div>
              </li>
              <li className="calc-node pt-3" data-total="true">
                <div className="result-card rounded px-4 py-3.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[var(--ink)]">
                    سعر البيع بهامش {parseNumber(margin)}%
                  </span>
                  <span className="ledger-figure text-lg text-[var(--ink-deep)]" dir="ltr">
                    {formatMoney(samplePrice, localCurrency)}
                  </span>
                </div>
              </li>
            </ul>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded border border-border bg-secondary/40 px-3 py-2.5">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-[var(--ink)]/70" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              هذا المثال لا يشمل الشحن والتخليص لأنها تُدخل لكل حاوية على حدة. الإعدادات هنا تُستخدم
              كقيم بداية فقط، ويمكن تجاوزها داخل أي عملية حساب دون تغيير الإعداد العام.
            </p>
          </div>
        </SectionCard>
      </div>
    </AppLayout>
  );
}
