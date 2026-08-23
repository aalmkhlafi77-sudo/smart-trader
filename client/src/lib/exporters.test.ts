import { describe, expect, it, vi } from "vitest";
import { exportPdf } from "./exporters";

describe("قالب PDF الشامل", () => {
  it("يعرض كل الأقسام في مستند طباعة واحد", () => {
    const write = vi.fn();
    const close = vi.fn();
    vi.stubGlobal("window", { open: vi.fn(() => ({ document: { write, close } })) });
    const result = exportPdf({
      title: "تقرير شامل",
      header: [],
      rows: [],
      sections: [
        { title: "مقارنة المسارات", header: ["المسار"], rows: [["جدة ← الرياض"]], donutChart: { title: "توزيع التكلفة", entries: [{ label: "الشحن", value: 70, color: "#2E74B5" }, { label: "الجمارك", value: 30, color: "#C98517" }] } },
        { title: "تفكيك التكلفة", header: ["البند", "القيمة"], rows: [["الشحن", "100"]] },
      ],
    });
    expect(result).toBe(true);
    expect(write.mock.calls[0][0]).toContain("مقارنة المسارات");
    expect(write.mock.calls[0][0]).toContain("تفكيك التكلفة");
    expect(write.mock.calls[0][0]).toContain("report-section");
    expect(write.mock.calls[0][0]).toContain("donut-block");
    expect(write.mock.calls[0][0]).toContain("70.0%");
    expect(close).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
