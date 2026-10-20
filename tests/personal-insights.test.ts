import { expect, it, vi } from "vitest";
import { availableYears, decodeRatingGuide, defaultRatingGuide, personalInsights, periodRecords, ratingGuideKey, saveRatingGuide } from "@/lib/personal-insights";
import { decodeLibrary, encodeLibrary, matchesPersonalQuery, normalizedTitle, startRewatch, type PersonalRecord } from "@/lib/personal-library";
import { tierImageLayout } from "@/lib/tier-image";

const record: PersonalRecord = { id: "one", title: "作品", watchedMonth: "2024-06", rating: "S", status: "COMPLETED", tags: ["SF"], review: "初回の感想", updatedAt: "2024-06-30T00:00:00Z" };
const rewatched: PersonalRecord = { ...startRewatch(record, "view-one"), watchedMonth: "2025-07", rating: "SS", review: "見直した感想", updatedAt: "2025-07-31T00:00:00Z" };

it("preserves original data and old storage compatibility when adding a rewatch", () => {
  expect(record.history).toBeUndefined();
  const decoded = decodeLibrary(encodeLibrary([rewatched]));
  expect(decoded[0].history?.[0]).toMatchObject({ watchedMonth: "2024-06", rating: "S", review: "初回の感想" });
  expect(decoded[0]).toMatchObject({ id: "one", watchedMonth: "2025-07", rating: "SS", review: "見直した感想" });
  expect(decodeLibrary(encodeLibrary([record]))[0]).toEqual(record);
  expect(decodeLibrary(JSON.stringify({ version: 1, records: [record] }))[0]).toEqual(record);
  expect(JSON.parse(encodeLibrary([rewatched])).version).toBe(2);
});

it.each([{}, [null], [{ ...record, history: [] }], [{ ...record, rating: "F" }], Array(201).fill(record)])("rejects malformed viewing histories without writing them", history => {
  expect(() => decodeLibrary(JSON.stringify({ version: 1, records: [{ ...record, history }] }))).toThrow();
});

it("rejects history with duplicate IDs", () => {
  expect(() => encodeLibrary([{ ...record, history: [record, record] }])).toThrow();
  expect(() => encodeLibrary([{ ...record, history: [record] }])).toThrow();
});

it("retains unknown watched dates instead of assigning the current month", () => {
  const unknown = { ...record };
  delete unknown.watchedMonth;
  const next = startRewatch(unknown, "unknown");
  expect(next.history?.[0].watchedMonth).toBeUndefined();
  expect(next.watchedMonth).toBe("");
});

it("uses the last viewing in the requested period without mutating current ratings", () => {
  expect(periodRecords([rewatched], "2024")[0]).toMatchObject({ id: "one", rating: "S", watchedMonth: "2024-06" });
  expect(periodRecords([rewatched], "2025")[0].rating).toBe("SS");
  expect(periodRecords([rewatched], "2024", "2024-05")).toEqual([]);
  expect(rewatched.rating).toBe("SS");
  expect(availableYears([rewatched])).toEqual(["2025", "2024"]);
});

it("counts unique works separately from sessions and identifies rewatches across years", () => {
  const insights = personalInsights([rewatched], "2025");
  expect(insights.works).toHaveLength(1);
  expect(insights.viewings).toBe(1);
  expect(insights.rewatches).toBe(1);
  expect(insights.months[6].count).toBe(1);
  expect(insights.genres).toEqual([{ name: "SF", count: 1, favorites: 1 }]);
  expect(personalInsights([rewatched]).viewings).toBe(2);
});

it("keeps left-to-right order as the tie breaker for favorites and counts untagged works", () => {
  const works = [{ ...record, id: "a", title: "先" }, { ...record, id: "b", title: "後", tags: [] }];
  const insights = personalInsights(works);
  expect(insights.top.map(r => r.title)).toEqual(["先", "後"]);
  expect(insights.grades.find(g => g.rating === "S")?.count).toBe(2);
  expect(personalInsights([]).top).toEqual([]);
});

it("recognizes full-width characters, whitespace and case in duplicate titles", () => {
  expect(normalizedTitle(" ＳＦ　作品 ")).toBe(normalizedTitle("sf作品"));
});

it("matches normalized multiple search words across title, comments and tags", () => {
  expect(matchesPersonalQuery({ ...record, title: "ＳＦ作品", review: "心に残る物語", tags: ["冒険"] }, "sf 冒険 心に")).toBe(true);
  expect(matchesPersonalQuery(record, " ")).toBe(true);
  expect(matchesPersonalQuery(record, "作品 存在しない")).toBe(false);
});

it("refuses additional rewatches at the per-work history bound", () => {
  const full = { ...record, history: Array.from({ length: 200 }, (_, i) => ({ ...record, id: `past-${i}` })) };
  expect(() => startRewatch(full)).toThrow("200件");
  expect(full.history).toHaveLength(200);
});

it("saves a validated independent rating guide without touching journal records", () => {
  const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
  const guide = { ...defaultRatingGuide, SS: "人生の一本" };
  saveRatingGuide(null, guide, storage);
  expect(storage.setItem).toHaveBeenCalledWith(ratingGuideKey, expect.any(String));
  expect(decodeRatingGuide(storage.setItem.mock.calls[0][1])).toEqual(guide);
  expect(decodeRatingGuide(null)).toEqual(defaultRatingGuide);
});

it("protects corrupt guides, stale-tab edits and oversized descriptions", () => {
  expect(() => decodeRatingGuide("broken")).toThrow();
  expect(() => decodeRatingGuide(JSON.stringify({ version: 1, descriptions: {} }))).toThrow();
  const storage = { getItem: () => "newer", setItem: vi.fn() };
  expect(() => saveRatingGuide(null, defaultRatingGuide, storage)).toThrow("別の画面");
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(() => saveRatingGuide("newer", { ...defaultRatingGuide, S: "x".repeat(101) }, storage)).toThrow();
});

it("wraps image tiers without changing record order or overflowing card columns", () => {
  const records = Array.from({ length: 6 }, (_, i) => ({ ...record, id: `id-${i}` }));
  const layout = tierImageLayout(records);
  expect(layout.columns).toBe(5);
  expect(layout.rows.find(r => r.rating === "S")?.records.map(r => r.id)).toEqual(records.map(r => r.id));
  expect(layout.width).toBe(1000);
  expect(layout.height).toBeGreaterThan(tierImageLayout([]).height);
});
