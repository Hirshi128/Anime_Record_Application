import { expect, it } from "vitest";
import { socialReturnPath } from "@/lib/social-return-path";
function form(value: string) { const data = new FormData(); data.set("returnTo", value); return data; }
it("preserves only supported search state and section anchors", () => {
  expect(socialReturnPath(form("/users/search?q=anime%20%26%20test&page=2&friendPage=3&requestPage=4&other=x#friends"))).toBe("/users/search?q=anime+%26+test&page=2&friendPage=3&requestPage=4#friends");
  expect(socialReturnPath(form("/users/search?page=-1&friendPage=1&requestPage=bad#unknown"))).toBe("/users/search");
  expect(socialReturnPath()).toBe("/users/search");
});
it.each(["https://evil.example/users/search", "//evil.example/users/search", "/users/search-other", "/users/search/../account", "/users/search\\@evil.example", "/anime", "javascript:alert(1)", "x".repeat(4097)])("rejects unsupported return paths: %s", (value) => {
  expect(socialReturnPath(form(value))).toBe("/users/search");
});
