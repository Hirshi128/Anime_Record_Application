"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Maximize2, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { statusLabels } from "@/lib/anime-options";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor, closestCenter, pointerWithin, rectIntersection, useDroppable, useSensor, useSensors, type DragMoveEvent, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { personalRatings, type PersonalRating, type PersonalRecord } from "@/lib/personal-library";

function TierItem({ record, pending = false, hint, onSelect, readOnly = false }: { record: PersonalRecord; pending?: boolean; hint?: "before" | "after"; onSelect: () => void; readOnly?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: record.id, disabled: readOnly, data: { rating: pending ? "pending" : record.rating } });
  return <div ref={setNodeRef} data-drop-side={hint} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 }} className={`tier-item record-card rating-${pending ? "A" : record.rating}`}>
    {record.watchedMonth ? <time className="tier-watched-month" dateTime={record.watchedMonth}>{record.watchedMonth.replace("-", "/")}</time> : <span className="tier-watched-month">年月未登録</span>}
    <h3 aria-label={record.title}>{readOnly ? <span className="tier-handle tier-readonly" title={record.title}><span className="line-clamp-2">{record.title}</span></span> : <button type="button" className="tier-handle" {...attributes} {...listeners} aria-label={`${record.title}を移動`} title={record.title} onClick={onSelect}><span className="line-clamp-2">{record.title}</span></button>}</h3>
  </div>;
}

function TierRow({ rating, records, hint, onSelect, description, readOnly, onExpand, expanded = false, onInsert }: { rating: PersonalRating; records: PersonalRecord[]; hint: DropHint | null; onSelect: (record: PersonalRecord) => void; description?: string; readOnly: boolean; onExpand?: () => void; expanded?: boolean; onInsert?: (target?: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `tier:${rating}`, data: { rating } });
  return <section className="tier-row" aria-label={`${rating}ティア`}>
    <h2 className={`rating-badge rating-${rating}`} aria-label={rating} title={description}>{onExpand ? <button type="button" className="tier-expand" aria-label={`${rating}ティアを拡大`} title={`${rating}ティアを拡大`} onClick={onExpand}>{rating}<Maximize2 size={12} aria-hidden="true" /></button> : rating}</h2>
    <div ref={setNodeRef} className={`tier-content ${expanded ? "tier-grid" : ""} ${isOver ? "tier-over" : ""}`} onClick={e => { if (e.target === e.currentTarget) onExpand?.(); }}>
      <SortableContext items={records.map(r => r.id)} strategy={rectSortingStrategy}>{records.map(r => expanded ? <div className="tier-grid-cell" key={r.id}>{onInsert ? <button type="button" className="tier-insert" aria-label={`${r.title}の前に配置`} title={`${r.title}の前に配置`} onClick={() => onInsert(r.id)}><Plus size={16} aria-hidden="true" /></button> : null}<TierItem record={r} hint={hint?.target === r.id ? hint.side : undefined} onSelect={() => onSelect(r)} readOnly={readOnly} /></div> : <TierItem key={r.id} record={r} hint={hint?.target === r.id ? hint.side : undefined} onSelect={() => onSelect(r)} readOnly={readOnly} />)}</SortableContext>
      {onInsert ? <button type="button" className="tier-insert-last button-secondary" onClick={() => onInsert()}><Plus size={18} aria-hidden="true" />末尾に配置</button> : null}
      {!records.length ? <span className="self-center text-xs text-zinc-400">作品なし</span> : null}
    </div>
  </section>;
}

type DropHint = { target: string; side: "before" | "after" };
type PlaceRecord = (record: PersonalRecord, rating: PersonalRating, target?: string, after?: boolean) => boolean | void;

function ExpandedTier({ rating, onClose, children }: { rating: PersonalRating; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={node => { if (node && !node.open) node.showModal(); }} className="personal-dialog expanded-tier" aria-labelledby={titleId} onCancel={onClose}>
    <header className="expanded-tier-header"><h2 id={titleId} className="text-lg font-semibold">{rating}ティア</h2><button type="button" className="button-secondary" aria-label="拡大表示を閉じる" title="閉じる" onClick={onClose}><X size={20} /></button></header>
    {children}
  </dialog>;
}

const tierKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  if (event.code !== "ArrowUp" && event.code !== "ArrowDown") return sortableKeyboardCoordinates(event, args);
  event.preventDefault();
  const current = args.context.over?.data.current?.rating ?? args.context.active?.data.current?.rating;
  const index = personalRatings.indexOf(current as PersonalRating);
  const next = index < 0 ? 0 : index + (event.code === "ArrowUp" ? -1 : 1);
  const rect = args.context.droppableRects.get(`tier:${personalRatings[next]}`);
  return rect ? { x: rect.left + 6, y: rect.top + 6 } : undefined;
};

function PlacementDialog({ record, records, pending, onPlace, onClose, onEdit, onRewatch, onExpand }: { record: PersonalRecord; records: PersonalRecord[]; pending: boolean; onPlace: PlaceRecord; onClose: () => void; onEdit?: (record: PersonalRecord) => void; onRewatch?: (record: PersonalRecord) => void; onExpand: (rating: PersonalRating) => void }) {
  const [rating, setRating] = useState<PersonalRating>(record.rating);
  const [position, setPosition] = useState(pending ? "" : "@current");
  const [error, setError] = useState(false);
  const titleId = useId();
  const peers = records.filter(r => r.rating === rating && r.id !== record.id);
  const currentPeers = records.filter(r => r.rating === record.rating);
  const index = currentPeers.findIndex(r => r.id === record.id);
  function place(grade: PersonalRating, target?: string, after = false) {
    if (onPlace(record, grade, target, after) !== false) onClose();
    else setError(true);
  }
  return <dialog ref={node => { if (node && !node.open) node.showModal(); }} className="personal-dialog" aria-labelledby={titleId} onCancel={onClose}>
    <form className="space-y-5" onSubmit={e => { e.preventDefault(); if (position === "@current" && rating === record.rating) onClose(); else place(rating, position || undefined); }}>
      <div className="flex items-start justify-between gap-3"><h2 id={titleId} className="text-lg font-semibold break-words">{record.title}の配置</h2><button type="button" className="button-secondary shrink-0" aria-label="閉じる" title="閉じる" onClick={onClose}><X size={18} /></button></div>
      <label className="block space-y-2"><span>評価</span><select className="field-control" value={rating} onChange={e => { setRating(e.target.value as PersonalRating); setPosition(!pending && e.target.value === record.rating ? "@current" : ""); }}>{personalRatings.map(r => <option key={r}>{r}</option>)}</select></label>
      <button type="button" className="button-secondary" onClick={() => onExpand(rating)}><Maximize2 size={18} aria-hidden="true" />ティアを広げて配置</button>
      <label className="block space-y-2"><span>挿入位置</span><select className="field-control" value={position} onChange={e => setPosition(e.target.value)}>{!pending && rating === record.rating ? <option value="@current">現在の位置</option> : null}<option value="">末尾</option>{peers.map(r => <option key={r.id} value={r.id}>{r.title}の前</option>)}</select></label>
      {!pending ? <div className="flex flex-wrap gap-3"><button type="button" className="button-secondary" disabled={index <= 0} onClick={() => place(record.rating, currentPeers[index - 1]?.id)}><ArrowLeft size={18} aria-hidden="true" />左へ移動</button><button type="button" className="button-secondary" disabled={index < 0 || index >= currentPeers.length - 1} onClick={() => place(record.rating, currentPeers[index + 1]?.id, true)}>右へ移動<ArrowRight size={18} aria-hidden="true" /></button></div> : null}
      {error ? <p role="alert" className="form-error">配置を保存できませんでした。保存設定を確認し、別の画面で更新された場合は閉じて開き直してください。</p> : null}
      <div className="flex flex-wrap gap-3"><button className="button-primary button-large"><Check size={20} aria-hidden="true" />配置を保存</button><button type="button" className="button-secondary" onClick={onClose}>キャンセル</button></div>
      <div className="flex flex-wrap gap-3 border-t border-zinc-200 pt-4">{onEdit ? <button type="button" className="button-secondary" onClick={() => { onClose(); onEdit(record); }}><Pencil size={18} aria-hidden="true" />{pending ? "入力内容を修正" : "記録を編集"}</button> : null}{!pending && onRewatch ? <button type="button" className="button-secondary" onClick={() => { onClose(); onRewatch(record); }}><RotateCcw size={18} aria-hidden="true" />再視聴を記録</button> : null}</div>
      <details className="text-sm"><summary className="cursor-pointer font-semibold">記録の詳細</summary><div className="mt-3 space-y-3"><p>{record.watchedMonth || "年月未登録"} · {statusLabels[record.status]}</p><p className="whitespace-pre-wrap break-words leading-6">{record.review || "感想未入力"}</p><div className="flex flex-wrap gap-2">{record.tags.map(tag => <span key={tag} className="genre-chip">{tag}</span>)}</div></div></details>
    </form>
  </dialog>;
}

export function TierBoard({ records, draft, onPlace, onCancel, descriptions, readOnly = false, onEdit, onRewatch, onEditDraft }: { records: PersonalRecord[]; draft: PersonalRecord | null; onPlace: PlaceRecord; onCancel: () => void; descriptions?: Partial<Record<PersonalRating, string>>; readOnly?: boolean; onEdit?: (record: PersonalRecord) => void; onRewatch?: (record: PersonalRecord) => void; onEditDraft?: (record: PersonalRecord) => void }) {
  const [selected, setSelected] = useState<PersonalRecord | null>(null);
  const [activeRecord, setActiveRecord] = useState<PersonalRecord | null>(null);
  const [hint, setHint] = useState<DropHint | null>(null);
  const [expanded, setExpanded] = useState<PersonalRating | null>(null);
  const [moving, setMoving] = useState<PersonalRecord | null>(null);
  const [insertError, setInsertError] = useState(false);
  const suppressClick = useRef(false);
  const dropSaved = useRef(false);
  function select(record: PersonalRecord) { if (!suppressClick.current) setSelected(record); }
  function closeExpanded() {
    const rating = expanded;
    setExpanded(null); setMoving(null); setInsertError(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`button[aria-label="${rating}ティアを拡大"]`)?.focus({ preventScroll: true }));
  }
  function openExpanded(rating: PersonalRating, record: PersonalRecord | null = draft) { setSelected(null); setExpanded(rating); setMoving(record); setInsertError(false); }
  function insert(target?: string) {
    if (!moving || !expanded || readOnly) return;
    if (onPlace(moving, expanded, target, false) !== false) closeExpanded();
    else setInsertError(true);
  }
  function dropPosition({ active, over }: Pick<DragMoveEvent, "active" | "over">) {
    if (!over || active.id === over.id) return null;
    const grade = over.data.current?.rating as PersonalRating;
    if (!personalRatings.includes(grade)) return null;
    const moved = draft?.id === active.id ? draft : records.find(r => r.id === active.id);
    if (!moved) return null;
    const target = records.find(r => r.id === over.id);
    const sameTier = records.filter(r => r.rating === grade);
    const after = target && moved.rating === grade && !draft
      ? sameTier.findIndex(r => r.id === moved.id) < sameTier.findIndex(r => r.id === target.id)
      : (active.rect.current.translated?.left ?? 0) + (active.rect.current.translated?.width ?? 0) / 2 > over.rect.left + over.rect.width / 2;
    return { moved, grade, target, after: Boolean(after) };
  }
  function updateHint(event: DragMoveEvent) {
    const position = dropPosition(event);
    setHint(position?.target ? { target: position.target.id, side: position.after ? "after" : "before" } : null);
  }
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: expanded ? sortableKeyboardCoordinates : tierKeyboardCoordinates }));
  const overlay = <DragOverlay dropAnimation={null}>{activeRecord ? <div className={`tier-drag-preview record-card rating-${activeRecord.rating}`}><span className="text-xs">{activeRecord.watchedMonth?.replace("-", "/") || "年月未登録"}</span><span className="line-clamp-2 text-sm font-semibold">{activeRecord.title}</span></div> : null}</DragOverlay>;
  return <DndContext id="personal-tier-board" sensors={sensors} autoScroll={{ threshold: { x: 0.12, y: 0.1 }, acceleration: 5, interval: 12, layoutShiftCompensation: false }} onDragStart={({ active }) => { suppressClick.current = true; setActiveRecord(draft?.id === active.id ? draft : records.find(r => r.id === active.id) ?? null); }} onDragMove={updateHint} onDragOver={updateHint} onDragCancel={() => { setHint(null); setActiveRecord(null); setTimeout(() => { suppressClick.current = false; }, 0); }} collisionDetection={args => {
    const candidates = { ...args, droppableContainers: args.droppableContainers.filter(item => item.id !== args.active.id) };
    const hits = args.pointerCoordinates ? pointerWithin(candidates) : rectIntersection(candidates);
    const items = hits.filter(hit => !String(hit.id).startsWith("tier:"));
    return items.length ? items : hits.length ? hits : args.pointerCoordinates ? [] : closestCenter(candidates);
  }} onDragEnd={event => {
    const position = dropPosition(event);
    dropSaved.current = position ? onPlace(position.moved, position.grade, position.target?.id, position.after) !== false : false;
    if (dropSaved.current && expanded) closeExpanded();
    setHint(null); setActiveRecord(null);
    setTimeout(() => { suppressClick.current = false; }, 0);
  }} accessibility={{ screenReaderInstructions: { draggable: "スペースキーで作品を持ち上げ、矢印キーで移動し、スペースキーで確定します。Escapeでキャンセルします。" }, announcements: {
    onDragStart: ({ active }) => `${(draft?.id === active.id ? draft : records.find(r => r.id === active.id))?.title ?? "作品"}を持ち上げました。`,
    onDragOver: event => { const p = dropPosition(event); return p ? `${p.grade}ティア、${p.target ? `${p.target.title}の${p.after ? "後" : "前"}` : "末尾"}に移動中です。` : "ティアの外です。"; },
    onDragEnd: event => { const p = dropPosition(event); return p ? dropSaved.current ? `${p.grade}ティアに配置しました。` : "配置を保存できませんでした。" : "配置をキャンセルしました。"; },
    onDragCancel: () => "移動をキャンセルしました。",
  } }}>
    {expanded ? <ExpandedTier rating={expanded} onClose={closeExpanded}>
      {moving ? <section className="expanded-tier-moving" aria-label="配置する作品"><SortableContext items={[moving.id]} strategy={rectSortingStrategy}><TierItem record={moving} pending onSelect={() => select(moving)} readOnly={readOnly} /></SortableContext></section> : null}
      {insertError ? <p role="alert" className="form-error">配置を保存できませんでした。閉じて最新の記録を確認してください。</p> : null}
      <TierRow rating={expanded} records={records.filter(r => r.rating === expanded && r.id !== moving?.id)} hint={hint} onSelect={select} description={descriptions?.[expanded]} readOnly={readOnly} expanded onInsert={moving && !readOnly ? insert : undefined} />
      {overlay}
    </ExpandedTier> : <>
      {draft ? <section className="mb-5 border-y border-teal-200 bg-teal-50 p-4" aria-label="評価待ち"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">評価する作品</h2><button className="button-secondary" onClick={onCancel}>登録をキャンセル</button></div><SortableContext items={[draft.id]} strategy={rectSortingStrategy}><TierItem record={draft} pending onSelect={() => select(draft)} /></SortableContext></section> : null}
      <div className="tier-board">{personalRatings.map(rating => <TierRow key={rating} rating={rating} records={records.filter(r => r.rating === rating && r.id !== draft?.id)} hint={hint} onSelect={select} description={descriptions?.[rating]} readOnly={readOnly} onExpand={() => openExpanded(rating)} />)}</div>
      {overlay}
    </>}
    {selected ? <PlacementDialog record={selected} records={records} pending={selected.id === draft?.id} onPlace={onPlace} onClose={() => setSelected(null)} onEdit={selected.id === draft?.id ? onEditDraft : onEdit} onRewatch={onRewatch} onExpand={rating => openExpanded(rating, selected)} /> : null}
  </DndContext>;
}
