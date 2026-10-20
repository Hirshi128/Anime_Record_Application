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
};
export const libraryKey = "anime-record.personal.v1";
export const unavailableStorage = "!unavailable";

export function decodeLibrary(raw: string | null): PersonalRecord[] {
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.records) || data.records.length > 10000)
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
    ids.add(r.id);
    return { id: r.id, title: r.title.trim(), rating: r.rating, status: r.status,
      ...(r.watchedMonth !== undefined ? { watchedMonth: r.watchedMonth as string } : {}),
      review: r.review, tags: [...new Set(r.tags)], updatedAt: r.updatedAt } as PersonalRecord;
  });
}

export function encodeLibrary(records: PersonalRecord[]) {
  const raw = JSON.stringify({ version: 1, records });
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
