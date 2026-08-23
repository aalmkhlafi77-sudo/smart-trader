/**
 * المتابعة والملاحظات — اتجاه التصميم: دفتر الميناء.
 * كل ملاحظة أو مهمة يمكن ربطها بجهة أو صنف، وتبقى محلية وقابلة للنسخ الاحتياطي.
 */

import AppLayout from "@/components/AppLayout";
import EnglishDatePicker from "@/components/EnglishDatePicker";
import EmptyHint from "@/components/EmptyHint";
import SectionCard from "@/components/SectionCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { db, type EntityRow, type ItemRow, type NoteRow, type TaskPriority, type TaskRow } from "@/lib/db";
import { newId, nowDateTimeInput, nowIso } from "@/lib/id";
import { formatDateTime } from "@/lib/pricing";
import { Check, ClipboardList, Eye, NotebookPen, Pencil, Pin, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const EMPTY_NOTE = { title: "", body: "", entityId: "unlinked", itemId: "unlinked", isPinned: false };
const createEmptyTask = () => ({ title: "", details: "", entityId: "unlinked", itemId: "unlinked", dueAt: nowDateTimeInput(), priority: "medium" as TaskPriority });

const priorityLabel: Record<TaskPriority, string> = { high: "عالية", medium: "متوسطة", low: "منخفضة" };

export default function FollowUp() {
  const { t } = useLanguage();
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [noteForm, setNoteForm] = useState(EMPTY_NOTE);
  const [taskForm, setTaskForm] = useState(createEmptyTask);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [viewingTask, setViewingTask] = useState<TaskRow | null>(null);

  const load = async () => {
    await db.init();
    const [entityRows, itemRows, noteRows, taskRows] = await Promise.all([db.listEntities(), db.listItems(), db.listNotes(), db.listTasks()]);
    setEntities(entityRows.sort((a, b) => a.name.localeCompare(b.name, "ar")));
    setItems(itemRows.sort((a, b) => a.name.localeCompare(b.name, "ar")));
    setNotes(noteRows);
    setTasks(taskRows);
  };

  useEffect(() => { void load(); }, []);

  const entityNames = useMemo(() => new Map(entities.map((row) => [row.id, row.name])), [entities]);
  const itemNames = useMemo(() => new Map(items.map((row) => [row.id, row.name])), [items]);
  const relation = (entityId: string | null, itemId: string | null) => {
    const labels = [entityId ? entityNames.get(entityId) : "", itemId ? itemNames.get(itemId) : ""].filter(Boolean);
    return labels.length ? labels.join(" — ") : "ملاحظة عامة";
  };

  const saveNote = async () => {
    if (!noteForm.title.trim() && !noteForm.body.trim()) return toast.error("اكتب عنواناً أو محتوى للملاحظة");
    const stamp = nowIso();
    await db.saveNote({
      id: newId("note"), title: noteForm.title.trim() || "ملاحظة بلا عنوان", body: noteForm.body.trim(),
      entityId: noteForm.entityId === "unlinked" ? null : noteForm.entityId,
      itemId: noteForm.itemId === "unlinked" ? null : noteForm.itemId,
      isPinned: noteForm.isPinned ? 1 : 0, createdAt: stamp, updatedAt: stamp,
    });
    setNoteForm(EMPTY_NOTE);
    toast.success("تم حفظ الملاحظة");
    await load();
  };

  const saveTask = async () => {
    if (!taskForm.title.trim()) return toast.error("اكتب عنوان المهمة أولاً");
    const stamp = nowIso();
    const existingTask = editingTaskId ? tasks.find((task) => task.id === editingTaskId) : null;
    await db.saveTask({
      id: existingTask?.id ?? newId("task"), title: taskForm.title.trim(), details: taskForm.details.trim(),
      entityId: taskForm.entityId === "unlinked" ? null : taskForm.entityId,
      itemId: taskForm.itemId === "unlinked" ? null : taskForm.itemId,
      dueAt: taskForm.dueAt || nowDateTimeInput(), priority: taskForm.priority,
      completedAt: existingTask?.completedAt ?? "", createdAt: existingTask?.createdAt ?? stamp, updatedAt: stamp,
    });
    setTaskForm(createEmptyTask());
    setEditingTaskId(null);
    toast.success(existingTask ? t("followup.taskUpdated") : "تمت إضافة المهمة أو الموعد");
    await load();
  };

  const startTaskEdit = (task: TaskRow) => {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      details: task.details,
      entityId: task.entityId ?? "unlinked",
      itemId: task.itemId ?? "unlinked",
      dueAt: task.dueAt || nowDateTimeInput(),
      priority: task.priority,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelTaskEdit = () => {
    setEditingTaskId(null);
    setTaskForm(createEmptyTask());
  };

  const toggleTask = async (task: TaskRow) => {
    await db.saveTask({ ...task, completedAt: task.completedAt ? "" : nowIso(), updatedAt: nowIso() });
    await load();
  };

  return (
    <AppLayout title={t("followup.title")} subtitle={t("followup.subtitle")}>
      <div className="grid gap-5 xl:grid-cols-2 items-start">
        <SectionCard title="إضافة ملاحظة" hint="ثبّت الملاحظات المهمة أو اربطها بجهة أو صنف" stamp="دفتر الميدان">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>العنوان</Label><Input className="field-input" value={noteForm.title} onChange={(e) => setNoteForm((x) => ({ ...x, title: e.target.value }))} placeholder="مثال: ملاحظة زيارة المصنع" /></div>
              <div className="space-y-1.5"><Label>الجهة</Label><Select value={noteForm.entityId} onValueChange={(value) => setNoteForm((x) => ({ ...x, entityId: value }))}><SelectTrigger className="field-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unlinked">بدون جهة</SelectItem>{entities.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>الصنف</Label><Select value={noteForm.itemId} onValueChange={(value) => setNoteForm((x) => ({ ...x, itemId: value }))}><SelectTrigger className="field-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unlinked">بدون صنف</SelectItem>{items.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent></Select></div>
              <label className="mt-auto flex h-10 items-center gap-2 rounded border border-border bg-secondary/35 px-3 text-xs"><input type="checkbox" checked={noteForm.isPinned} onChange={(e) => setNoteForm((x) => ({ ...x, isPinned: e.target.checked }))} /> تثبيت في أعلى السجل</label>
            </div>
            <div className="space-y-1.5"><Label>المحتوى</Label><Textarea className="field-input min-h-24" value={noteForm.body} onChange={(e) => setNoteForm((x) => ({ ...x, body: e.target.value }))} placeholder="اكتب ملاحظات الزيارة أو المقارنة أو بنود التفاوض..." /></div>
            <Button onClick={() => void saveNote()} className="form-action-bar w-full"><NotebookPen className="h-4 w-4" />حفظ الملاحظة</Button>
          </div>
        </SectionCard>

        <SectionCard title={editingTaskId ? t("followup.editTask") : "إضافة مهمة أو موعد"} hint="تابع زيارة أو اتصالاً أو قراراً مطلوباً" stamp="دفتر المواعيد">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>عنوان المهمة</Label><Input className="field-input" value={taskForm.title} onChange={(e) => setTaskForm((x) => ({ ...x, title: e.target.value }))} placeholder="مثال: مراجعة عرض موكيت" /></div>
              <div className="space-y-1.5"><Label>الموعد</Label><EnglishDatePicker withTime value={taskForm.dueAt} onChange={(dueAt) => setTaskForm((x) => ({ ...x, dueAt }))} ariaLabel="Task due date and time" /></div>
              <div className="space-y-1.5"><Label>الأولوية</Label><Select value={taskForm.priority} onValueChange={(value) => setTaskForm((x) => ({ ...x, priority: value as TaskPriority }))}><SelectTrigger className="field-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">عالية</SelectItem><SelectItem value="medium">متوسطة</SelectItem><SelectItem value="low">منخفضة</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>الجهة</Label><Select value={taskForm.entityId} onValueChange={(value) => setTaskForm((x) => ({ ...x, entityId: value }))}><SelectTrigger className="field-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unlinked">بدون جهة</SelectItem>{entities.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>الصنف</Label><Select value={taskForm.itemId} onValueChange={(value) => setTaskForm((x) => ({ ...x, itemId: value }))}><SelectTrigger className="field-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unlinked">بدون صنف</SelectItem>{items.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-1.5"><Label>تفاصيل المتابعة</Label><Textarea className="field-input min-h-16" value={taskForm.details} onChange={(e) => setTaskForm((x) => ({ ...x, details: e.target.value }))} placeholder="مثال: التأكد من وزن 3000 جرام قبل اعتماد السعر" /></div>
            <div className="flex gap-2"><Button onClick={() => void saveTask()} className="form-action-bar flex-1">{editingTaskId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editingTaskId ? t("followup.updateTask") : "إضافة للمتابعة"}</Button>{editingTaskId ? <Button variant="outline" onClick={cancelTaskEdit}><X className="h-4 w-4" />{t("followup.cancelEdit")}</Button> : null}</div>
          </div>
        </SectionCard>

        <SectionCard title="الملاحظات المسجلة" hint={`${notes.length} ملاحظة محلية`} stamp="سجل الملاحظات">
          {notes.length === 0 ? <EmptyHint text="لا توجد ملاحظات. أضف أول ملاحظة من النموذج أعلاه." /> : <div className="space-y-2">{notes.map((note) => <div key={note.id} className="record-card rounded p-3"><div className="flex items-start justify-between gap-2"><div><p className="flex items-center gap-1.5 font-semibold text-sm text-[var(--ink)]">{note.isPinned ? <Pin className="h-3.5 w-3.5 fill-current text-[var(--port-green)]" /> : null}{note.title}</p><p className="mt-1 text-[11px] text-muted-foreground">{relation(note.entityId, note.itemId)}</p></div><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => void db.deleteNote(note.id).then(load)}><Trash2 className="h-3.5 w-3.5" /></Button></div>{note.body ? <p className="mt-2 text-xs leading-relaxed text-foreground/80">{note.body}</p> : null}<p className="mt-2 text-[10px] text-muted-foreground" dir="ltr">{formatDateTime(note.updatedAt)}</p></div>)}</div>}
        </SectionCard>

        <SectionCard title="المهام والمواعيد" hint={`${tasks.filter((task) => !task.completedAt).length} قيد المتابعة`} stamp="سجل المتابعة">
          {tasks.length === 0 ? <EmptyHint text="لا توجد مهام أو مواعيد. أضف متابعة مرتبطة بجهة أو صنف." /> : <div className="space-y-2">{tasks.map((task) => <div key={task.id} className={task.completedAt ? "rounded border border-border bg-secondary/30 px-3 py-2.5 opacity-70" : "record-card rounded p-3"}><div className="flex items-start gap-2"><Button size="icon" variant={task.completedAt ? "default" : "outline"} className="h-7 w-7 shrink-0" onClick={() => void toggleTask(task)}><Check className="h-3.5 w-3.5" /></Button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className={task.completedAt ? "text-sm line-through text-muted-foreground" : "font-semibold text-sm text-[var(--ink)]"}>{task.title}</p><span className={`rounded px-1.5 py-0.5 text-[10px] ${task.priority === "high" ? "bg-red-50 text-red-700" : task.priority === "low" ? "bg-secondary text-muted-foreground" : "bg-[var(--amber-field)] text-[#7a5200]"}`}>{priorityLabel[task.priority]}</span></div><p className="mt-1 text-[11px] text-muted-foreground" dir="ltr">{relation(task.entityId, task.itemId)}{task.dueAt ? ` — ${formatDateTime(task.dueAt)}` : ""}</p>{task.details ? <p className="mt-1 text-xs text-foreground/75">{task.details}</p> : null}</div><div className="flex shrink-0 items-center gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" title={t("common.view")} onClick={() => setViewingTask(task)}><Eye className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" title={t("common.edit")} onClick={() => startTaskEdit(task)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => void db.deleteTask(task.id).then(load)}><Trash2 className="h-3.5 w-3.5" /></Button></div></div></div>)}</div>}
        </SectionCard>
      </div>
      <Dialog open={Boolean(viewingTask)} onOpenChange={(open) => { if (!open) setViewingTask(null); }}>
        <DialogContent className="border-[var(--field-border)] bg-card text-[var(--ink)] sm:max-w-md" dir="rtl">
          <DialogHeader className="text-right"><DialogTitle>{viewingTask?.title}</DialogTitle><DialogDescription>{t("followup.taskDetails")}</DialogDescription></DialogHeader>
          {viewingTask ? <div className="space-y-3 text-sm"><div className="grid grid-cols-2 gap-2"><div className="rounded-md border border-[var(--field-border)] bg-[var(--field-surface)] p-2"><p className="text-[10px] text-[var(--guidance)]">{t("followup.dueAt")}</p><p className="mt-1 font-medium" dir="ltr">{formatDateTime(viewingTask.dueAt)}</p></div><div className="rounded-md border border-[var(--field-border)] bg-[var(--field-surface)] p-2"><p className="text-[10px] text-[var(--guidance)]">{t("followup.priority")}</p><p className="mt-1 font-medium">{priorityLabel[viewingTask.priority]}</p></div></div><div className="rounded-md border border-[var(--field-border)] bg-[var(--field-surface)] p-2"><p className="text-[10px] text-[var(--guidance)]">{t("followup.linkedRecord")}</p><p className="mt-1 font-medium">{relation(viewingTask.entityId, viewingTask.itemId)}</p></div>{viewingTask.details ? <div className="rounded-md border border-[var(--field-border)] bg-[var(--field-surface)] p-2"><p className="text-[10px] text-[var(--guidance)]">{t("followup.details")}</p><p className="mt-1 whitespace-pre-wrap leading-6">{viewingTask.details}</p></div> : null}</div> : null}
          <DialogFooter><Button variant="outline" onClick={() => setViewingTask(null)}>{t("common.close")}</Button><Button onClick={() => { if (viewingTask) startTaskEdit(viewingTask); setViewingTask(null); }}><Pencil className="h-4 w-4" />{t("common.edit")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
