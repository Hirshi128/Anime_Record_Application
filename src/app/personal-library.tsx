"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Plus, Search, Pencil, Trash2, Save, X, BookOpen, RotateCcw, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import { genreOptions, statusLabels } from "@/lib/anime-options";
import { TitleAutocomplete } from "./anime/title-autocomplete";
import { TierBoard } from "./tier-board";
import { PersonalReview, RatingGuideEditor, TierImageButton } from "./personal-review";
import { ConnectionStatus } from "./pwa-register";
import { availableYears, decodeRatingGuide, defaultRatingGuide, periodRecords, ratingGuideKey, saveRatingGuide } from "@/lib/personal-insights";
import { decodeLibrary, encodeLibrary, libraryKey, matchesPersonalQuery, newPersonalId, normalizedTitle, placeInTier, personalRatings, personalStatuses, saveLibrary, startRewatch, unavailableStorage, type PersonalRecord } from "@/lib/personal-library";

const changedEvent = "personal-library-changed";
function snapshot() {
  try { return localStorage.getItem(libraryKey); }
  catch { return unavailableStorage; }
}
function guideSnapshot() {
  try { return localStorage.getItem(ratingGuideKey); }
  catch { return unavailableStorage; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changedEvent, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(changedEvent, callback); };
}

function RecordEditor({ record, records, rewatch, pending, message, onSave, onClose, onRewatch }: { record?: PersonalRecord; records: PersonalRecord[]; rewatch: boolean; pending: boolean; message: string; onSave: (record: PersonalRecord) => void; onClose: () => void; onRewatch: (record: PersonalRecord) => void }) {
  const [title, setTitle] = useState(record?.title ?? "");
  const [watchedMonth, setWatchedMonth] = useState(record?.watchedMonth ?? "");
  const [status, setStatus] = useState<PersonalRecord["status"]>(record?.status ?? "COMPLETED");
  const [review, setReview] = useState(record?.review ?? "");
  const [tags, setTags] = useState<string[]>(record?.tags ?? []);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const earliestMonth = record?.history?.map(v => v.watchedMonth || "").sort().at(-1) || undefined;
  const invalidChronology = Boolean(earliestMonth && watchedMonth && watchedMonth < earliestMonth);
  const duplicates = !record || (pending && !records.some(r => r.id === record.id)) ? records.filter(r => normalizedTitle(r.title) === normalizedTitle(title)) : [];
  const dirty = title !== (record?.title ?? "") || watchedMonth !== (record?.watchedMonth ?? "") || review !== (record?.review ?? "") || status !== (record?.status ?? "COMPLETED") || JSON.stringify(tags) !== JSON.stringify(record?.tags ?? []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function close() { if (!dirty || window.confirm("編集中の変更を破棄しますか？")) onClose(); }
  const heading = useId();
  const ref = useRef<HTMLDialogElement>(null);
  return <dialog ref={node => { ref.current = node; if (node && !node.open) node.showModal(); }} aria-labelledby={heading} className="personal-dialog" onCancel={event => { event.preventDefault(); close(); }}>
    <form className="space-y-5" onSubmit={event => {
      event.preventDefault();
      if ((duplicates.length && !allowDuplicate) || invalidChronology) return;
      onSave({ ...record, id: record?.id ?? newPersonalId(), title: title.trim(), watchedMonth, rating: record?.rating ?? "A", status, review, tags, updatedAt: new Date().toISOString() });
    }}>
      <div className="flex items-center justify-between gap-3"><h2 id={heading} className="text-xl font-semibold">{rewatch ? "再視聴を記録" : record ? "記録を編集" : "視聴したアニメを追加"}</h2><button className="button-secondary" type="button" aria-label="閉じる" title="閉じる" onClick={close}><X size={20} /></button></div>
      <TitleAutocomplete value={title} onChange={value => { setTitle(value); setAllowDuplicate(false); }} initialTitle={record?.title} recordedTitles={records.map(r => r.title)} />
      {duplicates.length ? <div className="border-l-2 border-amber-500 bg-amber-50 p-3 space-y-3"><p className="text-sm" role="status">同じタイトルの記録があります。</p>{duplicates.map(r => <button key={r.id} type="button" className="button-secondary" onClick={() => onRewatch(r)}><RotateCcw size={16} aria-hidden="true" />{r.watchedMonth || "年月未登録"}の記録に再視聴を追加</button>)}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowDuplicate} onChange={e => setAllowDuplicate(e.target.checked)} />別の作品として登録する</label></div> : null}
      {title.length > 200 ? <p role="alert" className="form-error">タイトルは200文字以内で入力してください。</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2"><span>見た年月</span><input type="month" className="field-control" required min={earliestMonth} value={watchedMonth} onChange={e => setWatchedMonth(e.target.value)} />{invalidChronology ? <span className="block text-sm text-red-700" role="alert">前回の視聴年月（{earliestMonth}）以降を選んでください。</span> : null}</label>
        <label className="block space-y-2"><span>視聴状況</span><select className="field-control" value={status} onChange={e => setStatus(e.target.value as PersonalRecord["status"])}>{personalStatuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>
      </div>
      <details><summary className="cursor-pointer font-semibold">ジャンル</summary><fieldset className="mt-3"><legend className="sr-only">ジャンルを選択</legend><div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-3">{genreOptions.map(g => <label className="choice-tile" key={g}><input type="checkbox" checked={tags.includes(g)} onChange={e => setTags(t => e.target.checked ? [...t, g] : t.filter(v => v !== g))} /><span>{g}</span></label>)}</div></fieldset></details>
      <label className="block space-y-2"><span>感想</span><textarea className="field-control min-h-32" value={review} onChange={e => setReview(e.target.value)} maxLength={20000} /></label>
      {message ? <p className="form-error" role="alert">{message}</p> : null}
      <div className="flex flex-wrap gap-3"><button className="button-primary button-large" disabled={!title.trim() || title.length > 200 || !watchedMonth || invalidChronology || Boolean(duplicates.length && !allowDuplicate)}><Save size={20} aria-hidden="true" />{record && !rewatch && !pending ? "変更を保存" : "ティア表で評価"}</button><button className="button-secondary" type="button" onClick={close}>キャンセル</button></div>
    </form>
  </dialog>;
}

export function PersonalLibrary() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const guideRaw = useSyncExternalStore(subscribe, guideSnapshot, () => null);
  const guide = useMemo(() => { try { return { descriptions: decodeRatingGuide(guideRaw), invalid: false }; } catch { return { descriptions: defaultRatingGuide, invalid: true }; } }, [guideRaw]);
  const { records, invalid } = useMemo(() => {
    try { return { records: decodeLibrary(raw), invalid: false }; }
    catch { return { records: [], invalid: true }; }
  }, [raw]);
  const [editor, setEditor] = useState<PersonalRecord | "new" | null>(null);
  const [draft, setDraft] = useState<PersonalRecord | null>(null);
  const [rewatch, setRewatch] = useState(false);
  const [view, setView] = useState<"list" | "tier" | "review">("tier");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const draftSnapshot = useRef<string | null>(null);
  useEffect(() => {
    if (!draft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft]);
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState("");
  const [status, setStatus] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [allGenres, setAllGenres] = useState(false);
  const [sort, setSort] = useState("updated");
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [undo, setUndo] = useState<{ before: PersonalRecord[]; after: string } | null>(null);
  const [expandedList, setExpandedList] = useState({ key: "", limit: 24 });
  const disabled = !ready || invalid;
  const editorSnapshot = useRef<string | null>(null);
  function openEditor(value: PersonalRecord | "new") { editorSnapshot.current = raw; setMessage(""); setRewatch(false); setEditor(value === "new" ? value : records.find(r => r.id === value.id) ?? value); }
  function openRewatch(record: PersonalRecord) {
    try { editorSnapshot.current = raw; setMessage(""); setRewatch(true); setEditor(startRewatch(records.find(r => r.id === record.id) ?? record)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "再視聴を追加できませんでした。"); }
  }
  function persist(next: PersonalRecord[], expected = raw) {
    try {
      if (disabled) throw new Error("保存領域を利用できません。既存データは変更していません。");
      saveLibrary(expected, next, localStorage);
      window.dispatchEvent(new Event(changedEvent));
      setSaveError(false);
      setUndo(null);
      return true;
    } catch (error) {
      setSaveError(true);
      setMessage(error instanceof Error && error.message.startsWith("別の画面") ? error.message : "保存できませんでした。ブラウザの保存容量・設定を確認してください。既存データは変更していません。");
      return false;
    }
  }
  const period = useMemo(() => year || month ? periodRecords(records, year, month) : records.map(r => ({ ...r, viewingId: r.id })), [records, year, month]);
  const historical = period.some(r => r.viewingId !== r.id);
  const filtered = period.filter(r => (!rating || r.rating === rating) && (!status || r.status === status) &&
    (!genres.length || (allGenres ? genres.every(g => r.tags.includes(g)) : genres.some(g => r.tags.includes(g)))) &&
    matchesPersonalQuery(r, query))
    .sort((a, b) => view === "tier" ? 0 : sort === "rating" ? personalRatings.indexOf(a.rating) - personalRatings.indexOf(b.rating) : sort === "title" ? a.title.localeCompare(b.title, "ja") : sort === "watched" ? (b.watchedMonth ?? "").localeCompare(a.watchedMonth ?? "") : b.updatedAt.localeCompare(a.updatedAt));
  const filterKey = JSON.stringify([year, month, query, rating, status, genres, allGenres, sort]);
  const listLimit = expandedList.key === filterKey ? expandedList.limit : 24;
  return <main className="app-page"><div className="page-shell space-y-7">
    <header className="flex flex-wrap items-center justify-between gap-5 border-b border-zinc-200 pb-6">
      <div className="flex items-center gap-3"><Image src="/icons/icon-192.png" width={44} height={44} alt="" unoptimized /><h1 className="text-2xl font-semibold">Anime Record</h1></div>
      <button className="button-primary button-large" disabled={disabled || Boolean(draft)} onClick={() => openEditor("new")}><Plus size={22} aria-hidden="true" />視聴したアニメを追加</button>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-zinc-600">{records.length}作品 · 視聴済み {records.filter(r => r.status === "COMPLETED").length} · SS・S {records.filter(r => r.rating === "SS" || r.rating === "S").length}</p><p className={`flex items-center gap-2 text-xs ${saveError || invalid ? "text-red-700" : "text-zinc-600"}`} role="status">{saveError || invalid ? <AlertCircle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}{!ready ? "保存データを確認中" : saveError || invalid ? "保存できていません" : draft ? "評価待ち・まだ保存されていません" : editor ? "編集中・変更は未保存です" : "このブラウザに保存済み"}</p></div>
    <p className="text-xs text-zinc-500">保存先：このブラウザ内。ブラウザデータを削除すると記録も消えます。端末間の自動同期はありません。</p>
    <ConnectionStatus />
    {invalid ? <p className="form-error" role="alert">保存データを読み出せません。上書きを防ぐため編集を停止しています。ブラウザのデータを削除せず、保存設定を確認してください。</p> : null}
    {message ? <p role="status" className="personal-feedback">{message}</p> : null}
    {undo ? <button className="button-secondary" disabled={disabled || Boolean(draft) || Boolean(editor)} onClick={() => { if (persist(undo.before, undo.after)) setMessage("削除した記録を元に戻しました。"); }}><RotateCcw size={18} aria-hidden="true" />削除を元に戻す</button> : null}
    {guide.invalid ? <p role="alert" className="form-error">評価基準を読み出せません。記録データは変更していません。</p> : null}
    <RatingGuideEditor descriptions={guide.descriptions} snapshot={guideRaw} disabled={!ready || guide.invalid} onSave={(values, expected) => { try { saveRatingGuide(expected, values, localStorage); window.dispatchEvent(new Event(changedEvent)); setMessage("評価基準を保存しました。"); return true; } catch { setMessage("評価基準を保存できませんでした。別の画面での変更や保存容量を確認してください。"); return false; } }} />
    <section className="space-y-4 border-y border-zinc-200 py-5" aria-label="記録を絞り込む">
      <div className="flex flex-wrap items-end gap-3"><div className="personal-tabs" role="group" aria-label="表示形式"><button aria-pressed={view === "tier"} disabled={Boolean(draft)} onClick={() => setView("tier")}>ティア表</button><button aria-pressed={view === "list"} disabled={Boolean(draft)} onClick={() => setView("list")}>一覧</button><button aria-pressed={view === "review"} disabled={Boolean(draft)} onClick={() => setView("review")}>振り返り</button></div><label><span className="block mb-1 text-sm">年</span><select className="field-control" value={year} onChange={e => { setYear(e.target.value); setMonth(""); }}><option value="">すべての年</option>{availableYears(records).map(y => <option key={y} value={y}>{y}年</option>)}</select></label><label><span className="block mb-1 text-sm">年月</span><input className="field-control" type="month" value={month} onChange={e => { setMonth(e.target.value); setYear(e.target.value.slice(0, 4)); }} /></label></div>
      {view !== "review" ? <>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px_140px_140px]"><label className="block"><span className="sr-only">検索</span><div className="relative"><Search className="absolute left-3 top-3" size={18} aria-hidden="true" /><input className="field-control pl-10" placeholder="タイトル・感想・ジャンル" value={query} onChange={e => setQuery(e.target.value)} /></div></label>
        <label><span className="sr-only">評価で絞り込み</span><select className="field-control" value={rating} onChange={e => setRating(e.target.value)}><option value="">すべての評価</option>{personalRatings.map(r => <option key={r}>{r}</option>)}</select></label>
        <label><span className="sr-only">視聴状況で絞り込み</span><select className="field-control" value={status} onChange={e => setStatus(e.target.value)}><option value="">すべての状況</option>{personalStatuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>
        <label><span className="sr-only">並び順</span><select className="field-control" value={sort} disabled={view === "tier"} onChange={e => setSort(e.target.value)}><option value="updated">更新が新しい順</option><option value="watched">見た年月が新しい順</option><option value="rating">評価が高い順</option><option value="title">タイトル順</option></select></label></div>
      <details><summary className="cursor-pointer text-sm font-semibold">ジャンル {genres.length ? `(${genres.length})` : ""}</summary><fieldset className="mt-3"><legend className="sr-only">ジャンルで絞り込み</legend><div className="mb-3 flex gap-4"><label><input type="radio" name="genre-mode" checked={!allGenres} onChange={() => setAllGenres(false)} /> OR</label><label><input type="radio" name="genre-mode" checked={allGenres} onChange={() => setAllGenres(true)} /> AND</label></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{genreOptions.map(g => <label key={g} className="choice-tile"><input type="checkbox" checked={genres.includes(g)} onChange={e => setGenres(v => e.target.checked ? [...v, g] : v.filter(x => x !== g))} />{g}</label>)}</div></fieldset></details>
      </> : null}
      {query || rating || status || genres.length || year || month ? <button className="button-secondary" onClick={() => { setQuery(""); setRating(""); setStatus(""); setGenres([]); setAllGenres(false); setYear(""); setMonth(""); }}>絞り込みを解除</button> : null}
    </section>
    {view === "review" ? <PersonalReview records={records} year={year} month={month} onSelectMonth={setMonth} onOpen={record => { setView("list"); setQuery(record.title); setRating(""); setStatus(""); setGenres([]); }} /> : <section aria-label="アニメ一覧" className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{view === "tier" ? `${month || (year ? `${year}年` : "これまでの")} ティア表` : "アニメ一覧"} <span className="text-sm font-normal text-zinc-500">{filtered.length}件</span></h2>{view === "tier" && !draft ? <TierImageButton records={filtered} label={month || year || "これまでの"} /> : null}</div>
      {historical ? <p className="text-xs text-zinc-600">過去の評価を含む期間 · ティア配置は閲覧専用</p> : null}
      {view === "tier" ? <TierBoard records={filtered} draft={draft} descriptions={guide.descriptions} readOnly={historical || disabled} onEdit={draft ? undefined : openEditor} onRewatch={draft ? undefined : openRewatch} onEditDraft={record => { editorSnapshot.current = draftSnapshot.current; setRewatch(records.some(r => r.id === record.id)); setEditor(record); setMessage(""); }} onCancel={() => { setDraft(null); setMessage(""); }} onPlace={(moved, grade, target, after) => {
        if (historical) return false;
        if (draft && moved.id !== draft.id) { setMessage("先に評価する作品を配置してください。"); return false; }
        const source = draft ?? records.find(r => r.id === moved.id);
        if (!source) return false;
        const next = placeInTier(records, { ...source, updatedAt: new Date().toISOString() }, grade, target, after);
        if (persist(next, draft ? draftSnapshot.current : raw)) { setDraft(null); setMessage("ティア表を保存しました。"); return true; }
        return false;
      }} /> : <>
      {!ready ? <p role="status">記録を読み込み中...</p> : !filtered.length ? <div className="py-10 text-center text-zinc-500"><BookOpen className="mx-auto mb-3" size={32} aria-hidden="true" /><p>{records.length ? "条件に合う記録がありません。" : "まだ記録がありません。"}</p></div> : filtered.slice(0, listLimit).map(r => <article key={r.id} className={`record-card rating-${r.rating} p-5`}>
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-xl font-semibold">{r.title}</h3><p className="mt-2 text-xs text-zinc-600">{r.watchedMonth || "年月未登録"} · {statusLabels[r.status]}</p></div><span className={`rating-badge rating-${r.rating}`}>{r.rating}</span></div>
        <p className="my-4 whitespace-pre-wrap text-sm leading-6">{r.review || "感想未入力"}</p><div className="flex flex-wrap gap-2">{r.tags.map(t => <span className="genre-chip" key={t}>{t}</span>)}</div>
        {r.history?.length ? <details className="mt-4 text-sm"><summary className="cursor-pointer">過去の視聴履歴（{r.history.length}回）</summary><ol className="mt-3 space-y-3">{r.history.filter(v => v.id !== r.viewingId).map((v, i) => <li key={`${v.id}-${i}`} className="border-l-2 border-zinc-200 pl-3"><p>{v.watchedMonth || "年月未登録"} · {v.rating}</p><p className="mt-1 whitespace-pre-wrap text-zinc-600">{v.review || "感想未入力"}</p></li>)}</ol></details> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2"><button className="button-secondary" onClick={() => openRewatch(r)} aria-label={`${r.title}の再視聴を記録`}><RotateCcw size={18} aria-hidden="true" />再視聴</button><button className="button-secondary" onClick={() => openEditor(r)} aria-label={`${r.title}を編集`}><Pencil size={18} aria-hidden="true" />{r.viewingId === r.id ? "編集" : "最新を編集"}</button><button className="button-secondary" title="削除" aria-label={`${r.title}を削除`} onClick={() => { if (window.confirm(`「${r.title}」を視聴履歴ごと削除しますか？`)) { const next = records.filter(x => x.id !== r.id); if (persist(next)) { setUndo({ before: records, after: encodeLibrary(next) }); setMessage("記録を削除しました。"); } } }}><Trash2 size={18} /></button></div>
      </article>)}
      {filtered.length > 24 ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4"><p className="text-sm text-zinc-600">{Math.min(listLimit, filtered.length)} / {filtered.length}作品</p>{listLimit < filtered.length ? <button className="button-secondary" onClick={() => setExpandedList({ key: filterKey, limit: listLimit + 24 })}><ChevronDown size={18} aria-hidden="true" />さらに表示</button> : null}</div> : null}
      </>}
    </section>}
    {editor ? <RecordEditor key={editor === "new" ? "new" : `${editor.id}-${rewatch}`} message={message} records={records} rewatch={rewatch} pending={Boolean(draft)} onRewatch={openRewatch} record={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSave={record => {
      const next = records.map(r => r.id === record.id ? record : r);
      if (editor === "new" || rewatch || draft?.id === record.id) { draftSnapshot.current = editorSnapshot.current; setDraft(record); setEditor(null); setView("tier"); setYear(""); setMonth(""); setQuery(""); setRating(""); setStatus(""); setGenres([]); setMessage(""); }
      else if (persist(next, editorSnapshot.current)) { setEditor(null); setView("tier"); setYear(""); setMonth(""); setMessage("記録を保存しました。"); }
    }} /> : null}
  </div></main>;
}
