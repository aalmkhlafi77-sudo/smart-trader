/** تقويم المهام — تقويم شهري محلي يظهر المواعيد ويتيح التنقل بين الأشهر واختيار اليوم. */
/**
 * أسلوب: لوحة متابعة رقمية زجاجية — أولوية المهمة هي الإشارة البصرية الأساسية.
 * كل يوم يضيء بلون أعلى أولوية في مهامه، والقائمة المجاورة تبقى متزامنة مع اليوم المحدد.
 */
import { useMemo, useState } from "react";
import { CalendarDayButton, Calendar } from "@/components/ui/calendar";
import SectionCard from "@/components/SectionCard";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TaskPriority, TaskRow } from "@/lib/db";
import { Activity, CalendarClock, CircleCheck, Clock3, Signal } from "lucide-react";
import { cn } from "@/lib/utils";

const toDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`);
const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const priorityRank: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 };
const priorityOrder: TaskPriority[] = ["high", "medium", "low"];

function strongestPriority(tasks: TaskRow[]): TaskPriority {
  return tasks.reduce<TaskPriority>((highest, task) => priorityRank[task.priority] > priorityRank[highest] ? task.priority : highest, "low");
}

export default function TaskCalendarCard({ tasks }: { tasks: TaskRow[] }) {
  const { t } = useLanguage(); const [selected, setSelected] = useState<Date | undefined>(new Date());
  const dated = useMemo(() => tasks.filter((task) => Boolean(task.dueAt)).sort((a, b) => a.dueAt.localeCompare(b.dueAt)), [tasks]);
  const dates = useMemo(() => dated.map((task) => toDate(task.dueAt)), [dated]);
  const tasksByDate = useMemo(() => dated.reduce<Record<string, TaskRow[]>>((groups, task) => {
    const key = task.dueAt.slice(0, 10);
    groups[key] = [...(groups[key] ?? []), task];
    return groups;
  }, {}), [dated]);
  const selectedTasks = useMemo(() => selected ? [...(tasksByDate[keyOf(selected)] ?? [])].sort((left, right) => priorityRank[right.priority] - priorityRank[left.priority]) : [], [tasksByDate, selected]);
  const calendarLocale = "en-US";
  return <SectionCard
    title={t("calendar.title")}
    hint={t("calendar.hint")}
    stamp={t("calendar.stamp")}
    className="task-calendar-console"
    action={<div className="task-calendar-legend" aria-label={t("calendar.priorityLegend")}>
      {priorityOrder.map((priority) => <span key={priority} className={`priority-${priority}`}><i />{t(`calendar.${priority}`)}</span>)}
    </div>}
  >
    <div className="task-calendar-console-grid">
      <div className="task-calendar-calendar-panel" dir="ltr">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={setSelected}
          modifiers={{ scheduled: dates }}
          formatters={{
            formatCaption: (date) => date.toLocaleDateString(calendarLocale, { month: "long", year: "numeric" }),
            formatWeekdayName: (date) => date.toLocaleDateString(calendarLocale, { weekday: "short" }),
          }}
          components={{
            DayButton: ({ day, modifiers, ...props }) => {
              const dayTasks = tasksByDate[keyOf(day.date)] ?? [];
              const priority = dayTasks.length ? strongestPriority(dayTasks) : null;
              return <CalendarDayButton day={day} modifiers={modifiers} {...props} className={cn("task-calendar-day", priority && `priority-${priority}`, modifiers.selected && "is-selected-date")}>
                <span>{day.date.getDate()}</span>
                {priority ? <span className="task-calendar-data-dots" aria-label={`${dayTasks.length} ${t("calendar.tasksForDay")}`}>{Array.from({ length: Math.min(3, dayTasks.length) }, (_, index) => <i key={index} />)}</span> : null}
              </CalendarDayButton>;
            },
          }}
          className="task-calendar-grid"
        />
      </div>
      <aside className="task-calendar-task-panel">
        <div className="task-calendar-task-header">
          <div><p className="task-calendar-kicker"><Signal />{t("calendar.tasksForDay")}</p><h3 dir="ltr">{selected ? selected.toLocaleDateString(calendarLocale, { day: "numeric", month: "long" }) : t("calendar.selectDay")}</h3></div>
          <span className="task-calendar-count"><Activity />{selectedTasks.length}</span>
        </div>
        {selectedTasks.length ? <ul className="task-calendar-task-list">{selectedTasks.map((task) => <li key={task.id} className={`priority-${task.priority}`}>
          <div className="task-calendar-task-top"><span className="task-calendar-priority-dot" /><p>{task.title}</p></div>
          <div className="task-calendar-task-meta"><span>{task.completedAt ? <CircleCheck /> : <Clock3 />}{task.completedAt ? t("calendar.done") : t("calendar.pending")}</span><span>{t(`calendar.${task.priority}`)}</span></div>
        </li>)}</ul> : <div className="task-calendar-empty"><CalendarClock /><p>{t("calendar.none")}</p></div>}
      </aside>
    </div>
  </SectionCard>;
}
