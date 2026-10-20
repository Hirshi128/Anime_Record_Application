"use client";

import { DndContext, MouseSensor, TouchSensor, KeyboardSensor, closestCenter, pointerWithin, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { personalRatings, type PersonalRating, type PersonalRecord } from "@/lib/personal-library";

function TierItem({ record, pending = false }: { record: PersonalRecord; pending?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: record.id, data: { rating: pending ? "pending" : record.rating } });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 }} className={`tier-item record-card rating-${pending ? "A" : record.rating}`}>
    {record.watchedMonth ? <time className="tier-watched-month" dateTime={record.watchedMonth}>{record.watchedMonth.replace("-", "/")}</time> : <span className="tier-watched-month">年月未登録</span>}
    <h3 aria-label={record.title}><button type="button" className="tier-handle" {...attributes} {...listeners} aria-label={`${record.title}を移動`} title={record.title}><span className="line-clamp-2">{record.title}</span></button></h3>
  </div>;
}

function TierRow({ rating, records }: { rating: PersonalRating; records: PersonalRecord[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `tier:${rating}`, data: { rating } });
  return <section className="tier-row" aria-label={`${rating}ティア`}>
    <h2 className={`rating-badge rating-${rating}`}>{rating}</h2>
    <div ref={setNodeRef} className={`tier-content ${isOver ? "tier-over" : ""}`}>
      <SortableContext items={records.map(r => r.id)} strategy={rectSortingStrategy}>{records.map(r => <TierItem key={r.id} record={r} />)}</SortableContext>
      {!records.length ? <span className="self-center text-xs text-zinc-400">作品なし</span> : null}
    </div>
  </section>;
}

export function TierBoard({ records, draft, onPlace, onCancel }: { records: PersonalRecord[]; draft: PersonalRecord | null; onPlace: (record: PersonalRecord, rating: PersonalRating, target?: string, after?: boolean) => void; onCancel: () => void }) {
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  return <DndContext id="personal-tier-board" sensors={sensors} collisionDetection={args => {
    const hits = pointerWithin(args).filter(hit => hit.id !== args.active.id);
    const items = hits.filter(hit => !String(hit.id).startsWith("tier:"));
    return items.length ? items : hits.length ? hits : closestCenter(args);
  }} onDragEnd={({ active, over }) => {
    if (!over || active.id === over.id) return;
    const grade = over.data.current?.rating as PersonalRating;
    if (!personalRatings.includes(grade)) return;
    const moved = draft?.id === active.id ? draft : records.find(r => r.id === active.id);
    if (!moved) return;
    const target = records.find(r => r.id === over.id);
    const sameTier = records.filter(r => r.rating === grade);
    const after = target && moved.rating === grade && !draft
      ? sameTier.findIndex(r => r.id === moved.id) < sameTier.findIndex(r => r.id === target.id)
      : (active.rect.current.translated?.left ?? 0) + (active.rect.current.translated?.width ?? 0) / 2 > over.rect.left + over.rect.width / 2;
    onPlace(moved, grade, target?.id, Boolean(after));
  }} accessibility={{ screenReaderInstructions: { draggable: "スペースキーで作品を持ち上げ、矢印キーで移動し、スペースキーで確定します。Escapeでキャンセルします。" } }}>
    {draft ? <section className="mb-5 border-y border-teal-200 bg-teal-50 p-4" aria-label="評価待ち"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold">評価する作品</h2><button className="button-secondary" onClick={onCancel}>登録をキャンセル</button></div><SortableContext items={[draft.id]} strategy={rectSortingStrategy}><TierItem record={draft} pending /></SortableContext></section> : null}
    <div className="tier-board">{personalRatings.map(rating => <TierRow key={rating} rating={rating} records={records.filter(r => r.rating === rating)} />)}</div>
  </DndContext>;
}
