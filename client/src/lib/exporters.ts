/**
 * وحدة التصدير — اتجاه التصميم: "دفتر الميناء"
 * قاعدة إلزامية: التصدير أحادي الاتجاه، ولا تخرج التكاليف أو الهوامش في ملفات العملاء.
 * الأرقام والتواريخ تُكتب بالصيغة الإنجليزية، والاتجاه العام للمستند من اليمين لليسار.
 */

import * as XLSX from "xlsx";

export interface SheetSpec {
  sheetName: string;
  header: string[];
  rows: (string | number)[][];
  fileName: string;
}

/** تصدير جدول إلى ملف Excel حقيقي بصيغة xlsx */
export function exportExcel({ sheetName, header, rows, fileName }: SheetSpec) {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const widths = header.map((h, i) => {
    const maxCell = rows.reduce((m, r) => Math.max(m, String(r[i] ?? "").length), h.length);
    return { wch: Math.min(Math.max(maxCell + 4, 10), 48) };
  });
  ws["!cols"] = widths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export interface PdfSpec {
  title: string;
  subtitle?: string;
  meta?: string[];
  header: string[];
  rows: (string | number)[][];
  sections?: PdfSection[];
  footerNote?: string;
  landscape?: boolean;
}

export interface PdfSection {
  title: string;
  description?: string;
  header: string[];
  rows: (string | number)[][];
  donutChart?: PdfDonutChart;
}

export interface PdfDonutChart {
  title: string;
  entries: { label: string; value: number; color: string }[];
}

const PRINT_BRAND_LOGO = "/assets/port-ledger-mark.webp";

const escapeHtml = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/**
 * فتح نافذة طباعة مهيأة بصيغة صحيفة سجل، يحفظها المستخدم كـ PDF.
 * استُخدمت الطباعة بدل مكتبة PDF لأن الخطوط العربية تُدار من المتصفح بجودة أعلى.
 */
export function exportPdf({ title, subtitle, meta, header, rows, sections, footerNote, landscape = false }: PdfSpec) {
  const win = window.open("", "_blank", "width=1024,height=768");
  if (!win) return false;
  const renderTable = (tableHeader: string[], tableRows: (string | number)[][]) => `<table>
    <thead><tr>${tableHeader.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
    <tbody>
      ${tableRows
        .map(
          (r) =>
            `<tr>${r
              .map((c, i) =>
                i === 0
                  ? `<td>${escapeHtml(c)}</td>`
                  : `<td class="${typeof c === "number" || /^[\d.,\- ]+$/.test(String(c)) ? "num" : ""}">${escapeHtml(c)}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("")}
    </tbody>
  </table>`;
  const renderDonut = (chart: PdfDonutChart) => {
    const entries = chart.entries.filter((entry) => Number.isFinite(entry.value) && entry.value > 0);
    const total = entries.reduce((sum, entry) => sum + entry.value, 0);
    if (total <= 0) return "";
    const circumference = 301.593;
    let offset = 0;
    const arcs = entries.map((entry) => {
      const dash = (entry.value / total) * circumference;
      const segment = `<circle cx="70" cy="70" r="48" fill="none" stroke="${escapeHtml(entry.color)}" stroke-width="18" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)" />`;
      offset += dash;
      return segment;
    }).join("");
    const legend = entries.map((entry) => {
      const share = (entry.value / total) * 100;
      return `<div class="donut-legend-row"><span class="donut-dot" style="background:${escapeHtml(entry.color)}"></span><span>${escapeHtml(entry.label)}</span><strong>${escapeHtml(share.toFixed(1))}%</strong></div>`;
    }).join("");
    return `<div class="donut-block"><div class="donut-copy"><h3>${escapeHtml(chart.title)}</h3><p>النسب محسوبة من إجمالي تكلفة ملف الحمولة المختار.</p></div><div class="donut-layout"><svg viewBox="0 0 140 140" role="img" aria-label="${escapeHtml(chart.title)}"><circle cx="70" cy="70" r="48" fill="none" stroke="#e8edf0" stroke-width="18" />${arcs}<text x="70" y="66" text-anchor="middle" class="donut-total">100%</text><text x="70" y="84" text-anchor="middle" class="donut-sub">التكلفة</text></svg><div class="donut-legend">${legend}</div></div></div>`;
  };
  const reportBody = sections?.length
    ? sections.map((section) => `<section class="report-section"><h2>${escapeHtml(section.title)}</h2>${section.description ? `<p class="section-desc">${escapeHtml(section.description)}</p>` : ""}${section.donutChart ? renderDonut(section.donutChart) : ""}${renderTable(section.header, section.rows)}</section>`).join("")
    : renderTable(header, rows);
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @font-face { font-family: "Cairo"; font-style: normal; font-weight: 400; font-display: swap; src: url("/fonts/cairo-400.ttf") format("truetype"); }
  @font-face { font-family: "Cairo"; font-style: normal; font-weight: 600; font-display: swap; src: url("/fonts/cairo-600.ttf") format("truetype"); }
  @font-face { font-family: "Cairo"; font-style: normal; font-weight: 800; font-display: swap; src: url("/fonts/cairo-800.ttf") format("truetype"); }
  @font-face { font-family: "IBM Plex Sans Arabic"; font-style: normal; font-weight: 400; font-display: swap; src: url("/fonts/ibm-plex-sans-arabic-400.ttf") format("truetype"); }
  @font-face { font-family: "IBM Plex Sans Arabic"; font-style: normal; font-weight: 500; font-display: swap; src: url("/fonts/ibm-plex-sans-arabic-500.ttf") format("truetype"); }
  @font-face { font-family: "IBM Plex Sans Arabic"; font-style: normal; font-weight: 600; font-display: swap; src: url("/fonts/ibm-plex-sans-arabic-600.ttf") format("truetype"); }
  @page { size: A4${landscape ? " landscape" : ""}; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "IBM Plex Sans Arabic", system-ui, sans-serif;
    color: #12324a; margin: 0; background: #fff;
  }
  .head {
    border-bottom: 2px solid #12324a; padding-bottom: 10px; margin-bottom: 14px;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
  }
  .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .brand-mark { width: 42px; height: 42px; flex: 0 0 42px; object-fit: contain; border: 1px solid #bdd6ca; border-radius: 8px; background: #f7f2e8; padding: 4px; }
  .brand-copy { min-width: 0; }
  .brand-name { color: #12324a; font-family: "Cairo", sans-serif; font-size: 11px; font-weight: 800; letter-spacing: .02em; margin-bottom: 2px; }
  h1 { font-family: "Cairo", sans-serif; font-size: 20px; font-weight: 800; margin: 0; }
  h2 { font-family: "Cairo", sans-serif; color: #12324a; font-size: 15px; margin: 0 0 4px; }
  .sub { font-size: 12px; color: #5b6b78; margin-top: 4px; }
  .meta { font-size: 11px; color: #5b6b78; text-align: left; line-height: 1.7; }
  .report-section { margin-top: 16px; break-inside: avoid; }
  .section-desc { color: #5b6b78; font-size: 10px; margin: 0 0 7px; }
  .donut-block { margin: 10px 0 12px; border: 1px solid #d8dfe4; border-radius: 10px; background: #fbfcfc; padding: 10px 12px; }
  .donut-copy h3 { font-family: "Cairo", sans-serif; color: #12324a; font-size: 13px; margin: 0; }
  .donut-copy p { margin: 2px 0 8px; color: #5b6b78; font-size: 10px; }
  .donut-layout { display: flex; direction: rtl; align-items: center; gap: 16px; }
  .donut-layout svg { width: 142px; height: 142px; flex: 0 0 142px; }
  .donut-total { font-family: "Cairo", sans-serif; fill: #12324a; font-size: 17px; font-weight: 800; }
  .donut-sub { font-family: "IBM Plex Sans Arabic", sans-serif; fill: #5b6b78; font-size: 10px; }
  .donut-legend { flex: 1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 16px; }
  .donut-legend-row { display: grid; grid-template-columns: 9px 1fr auto; align-items: center; gap: 5px; font-size: 10px; color: #334b5d; }
  .donut-dot { width: 8px; height: 8px; border-radius: 99px; }
  .donut-legend-row strong { direction: ltr; color: #12324a; font-family: "Cairo", sans-serif; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th {
    background: #12324a; color: #fff; font-family: "Cairo", sans-serif; font-weight: 600;
    padding: 8px 10px; text-align: right; border: 1px solid #12324a;
  }
  tbody td { padding: 7px 10px; border: 1px solid #d8dfe4; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f7f5f0; }
  .num { font-family: "Cairo", sans-serif; font-weight: 700; direction: ltr; text-align: left; }
  .note {
    margin-top: 14px; font-size: 11px; color: #5b6b78;
    border-inline-start: 3px solid #1f6f54; padding-inline-start: 10px;
  }
  .sign { margin-top: 26px; font-size: 10px; color: #8a9aa6; text-align: center; }
  @media (max-width: 540px) { .donut-legend { grid-template-columns: 1fr; } }
  @media print { .noprint { display: none; } }
</style>
</head>
	<body>
	  <div class="head">
	    <div class="brand">
	      <img class="brand-mark" src="${PRINT_BRAND_LOGO}" alt="شعار التاجر الذكي" />
	      <div class="brand-copy">
	        <div class="brand-name">التاجر الذكي · Smart Trader</div>
	        <h1>${escapeHtml(title)}</h1>
	        ${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ""}
	      </div>
	    </div>
    <div class="meta">${(meta ?? []).map((m) => escapeHtml(m)).join("<br />")}</div>
  </div>
  ${reportBody}
  ${footerNote ? `<div class="note">${escapeHtml(footerNote)}</div>` : ""}
  <div class="sign">التاجر الذكي — دفتر التكلفة والتسعير</div>
  <script>
    window.onload = function () { setTimeout(function () { window.print(); }, 450); };
  </script>
</body>
</html>`;
  win.document.write(html);
  win.document.close();
  return true;
}
