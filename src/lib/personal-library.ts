export const personalRatings = ["SS", "S", "A", "B", "C", "D", "E"] as const;
export type PersonalRating = (typeof personalRatings)[number];
export const personalStatuses = ["WATCHING", "COMPLETED", "PAUSED", "DROPPED", "PLAN_TO_WATCH"] as const;
export type PersonalRecord = {
  id: string;
  title: string;
  rating: PersonalRating;
  status: (typeof personalStatuses)[number];
  review: string;
  watchedMonth?: string;
  tags: string[];
  updatedAt: string;
  history?: ViewingSnapshot[];
};
export type ViewingSnapshot = Omit<PersonalRecord, "title" | "history">;
export const libraryKey = "anime-record.personal.v1";
export const unavailableStorage = "!unavailable";

export function decodeLibrary(raw: string | null): PersonalRecord[] {
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if ((data?.version !== 1 && data?.version !== 2) || !Array.isArray(data.records) || data.records.length > 10000)
    throw new Error("Invalid backup");
  const ids = new Set<string>();
  return data.records.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new Error("Invalid record");
    const r = value as Record<string, unknown>;
    if (typeof r.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(r.id) || ids.has(r.id) ||
      typeof r.title !== "string" || !r.title.trim() || r.title.length > 200 ||
      !personalRatings.includes(r.rating as PersonalRating) ||
      !personalStatuses.includes(r.status as PersonalRecord["status"]) ||
      typeof r.review !== "string" || r.review.length > 20000 ||
      (r.watchedMonth !== undefined && (typeof r.watchedMonth !== "string" || (r.watchedMonth !== "" && !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(r.watchedMonth)))) ||
      !Array.isArray(r.tags) || r.tags.length > 30 || r.tags.some(t => typeof t !== "string" || t.length > 50) ||
      typeof r.updatedAt !== "string" || !Number.isFinite(Date.parse(r.updatedAt)))
      throw new Error("Invalid record");
    let history: ViewingSnapshot[] | undefined;
    if (r.history !== undefined) {
      if (!Array.isArray(r.history) || r.history.length > 200) throw new Error("Invalid viewing history");
      // Reuse the record validator, but forbid nested histories to keep input bounded.
      const entries = r.history.map((entry: unknown) => {
        if (!entry || typeof entry !== "object" || "history" in entry) throw new Error("Invalid viewing history");
        return { ...entry, title: r.title };
      });
      history = decodeLibrary(JSON.stringify({ version: 1, records: entries })).map(viewingSnapshot);
      if (history.some(entry => entry.id === r.id)) throw new Error("Invalid viewing identity");
    }
    ids.add(r.id);
    return { id: r.id, title: r.title.trim(), rating: r.rating, status: r.status,
      ...(r.watchedMonth !== undefined ? { watchedMonth: r.watchedMonth as string } : {}),
      review: r.review, tags: [...new Set(r.tags)], updatedAt: r.updatedAt,
      ...(history !== undefined ? { history } : {}) } as PersonalRecord;
  });
}

export function normalizedTitle(title: string) {
  return title.normalize("NFKC").toLocaleLowerCase("ja").replace(/\s+/gu, "").trim();
}

export function matchesPersonalQuery(record: PersonalRecord, query: string) {
  const tokens = query.normalize("NFKC").toLocaleLowerCase("ja").trim().split(/\s+/u).filter(Boolean);
  const text = `${record.title} ${record.review} ${record.tags.join(" ")}`.normalize("NFKC").toLocaleLowerCase("ja");
  return tokens.every(token => text.includes(token));
}

export function startRewatch(record: PersonalRecord, id = newPersonalId()): PersonalRecord {
  const { title, history = [], ...previous } = record;
  if (history.length >= 200) throw new Error("再視聴履歴は1作品につき200件までです。");
  return { ...record, title, watchedMonth: "", review: "", history: [...history, { ...previous, id }] };
}

export function viewingHistory(record: PersonalRecord): ViewingSnapshot[] {
  return [...(record.history ?? []), viewingSnapshot(record)];
}

function viewingSnapshot(record: PersonalRecord): ViewingSnapshot {
  return { id: record.id, rating: record.rating, status: record.status, review: record.review,
    tags: record.tags, updatedAt: record.updatedAt,
    ...(record.watchedMonth !== undefined ? { watchedMonth: record.watchedMonth } : {}) };
}

export function encodeLibrary(records: PersonalRecord[]) {
  // Older clients reject v2 rather than silently dropping viewing history on save.
  const raw = JSON.stringify({ version: 2, records });
  decodeLibrary(raw);
  return raw;
}

export function newPersonalId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function placeInTier(records: PersonalRecord[], moved: PersonalRecord, rating: PersonalRating, targetId?: string, after = false) {
  const next = records.filter(r => r.id !== moved.id);
  const target = targetId ? next.findIndex(r => r.id === targetId && r.rating === rating) : -1;
  let index = target;
  if (index < 0) {
    index = next.length;
    for (let i = next.length - 1; i >= 0; i--) if (next[i].rating === rating) { index = i + 1; break; }
  } else if (after) index++;
  next.splice(index, 0, { ...moved, rating });
  return next;
}

export function saveLibrary(expected: string | null, records: PersonalRecord[], storage: Pick<Storage, "getItem" | "setItem">) {
  if (storage.getItem(libraryKey) !== expected)
    throw new Error("別の画面で記録が変更されました。最新の一覧を確認して、もう一度お試しください。");
  storage.setItem(libraryKey, encodeLibrary(records));
}
