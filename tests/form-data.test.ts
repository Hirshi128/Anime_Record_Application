import { describe, expect, it } from "vitest";
import { parseAnimeForm } from "@/lib/anime-form-data";
import { parseProfileChoices, parseUserBasics } from "@/lib/user-form-data";
import { formatDate } from "@/lib/anime-options";

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value])
      data.append(key, item);
  }
  return data;
}

describe("form validation", () => {
  it.each([
    { displayName: "n".repeat(101), username: "valid_user" },
    { displayName: "Name", username: "u".repeat(65) },
  ])("rejects oversized profile basics consistently with signup", (values) => {
    expect(parseUserBasics(form(values))).toHaveProperty("error");
  });
  it("accepts exact profile limits after trimming and username normalization", () => {
    expect(parseUserBasics(form({ displayName: ` ${"名".repeat(100)} `, username: ` ${"U".repeat(64)} ` })))
      .toEqual({ data: { displayName: "名".repeat(100), username: "u".repeat(64) } });
  });
  it("formats dates in Japan time regardless of the deployment timezone", () => {
    expect(formatDate(new Date("2026-10-01T23:30:00Z"))).toContain(
      "2026/10/02",
    );
    expect(formatDate(new Date("2026-10-01T23:30:00Z"))).toContain("8:30");
  });
  it("normalizes valid records and deduplicates only supported genres", () => {
    expect(
      parseAnimeForm(
        form({
          title: "  進撃の巨人 ",
          rating: "SS",
          status: "COMPLETED",
          review: " ",
          tags: [" SF ", "SF", "unknown"],
        }),
      ),
    ).toEqual({
      data: {
        title: "進撃の巨人",
        rating: "SS",
        status: "COMPLETED",
        review: null,
        tagNames: ["SF"],
      },
    });
  });
  it.each([
    { title: " ", rating: "SS", status: "COMPLETED" },
    { title: "作品", rating: "X", status: "COMPLETED" },
    { title: "作品", rating: "SS", status: "INVALID" },
  ])("returns an error for invalid record input %j", (values) => {
    expect(parseAnimeForm(form(values))).toHaveProperty("error");
  });
  it("rejects invalid usernames instead of silently removing characters", () => {
    expect(
      parseUserBasics(form({ displayName: "名前", username: "ab!c" })),
    ).toHaveProperty("error");
    expect(
      parseUserBasics(form({ displayName: "名前", username: "Hirsh_123" })),
    ).toEqual({ data: { displayName: "名前", username: "hirsh_123" } });
  });
  it("rejects over-limit choices and malformed IDs", () => {
    expect(
      parseProfileChoices(form({ featuredAnimeIds: ["1", "2", "3", "4"] })),
    ).toHaveProperty("error");
    for (const id of [
      "0",
      "-1",
      "1.5",
      "1e2",
      "2147483648",
      "9007199254740992",
      "bad",
    ]) {
      expect(
        parseProfileChoices(form({ featuredAnimeIds: [id] })),
      ).toHaveProperty("error");
    }
  });
  it("allows empty choices to clear featured records and favorite genres", () => {
    expect(parseProfileChoices(new FormData())).toEqual({
      data: { featuredAnimeIds: [], favoriteGenres: [] },
    });
    expect(
      parseProfileChoices(
        form({
          featuredAnimeIds: ["1", "1"],
          favoriteGenres: ["日常", "日常", "other"],
        }),
      ),
    ).toEqual({ data: { featuredAnimeIds: [1], favoriteGenres: ["日常"] } });
  });
});
