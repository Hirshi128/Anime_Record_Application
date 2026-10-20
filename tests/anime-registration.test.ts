import { expect, it } from "vitest";
import { animeRegistrationHref, registrationTitle } from "@/lib/anime-registration";
it("encodes a title as data, not extra URL fields or a destination", () => {
  const title = '作品 & title?rating=SS#<script>"';
  const url = new URL(animeRegistrationHref(title), "https://local.invalid");
  expect(url.pathname).toBe("/anime/new");
  expect([...url.searchParams]).toEqual([["title", title]]);
  expect(url.hash).toBe("");
});
it("trims a bounded prefill without silently truncating a work's title", () => {
  expect(registrationTitle("  進撃の巨人  ")).toBe("進撃の巨人");
  expect(registrationTitle("a".repeat(200))).toHaveLength(200);
  expect(animeRegistrationHref("a".repeat(201))).toBe("/anime/new");
});
it.each([undefined, null, 42, {}, "", "  ", "bad\u0000title", "bad\ntitle"])("ignores invalid prefill %j", (value) => {
  expect(registrationTitle(value)).toBe("");
});
it("takes only the first repeated title parameter", () => {
  expect(registrationTitle(["First", "Second"])).toBe("First");
  expect(registrationTitle([])).toBe("");
});
