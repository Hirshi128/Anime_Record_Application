"use client";

import { useId, useRef, useState } from "react";
import { Download, Pencil, Save, X } from "lucide-react";
import { personalRatings, type PersonalRecord } from "@/lib/personal-library";
import { personalInsights, type RatingGuide } from "@/lib/personal-insights";
import { createTierImage } from "@/lib/tier-image";

export function RatingGuideEditor({ descriptions, snapshot, disabled, onSave }: { descriptions: RatingGuide; snapshot: string | null; disabled: boolean; onSave: (guide: RatingGuide, expected: string | null) => boolean }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(descriptions);
  const [error, setError] = useState(false);
  const expected = useRef<string | null>(null);
  const heading = useId();
  return <details className="border-b border-zinc-200 pb-4"><summary className="cursor-pointer text-sm font-semibold">評価基準</summary>
    <dl className="mt-4 space-y-2">{personalRatings.map(r => <div key={r} className="flex items-start gap-3 text-sm"><dt className={`rating-badge rating-${r} shrink-0`}>{r}</dt><dd className="pt-1 break-words">{descriptions[r] || "未設定"}</dd></div>)}</dl>
    <button className="button-secondary mt-4" disabled={disabled} onClick={() => { expected.current = snapshot; setValues(descriptions); setError(false); setEditing(true); }}><Pencil size={16} aria-hidden="true" />評価基準を編集</button>
    {editing ? <dialog className="personal-dialog" aria-labelledby={heading} ref={node => { if (node && !node.open) node.showModal(); }} onCancel={() => setEditing(false)}><form className="space-y-4" onSubmit={e => { e.preventDefault(); if (onSave(values, expected.current)) setEditing(false); else setError(true); }}>
      <div className="flex items-center justify-between gap-3"><h2 id={heading} className="text-lg font-semibold">自分の評価基準</h2><button type="button" className="button-secondary" title="閉じる" aria-label="閉じる" onClick={() => setEditing(false)}><X size={18} /></button></div>
      {personalRatings.map(r => <label key={r} className="block space-y-1"><span className="font-semibold">{r}の基準</span><input className="field-control" maxLength={100} value={values[r]} onChange={e => setValues(v => ({ ...v, [r]: e.target.value }))} /></label>)}
      {error ? <p role="alert" className="form-error">保存できませんでした。別の画面で変更された場合は、閉じて開き直してください。</p> : null}
      <button className="button-primary button-large"><Save size={18} aria-hidden="true" />評価基準を保存</button>
    </form></dialog> : null}
  </details>;
}

export function PersonalReview({ records, year, month, onSelectMonth, onOpen }: { records: PersonalRecord[]; year: string; month: string; onSelectMonth: (month: string) => void; onOpen: (record: PersonalRecord) => void }) {
  const insights = personalInsights(records, year, month);
  const period = month ? month.replace("-", "年") + "月" : year ? `${year}年` : "これまで";
  const maxMonth = Math.max(1, ...insights.months.map(m => m.count));
  const annualMonths = month ? personalInsights(records, year).months : insights.months;
  const annualMax = Math.max(maxMonth, ...annualMonths.map(m => m.count));
  return <section className="space-y-7" aria-label="視聴の振り返り">
    <h2 className="text-xl font-semibold">{period}の振り返り</h2>
    <dl className="review-totals">{[["作品", insights.works.length], ["視聴記録", insights.viewings], ["期間内の再視聴", insights.rewatches]].map(([label, count]) => <div key={label}><dt className="text-xs text-zinc-600">{label}</dt><dd className="mt-1 text-2xl font-semibold">{count}</dd></div>)}</dl>
    {!insights.works.length ? <p className="text-sm text-zinc-500">この期間の記録はありません。</p> : <>
      <section className="space-y-3" aria-label="ベスト作品"><h3 className="font-semibold">ベスト作品</h3><ol className="divide-y divide-zinc-200">{insights.top.map((r, i) => <li key={r.id} className="flex items-center gap-3 py-3"><span className="text-sm text-zinc-500">{i + 1}</span><span className={`rating-badge rating-${r.rating}`}>{r.rating}</span><button className="min-h-11 min-w-0 text-left font-semibold hover:underline" aria-label={`${r.title}の記録を見る`} onClick={() => onOpen(r)}>{r.title}</button><span className="ml-auto shrink-0 text-xs text-zinc-500">{r.watchedMonth?.replace("-", "/") || "年月未登録"}</span></li>)}</ol></section>
      <section className="space-y-3" aria-label="評価の分布"><h3 className="font-semibold">評価の分布</h3>{insights.grades.map(g => <div className="flex items-center gap-3 text-sm" key={g.rating}><span className="w-7 font-semibold">{g.rating}</span><meter className="rating-meter" min={0} max={insights.works.length || 1} value={g.count} aria-label={`${g.rating}の作品数`} /><span className="w-10 text-right">{g.count}作品</span></div>)}</section>
      <section className="space-y-3" aria-label="ジャンル別の好み"><h3 className="font-semibold">ジャンル別の好み</h3>{insights.genres.length ? <table className="w-full text-sm"><thead><tr className="border-b border-zinc-200 text-left"><th className="py-2">ジャンル</th><th className="text-right">作品数</th><th className="text-right">SS・S</th></tr></thead><tbody>{insights.genres.map(g => <tr key={g.name} className="border-b border-zinc-100"><th className="py-3 text-left font-normal">{g.name}</th><td className="text-right">{g.count}</td><td className="text-right">{g.favorites} / {g.count}</td></tr>)}</tbody></table> : <p className="text-sm text-zinc-500">ジャンルの記録はありません。</p>}</section>
    </>}
    {year ? <section className="space-y-3" aria-label="月別の視聴記録"><h3 className="font-semibold">{year}年の月別視聴記録</h3><div className="review-months">{annualMonths.map(m => <button key={m.month} className="review-month" aria-label={`${year}年${m.month}月 ${m.count}件`} onClick={() => onSelectMonth(`${year}-${String(m.month).padStart(2, "0")}`)}><span>{m.month}月</span><span className="review-month-track"><span style={{ width: `${m.count / annualMax * 100}%` }} /></span><span>{m.count}</span></button>)}</div></section> : null}
  </section>;
}

export function TierImageButton({ records, label }: { records: PersonalRecord[]; label: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const urlRef = useRef<string | null>(null);
  async function download() {
    setBusy(true); setError("");
    try {
      const blob = await createTierImage(records, label);
      if (!blob) throw new Error("empty image");
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const link = document.createElement("a"); link.href = url; link.download = `anime-tier-${label.replace(/[^0-9a-z-]/gi, "") || "all"}.png`; link.click();
      setTimeout(() => { URL.revokeObjectURL(url); if (urlRef.current === url) urlRef.current = null; }, 1000);
    } catch { setError("画像を保存できませんでした。作品数を絞って再度お試しください。"); }
    finally { setBusy(false); }
  }
  return <div><button type="button" className="button-secondary" disabled={busy || !records.length || records.length > 1000} onClick={() => void download()}><Download size={18} aria-hidden="true" />{busy ? "画像を作成中…" : "ティア表を画像保存"}</button>{error ? <p role="alert" className="form-error mt-2">{error}</p> : null}</div>;
}
