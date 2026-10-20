"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Plus, Search, Pencil, Trash2, Save, X, BookOpen } from "lucide-react";
import { genreOptions, statusLabels } from "@/lib/anime-options";
import { TitleAutocomplete } from "./anime/title-autocomplete";
import { TierBoard } from "./tier-board";
import { decodeLibrary, libraryKey, newPersonalId, placeInTier, personalRatings, personalStatuses, saveLibrary, unavailableStorage, type PersonalRecord } from "@/lib/personal-library";

const changedEvent = "personal-library-changed";
function snapshot() {
  try { return localStorage.getItem(libraryKey); }
  catch { return unavailableStorage; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changedEvent, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(changedEvent, callback); };
}

function RecordEditor({ record, message, onSave, onClose }: { record?: PersonalRecord; message: string; onSave: (record: PersonalRecord) => void; onClose: () => void }) {
  const [title, setTitle] = useState(record?.title ?? "");
  const [watchedMonth, setWatchedMonth] = useState(record?.watchedMonth ?? "");
  const [status, setStatus] = useState<PersonalRecord["status"]>(record?.status ?? "COMPLETED");
  const [review, setReview] = useState(record?.review ?? "");
  const [tags, setTags] = useState<string[]>(record?.tags ?? []);
  const heading = useId();
  const ref = useRef<HTMLDialogElement>(null);
  return <dialog ref={node => { ref.current = node; if (node && !node.open) node.showModal(); }} aria-labelledby={heading} className="personal-dialog" onCancel={onClose}>
    <form className="space-y-5" onSubmit={event => {
      event.preventDefault();
      onSave({ id: record?.id ?? newPersonalId(), title: title.trim(), watchedMonth, rating: record?.rating ?? "A", status, review, tags, updatedAt: new Date().toISOString() });
    }}>
      <div className="flex items-center justify-between gap-3"><h2 id={heading} className="text-xl font-semibold">{record ? "記録を編集" : "視聴したアニメを追加"}</h2><button className="button-secondary" type="button" aria-label="閉じる" title="閉じる" onClick={onClose}><X size={20} /></button></div>
      <TitleAutocomplete value={title} onChange={setTitle} initialTitle={record?.title} />
      {title.length > 200 ? <p role="alert" className="form-error">タイトルは200文字以内で入力してください。</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2"><span>見た年月</span><input type="month" className="field-control" required value={watchedMonth} onChange={e => setWatchedMonth(e.target.value)} /></label>
        <label className="block space-y-2"><span>視聴状況</span><select className="field-control" value={status} onChange={e => setStatus(e.target.value as PersonalRecord["status"])}>{personalStatuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>
      </div>
      <details><summary className="cursor-pointer font-semibold">ジャンル</summary><fieldset className="mt-3"><legend className="sr-only">ジャンルを選択</legend><div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-3">{genreOptions.map(g => <label className="choice-tile" key={g}><input type="checkbox" checked={tags.includes(g)} onChange={e => setTags(t => e.target.checked ? [...t, g] : t.filter(v => v !== g))} /><span>{g}</span></label>)}</div></fieldset></details>
      <label className="block space-y-2"><span>感想</span><textarea className="field-control min-h-32" value={review} onChange={e => setReview(e.target.value)} maxLength={20000} /></label>
      {message ? <p className="form-error" role="alert">{message}</p> : null}
      <div className="flex flex-wrap gap-3"><button className="button-primary button-large" disabled={!title.trim() || title.length > 200 || !watchedMonth}><Save size={20} aria-hidden="true" />ティア表で評価</button><button className="button-secondary" type="button" onClick={onClose}>キャンセル</button></div>
    </form>
  </dialog>;
}

export function PersonalLibrary() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const { records, invalid } = useMemo(() => {
    try { return { records: decodeLibrary(raw), invalid: false }; }
    catch { return { records: [], invalid: true }; }
  }, [raw]);
  const [editor, setEditor] = useState<PersonalRecord | "new" | null>(null);
  const [draft, setDraft] = useState<PersonalRecord | null>(null);
  const [view, setView] = useState<"list" | "tier">("tier");
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
  const disabled = !ready || invalid;
  const editorSnapshot = useRef<string | null>(null);
  function openEditor(value: PersonalRecord | "new") { editorSnapshot.current = raw; setMessage(""); setEditor(value); }
  function persist(next: PersonalRecord[], expected = raw) {
    try {
      if (disabled) throw new Error("保存領域を利用できません。既存データは変更していません。");
      saveLibrary(expected, next, localStorage);
      window.dispatchEvent(new Event(changedEvent));
      return true;
    } catch (error) {
      setMessage(error instanceof Error && error.message.startsWith("別の画面") ? error.message : "保存できませんでした。ブラウザの保存容量・設定を確認してください。既存データは変更していません。");
      return false;
    }
  }
  const filtered = records.filter(r => (!year || r.watchedMonth?.startsWith(`${year}-`)) && (!month || r.watchedMonth === month) && (!rating || r.rating === rating) && (!status || r.status === status) &&
    (!genres.length || (allGenres ? genres.every(g => r.tags.includes(g)) : genres.some(g => r.tags.includes(g)))) &&
    `${r.title} ${r.review} ${r.tags.join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => view === "tier" ? 0 : sort === "rating" ? personalRatings.indexOf(a.rating) - personalRatings.indexOf(b.rating) : sort === "title" ? a.title.localeCompare(b.title, "ja") : sort === "watched" ? (b.watchedMonth ?? "").localeCompare(a.watchedMonth ?? "") : b.updatedAt.localeCompare(a.updatedAt));
  return <main className="app-page"><div className="page-shell space-y-7">
    <header className="flex flex-wrap items-center justify-between gap-5 border-b border-zinc-200 pb-6">
      <div className="flex items-center gap-3"><Image src="/icons/icon-192.png" width={44} height={44} alt="" /><h1 className="text-2xl font-semibold">Anime Record</h1></div>
      <button className="button-primary button-large" disabled={disabled || Boolean(draft)} onClick={() => openEditor("new")}><Plus size={22} aria-hidden="true" />視聴したアニメを追加</button>
    </header>
    <p className="text-sm text-zinc-600">{records.length}作品 · 視聴済み {records.filter(r => r.status === "COMPLETED").length} · SS・S {records.filter(r => r.rating === "SS" || r.rating === "S").length}</p>
    <p className="text-xs text-zinc-500">保存先：このブラウザ内。ブラウザデータを削除すると記録も消えます。端末間の自動同期はありません。</p>
    {invalid ? <p className="form-error" role="alert">保存データを読み出せません。上書きを防ぐため編集を停止しています。ブラウザのデータを削除せず、保存設定を確認してください。</p> : null}
    {message ? <p role="status" className="personal-feedback">{message}</p> : null}
    <section className="space-y-4 border-y border-zinc-200 py-5" aria-label="記録を絞り込む">
      <div className="flex flex-wrap items-end gap-3"><div className="personal-tabs" role="group" aria-label="表示形式"><button aria-pressed={view === "tier"} disabled={Boolean(draft)} onClick={() => setView("tier")}>ティア表</button><button aria-pressed={view === "list"} disabled={Boolean(draft)} onClick={() => setView("list")}>一覧</button></div><label><span className="block mb-1 text-sm">年</span><select className="field-control" value={year} onChange={e => { setYear(e.target.value); setMonth(""); }}><option value="">すべての年</option>{[...new Set(records.map(r => r.watchedMonth?.slice(0, 4)).filter((v): v is string => Boolean(v)))].sort().reverse().map(y => <option key={y} value={y}>{y}年</option>)}</select></label><label><span className="block mb-1 text-sm">年月</span><input className="field-control" type="month" value={month} onChange={e => { setMonth(e.target.value); setYear(e.target.value.slice(0, 4)); }} /></label></div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px_140px_140px]"><label className="block"><span className="sr-only">検索</span><div className="relative"><Search className="absolute left-3 top-3" size={18} aria-hidden="true" /><input className="field-control pl-10" placeholder="タイトル・感想・ジャンル" value={query} onChange={e => setQuery(e.target.value)} /></div></label>
        <label><span className="sr-only">評価で絞り込み</span><select className="field-control" value={rating} onChange={e => setRating(e.target.value)}><option value="">すべての評価</option>{personalRatings.map(r => <option key={r}>{r}</option>)}</select></label>
        <label><span className="sr-only">視聴状況で絞り込み</span><select className="field-control" value={status} onChange={e => setStatus(e.target.value)}><option value="">すべての状況</option>{personalStatuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>
        <label><span className="sr-only">並び順</span><select className="field-control" value={sort} disabled={view === "tier"} onChange={e => setSort(e.target.value)}><option value="updated">更新が新しい順</option><option value="watched">見た年月が新しい順</option><option value="rating">評価が高い順</option><option value="title">タイトル順</option></select></label></div>
      <details><summary className="cursor-pointer text-sm font-semibold">ジャンル {genres.length ? `(${genres.length})` : ""}</summary><fieldset className="mt-3"><legend className="sr-only">ジャンルで絞り込み</legend><div className="mb-3 flex gap-4"><label><input type="radio" name="genre-mode" checked={!allGenres} onChange={() => setAllGenres(false)} /> OR</label><label><input type="radio" name="genre-mode" checked={allGenres} onChange={() => setAllGenres(true)} /> AND</label></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{genreOptions.map(g => <label key={g} className="choice-tile"><input type="checkbox" checked={genres.includes(g)} onChange={e => setGenres(v => e.target.checked ? [...v, g] : v.filter(x => x !== g))} />{g}</label>)}</div></fieldset></details>
      {query || rating || status || genres.length || year || month ? <button className="button-secondary" onClick={() => { setQuery(""); setRating(""); setStatus(""); setGenres([]); setAllGenres(false); setYear(""); setMonth(""); }}>絞り込みを解除</button> : null}
    </section>
    <section aria-label="アニメ一覧" className="space-y-4"><h2 className="text-lg font-semibold">{view === "tier" ? `${month || (year ? `${year}年` : "これまでの")} ティア表` : "アニメ一覧"} <span className="text-sm font-normal text-zinc-500">{filtered.length}件</span></h2>
      {view === "tier" ? <TierBoard records={filtered} draft={draft} onCancel={() => { setDraft(null); setMessage(""); }} onPlace={(moved, grade, target, after) => {
        if (draft && moved.id !== draft.id) { setMessage("先に評価する作品を配置してください。"); return; }
        const next = placeInTier(records, { ...moved, updatedAt: new Date().toISOString() }, grade, target, after);
        if (persist(next, draft ? draftSnapshot.current : raw)) { setDraft(null); setMessage("ティア表を保存しました。"); }
      }} /> : <>
      {!ready ? <p role="status">記録を読み込み中...</p> : !filtered.length ? <div className="py-10 text-center text-zinc-500"><BookOpen className="mx-auto mb-3" size={32} aria-hidden="true" /><p>{records.length ? "条件に合う記録がありません。" : "まだ記録がありません。"}</p></div> : filtered.map(r => <article key={r.id} className={`record-card rating-${r.rating} p-5`}>
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-xl font-semibold">{r.title}</h3><p className="mt-2 text-xs text-zinc-600">{r.watchedMonth || "年月未登録"} · {statusLabels[r.status]}</p></div><span className={`rating-badge rating-${r.rating}`}>{r.rating}</span></div>
        <p className="my-4 whitespace-pre-wrap text-sm leading-6">{r.review || "感想未入力"}</p><div className="flex flex-wrap gap-2">{r.tags.map(t => <span className="genre-chip" key={t}>{t}</span>)}</div>
        <div className="mt-4 flex justify-end gap-2"><button className="button-secondary" onClick={() => openEditor(r)} aria-label={`${r.title}を編集`}><Pencil size={18} aria-hidden="true" />編集</button><button className="button-secondary" title="削除" aria-label={`${r.title}を削除`} onClick={() => { if (window.confirm(`「${r.title}」を削除しますか？`)) { if (persist(records.filter(x => x.id !== r.id))) setMessage("記録を削除しました。"); } }}><Trash2 size={18} /></button></div>
      </article>)} </>}
    </section>
    {editor ? <RecordEditor key={editor === "new" ? "new" : editor.id} message={message} record={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSave={record => {
      const next = records.map(r => r.id === record.id ? record : r);
      if (editor === "new") { draftSnapshot.current = editorSnapshot.current; setDraft(record); setEditor(null); setView("tier"); setYear(""); setMonth(""); setQuery(""); setRating(""); setStatus(""); setGenres([]); setMessage(""); }
      else if (persist(next, editorSnapshot.current)) { setEditor(null); setView("tier"); setYear(""); setMonth(""); setMessage("記録を保存しました。"); }
    }} /> : null}
  </div></main>;
}
