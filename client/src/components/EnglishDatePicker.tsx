/**
 * أسلوب: دفتر الميناء — منتقي تاريخ رقمي واضح، دائم الأرقام الإنجليزية داخل واجهة RTL.
 * لا يعتمد على منتقي المتصفح المحلي كي لا يرث أرقام أو ترتيب نظام التشغيل.
 */
import { CalendarDays, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EnglishDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

const toEnglishDigits = (value: string) => value
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));

const pad = (value: number) => String(value).padStart(2, "0");
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseValue = (value: string) => {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  if (![year, month, day].every(Number.isFinite)) return new Date();
  return new Date(year, month - 1, day, Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0);
};

const normalizeTime = (value: string) => {
  const cleaned = toEnglishDigits(value).replace(/[^0-9:]/g, "").slice(0, 5);
  const [rawHour = "", rawMinute = ""] = cleaned.split(":");
  const hour = rawHour.length === 2 ? Math.min(23, Number(rawHour)) : rawHour;
  const minute = rawMinute.length === 2 ? Math.min(59, Number(rawMinute)) : rawMinute;
  return `${typeof hour === "number" ? pad(hour) : hour}${cleaned.includes(":") ? ":" : ""}${typeof minute === "number" ? pad(minute) : minute}`;
};

export default function EnglishDatePicker({ value, onChange, withTime = false, className, disabled, ariaLabel }: EnglishDatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseValue(value), [value]);
  const time = value.includes("T") ? value.split("T")[1].slice(0, 5) : "00:00";
  const display = `${isoDate(selected)}${withTime ? ` · ${time}` : ""}`;

  const selectDate = (date?: Date) => {
    if (!date) return;
    onChange(`${isoDate(date)}${withTime ? `T${time}` : ""}`);
    if (!withTime) setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} aria-label={ariaLabel} dir="ltr" className={cn("field-input english-date-picker w-full justify-start gap-2 font-medium tabular-nums", className)}>
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span>{display}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto border-[var(--field-border)] bg-card p-2" dir="ltr">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={selectDate}
          dir="ltr"
          className="english-date-calendar p-1"
          formatters={{
            formatCaption: (date) => date.toLocaleString("en-US", { month: "long", year: "numeric" }),
            formatWeekdayName: (date) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()],
            formatDay: (date) => String(date.getDate()),
          }}
        />
        {withTime ? <div className="mt-1 flex items-center gap-2 border-t border-[var(--field-border)] px-2 pt-2"><Clock3 className="h-4 w-4 text-[var(--guidance)]" /><Input aria-label="Time" type="text" inputMode="numeric" dir="ltr" className="field-input h-9 flex-1 font-medium tabular-nums" value={time} placeholder="HH:MM" onChange={(event) => onChange(`${isoDate(selected)}T${normalizeTime(event.target.value)}`)} /></div> : null}
      </PopoverContent>
    </Popover>
  );
}
