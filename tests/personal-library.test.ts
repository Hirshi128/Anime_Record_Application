import { expect, it, vi } from "vitest";
import { decodeLibrary, encodeLibrary, libraryKey, newPersonalId, placeInTier, personalRatings, saveLibrary, type PersonalRecord } from "@/lib/personal-library";
const record: PersonalRecord = { id: "id-1", title: "作品", rating: "SS", status: "COMPLETED", review: "感想", tags: ["SF"], updatedAt: "2026-10-20T00:00:00.000Z" };
it("generates browser IDs without requiring secure-context randomUUID", () => {
  expect(newPersonalId()).toMatch(/^[a-f0-9]{32}$/);
  expect(newPersonalId()).not.toBe(newPersonalId());
});
it.each(["2025-00", "2025-13", "0000-01", "2025-2"])("rejects an invalid watched month %s", watchedMonth => {
  expect(() => decodeLibrary(encodeLibrary([{ ...record, watchedMonth }]))).toThrow();
});
it("preserves watched months and does not invent dates for older records", () => {
  expect(decodeLibrary(encodeLibrary([{ ...record, watchedMonth: "2025-02" }]))[0].watchedMonth).toBe("2025-02");
  expect(decodeLibrary(encodeLibrary([record]))[0].watchedMonth).toBeUndefined();
});
it("inserts a new work between existing works and persists left-to-right order", () => {
  const rows = ["う", "え", "お"].map((title, i) => ({ ...record, id: `id-${i}`, title, rating: "S" as const }));
  const next = placeInTier(rows, { ...record, id: "new", title: "か" }, "S", rows[2].id);
  expect(decodeLibrary(encodeLibrary(next)).map(r => r.title)).toEqual(["う", "え", "か", "お"]);
  expect(rows.map(r => r.title)).toEqual(["う", "え", "お"]);
});
it("moves a work across tiers and supports both sides of a target without duplication", () => {
  const rows = [{ ...record, id: "a", rating: "SS" as const }, { ...record, id: "b", rating: "S" as const }, { ...record, id: "c", rating: "S" as const }];
  const moved = placeInTier(rows, rows[0], "S", "b", true);
  expect(moved.map(r => r.id)).toEqual(["b", "a", "c"]);
  expect(moved[1].rating).toBe("S");
  expect(placeInTier(moved, moved[1], "SS").filter(r => r.rating === "S").map(r => r.id)).toEqual(["b", "c"]);
});
it("has exactly seven ordered grades and roundtrips each without numeric conversion", () => {
  expect(personalRatings).toEqual(["SS", "S", "A", "B", "C", "D", "E"]);
  for (const rating of personalRatings) expect(decodeLibrary(encodeLibrary([{ ...record, rating }]))[0].rating).toBe(rating);
  expect(decodeLibrary(null)).toEqual([]);
});
it.each(["{", "null", '{"version":3,"records":[]}', '{"version":1,"records":{}}'])("rejects malformed or unsupported backups: %s", raw => {
  expect(() => decodeLibrary(raw)).toThrow();
});
it.each([{ rating: 10 }, { rating: "10" }, { rating: "F" }, { title: " " }, { title: "x".repeat(201) }, { review: 1 }, { tags: [null] }, { updatedAt: "bad" }, { id: "<script>" }])("rejects invalid records without rewriting data", values => {
  expect(() => decodeLibrary(JSON.stringify({ version: 1, records: [{ ...record, ...values }] }))).toThrow();
});
it("rejects duplicate IDs and discards unknown imported fields", () => {
  expect(() => decodeLibrary(JSON.stringify({ version: 1, records: [record, record] }))).toThrow();
  expect(decodeLibrary(JSON.stringify({ version: 1, records: [{ ...record, password: "never store" }] }))).toEqual([record]);
});
it("does not overwrite a newer browser-tab change", () => {
  const storage = { getItem: vi.fn(() => "newer"), setItem: vi.fn() };
  expect(() => saveLibrary(null, [record], storage)).toThrow("別の画面");
  expect(storage.setItem).not.toHaveBeenCalled();
});
it("writes only the personal storage key and propagates quota failures", () => {
  const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
  saveLibrary(null, [record], storage);
  expect(storage.setItem).toHaveBeenCalledWith(libraryKey, encodeLibrary([record]));
  storage.setItem.mockImplementation(() => { throw new Error("quota"); });
  expect(() => saveLibrary(null, [record], storage)).toThrow("quota");
});

it("preserves every other work and its history across a deterministic series of tier moves", () => {
  let seed = 12345;
  const random = (max: number) => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % max; };
  let records: PersonalRecord[] = Array.from({ length: 20 }, (_, i) => ({ ...record, id: `work-${i}`, title: `作品${i}`, rating: personalRatings[i % personalRatings.length], history: [{ id: `past-${i}`, rating: "S", status: "COMPLETED", review: "前回の感想", tags: [], updatedAt: record.updatedAt, watchedMonth: "2024-01" }] }));
  for (let i = 0; i < 100; i++) {
    const moved = records[random(records.length)];
    const rating = personalRatings[random(personalRatings.length)];
    const peers = records.filter(r => r.id !== moved.id && r.rating === rating);
    const target = peers.length ? peers[random(peers.length)].id : undefined;
    const next = placeInTier(records, moved, rating, target, Boolean(random(2)));
    expect(new Set(next.map(r => r.id)).size).toBe(20);
    expect(next.filter(r => r.id !== moved.id)).toEqual(records.filter(r => r.id !== moved.id));
    expect(next.find(r => r.id === moved.id)).toEqual({ ...moved, rating });
    records = decodeLibrary(encodeLibrary(next));
  }
});
