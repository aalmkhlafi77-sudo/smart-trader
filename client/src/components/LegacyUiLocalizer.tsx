import { useLayoutEffect } from "react";
import { EXTRA_LEGACY_UI_TEXT, LEGACY_UI_TEXT } from "@/lib/i18n";
import { useLanguage } from "@/contexts/LanguageContext";

const ATTRIBUTE_NAMES = ["placeholder", "title", "aria-label", "alt"] as const;
const ATTRIBUTE_DATA_KEYS: Record<(typeof ATTRIBUTE_NAMES)[number], keyof DOMStringMap> = {
  placeholder: "i18nPlaceholder",
  title: "i18nTitle",
  "aria-label": "i18nAriaLabel",
  alt: "i18nAlt",
};
const UI_TEXT = { ...LEGACY_UI_TEXT, ...EXTRA_LEGACY_UI_TEXT };

function resolveArabicSource(value: string) {
  if (UI_TEXT[value]) return value;
  return Object.entries(UI_TEXT).find(([, translations]) => translations.en === value || translations.tr === value)?.[0] ?? value;
}

/**
 * يترجم النصوص الثابتة المتبقية في الواجهات القديمة تدريجياً. تتم المقارنة مع
 * المصدر العربي المحفوظ على العنصر؛ لا يُترجم أي محتوى لا يطابق قاموس الواجهة.
 */
export default function LegacyUiLocalizer() {
  const { language } = useLanguage();

  useLayoutEffect(() => {
    const localize = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      for (const node of nodes) {
        const parent = node.parentElement;
        if (!parent || parent.closest("[data-user-content], input, textarea, script, style, .record-card, tbody, [role='listbox']")) continue;
        const isToastText = Boolean(parent.closest("[data-sonner-toast]"));
        const isLeafDocumentText = parent.childElementCount === 0 && parent.matches("p, span");
        const isToastLeaf = isToastText && parent.childElementCount === 0;
        const isUiText = parent.matches("button, label, h1, h2, h3, h4, th, caption, [role='menuitem'], .form-cluster-title, .form-cluster-note, .local-ledger-seal strong, [data-ui-text]") || isLeafDocumentText || isToastLeaf || (parent.matches("p") && (Boolean(parent.closest("[data-ui-text]")) || isToastText));
        const isButtonText = parent.matches("span") && Boolean(parent.closest("button"));
        if (!isUiText && !isButtonText) continue;
        const original = parent.dataset.i18nSource ?? resolveArabicSource(node.nodeValue?.trim() ?? "");
        const translation = UI_TEXT[original]?.[language];
        if (!translation) continue;
        parent.dataset.i18nSource = original;
        const leading = node.nodeValue?.match(/^\s*/)?.[0] ?? "";
        const trailing = node.nodeValue?.match(/\s*$/)?.[0] ?? "";
        const next = language === "ar" ? original : translation;
        if (node.nodeValue !== `${leading}${next}${trailing}`) node.nodeValue = `${leading}${next}${trailing}`;
      }
      document.querySelectorAll<HTMLElement>("[placeholder], [title], [aria-label], [alt]").forEach((element) => {
        if (element.closest("[data-user-content]")) return;
        for (const attribute of ATTRIBUTE_NAMES) {
          const value = element.getAttribute(attribute);
          if (!value) continue;
          const dataKey = ATTRIBUTE_DATA_KEYS[attribute];
          const original = element.dataset[dataKey] ?? resolveArabicSource(value);
          const translation = UI_TEXT[original]?.[language];
          if (!translation) continue;
          element.dataset[dataKey] = original;
          element.setAttribute(attribute, language === "ar" ? original : translation);
        }
      });
    };
    localize();
    const frame = window.requestAnimationFrame(localize);
    const observer = new MutationObserver(() => localize());
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [language]);

  return null;
}
