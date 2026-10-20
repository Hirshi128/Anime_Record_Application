import { describe, expect, it } from "vitest";
import { parseCredentials } from "@/lib/auth-input";

function input(email: string, password: string, confirmation = password) {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  form.set("passwordConfirmation", confirmation);
  return form;
}
describe("credential validation", () => {
  it("normalizes email without trimming the password", () => {
    expect(parseCredentials(input(" TEST@Example.COM ", " secret pass "), true)).toEqual({ data: { email: "test@example.com", password: " secret pass " } });
  });
  it.each(["", "x", "user@host", "two@@example.com", "a b@example.com", `${"a".repeat(250)}@example.com`])("rejects malformed email %s", (email) => {
    expect(parseCredentials(input(email, "long-password"), true).error).toBeTruthy();
  });
  it.each(["", "short", "a".repeat(129)])("rejects invalid signup password length", (password) => {
    expect(parseCredentials(input("user@example.com", password), true).error).toBeTruthy();
  });
  it("accepts existing shorter passwords only at login and rejects mismatched confirmation", () => {
    expect(parseCredentials(input("user@example.com", "old")).data).toBeTruthy();
    expect(parseCredentials(input("user@example.com", "long-password", "different"), true).error).toBeTruthy();
  });
});
