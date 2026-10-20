import { personalRatings, viewingHistory, type PersonalRating, type PersonalRecord } from "./personal-library";

export const ratingGuideKey = "anime-record.rating-guide.v1";
export type RatingGuide = Record<PersonalRating, string>;
export const defaultRatingGuide: RatingGuide = {
  SS: "何度でも見返したい特別な作品", S: "とても好きな作品", A: "楽しめた作品",
  B: "まずまず楽しめた作品", C: "好みが分かれる作品", D: "あまり合わなかった作品", E: "自分には合わなかった作品",
};
export function decodeRatingGuide(raw: string | null): RatingGuide {
  if (raw === null) return { ...defaultRatingGuide };
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !data.descriptions || personalRatings.some(r => typeof data.descriptions[r] !== "string" || data.descriptions[r].length > 100)) throw new Error("Invalid rating guide");
  return Object.fromEntries(personalRatings.map(r => [r, data.descriptions[r]])) as RatingGuide;
}
export function saveRatingGuide(expected: string | null, descriptions: RatingGuide, storage: Pick<Storage, "getItem" | "setItem">) {
  if (storage.getItem(ratingGuideKey) !== expected) throw new Error("別の画面で評価基準が変更されました。開き直してお試しください。");
  const raw = JSON.stringify({ version: 1, descriptions });
  decodeRatingGuide(raw);
  storage.setItem(ratingGuideKey, raw);
}

export function availableYears(records: PersonalRecord[]) {
  return [...new Set(records.flatMap(r => viewingHistory(r).map(v => v.watchedMonth?.slice(0, 4))).filter((v): v is string => Boolean(v)))].sort().reverse();
}

export function periodRecords(records: PersonalRecord[], year = "", month = "") {
  return records.flatMap(record => {
    const matching = viewingHistory(record).filter(v => (!year || v.watchedMonth?.startsWith(`${year}-`)) && (!month || v.watchedMonth === month));
    // A work appears once per period, using its most recent viewing in that period.
    const latest = matching.reduce<(typeof matching)[number] | undefined>((best, v) => !best || (v.watchedMonth ?? "") >= (best.watchedMonth ?? "") ? v : best, undefined);
    return latest ? [{ ...record, ...latest, id: record.id, history: record.history, viewingId: latest.id }] : [];
  });
}

export function personalInsights(records: PersonalRecord[], year = "", month = "") {
  const works = periodRecords(records, year, month);
  const viewings = records.flatMap(r => viewingHistory(r).map((v, i) => ({ ...v, rewatch: i > 0 }))).filter(v => (!year || v.watchedMonth?.startsWith(`${year}-`)) && (!month || v.watchedMonth === month));
  const grades = personalRatings.map(rating => ({ rating, count: works.filter(r => r.rating === rating).length }));
  const top = [...works].sort((a, b) => personalRatings.indexOf(a.rating) - personalRatings.indexOf(b.rating)).slice(0, 3);
  const genreNames = [...new Set(works.flatMap(r => r.tags))];
  const genres = genreNames.map(name => {
    const tagged = works.filter(r => r.tags.includes(name));
    return { name, count: tagged.length, favorites: tagged.filter(r => r.rating === "SS" || r.rating === "S").length };
  }).sort((a, b) => b.favorites - a.favorites || b.count - a.count || a.name.localeCompare(b.name, "ja"));
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: viewings.filter(v => Number(v.watchedMonth?.slice(5)) === i + 1).length }));
  return { works, viewings: viewings.length, rewatches: viewings.filter(v => v.rewatch).length, grades, top, genres, months };
}
