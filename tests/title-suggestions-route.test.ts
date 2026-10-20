// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/anime-title-suggestions/route";

afterEach(() => vi.unstubAllGlobals());
const request = (query: string) =>
  new NextRequest(
    `http://localhost/api/anime-title-suggestions?query=${encodeURIComponent(query)}`,
  );

describe("title suggestion provider", () => {
  it("keeps valid candidates when individual provider entries are malformed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { Page: { media: [
      null, { title: { native: "Missing ID" } }, { id: 0, title: { native: "Zero" } },
      { id: "12", title: { native: "String ID" } }, { id: Number.MAX_SAFE_INTEGER + 1, title: { native: "Unsafe ID" } },
      { id: 12, title: { native: "Valid title", romaji: "Valid romaji" }, seasonYear: 2026, format: "TV" },
    ] } } }) }));
    const result = await GET(request("Valid"));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ suggestions: [{ id: 12, title: "Valid title", subtitle: "Valid romaji / 2026 / TV" }] });
  });
  it("deduplicates candidate IDs and omits malformed subtitle values", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { Page: { media: [
      { id: 1, title: { native: "First title", romaji: { invalid: true } }, seasonYear: -1, format: { invalid: true } },
      { id: 1, title: { native: "Duplicate ID" } },
      { id: 2, title: { native: "Second title", romaji: "   " }, seasonYear: 2026.5, format: "  MOVIE  " },
    ] } } }) }));
    expect(await (await GET(request("title"))).json()).toEqual({ suggestions: [
      { id: 1, title: "First title", subtitle: "" },
      { id: 2, title: "Second title", subtitle: "MOVIE" },
    ] });
  });
  it("does not contact the provider for short or oversized queries", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await GET(request("a"))).status).toBe(200);
    expect((await GET(request("a".repeat(201)))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("returns provider errors as failures rather than empty search results", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ errors: [{ message: "Rate limited" }] }),
        }),
    );
    expect((await GET(request("進撃"))).status).toBe(502);
  });
  it("deduplicates titles and falls back from blank native titles", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          Page: {
            media: [
              {
                id: 1,
                title: { native: "進撃の巨人", romaji: "Shingeki" },
                seasonYear: 2013,
                format: "TV",
              },
              { id: 2, title: { native: "進撃の巨人" } },
              { id: 3, title: { native: " ", romaji: "Another" } },
            ],
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetch);
    const result = await GET(request("進撃"));
    expect(await result.json()).toEqual({
      suggestions: [
        { id: 1, title: "進撃の巨人", subtitle: "Shingeki / 2013 / TV" },
        { id: 3, title: "Another", subtitle: "Another" },
      ],
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://graphql.anilist.co",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it("returns a recoverable error for timeouts and malformed provider data", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: null }) });
    vi.stubGlobal("fetch", fetch);
    expect((await GET(request("進撃"))).status).toBe(502);
    expect((await GET(request("進撃"))).status).toBe(502);
  });
});
