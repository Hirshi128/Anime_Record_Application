import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const { owner, change } = vi.hoisted(() => ({ owner: vi.fn(), change: vi.fn() }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUser: owner }));
vi.mock("@/lib/auth-mode", () => ({ usesCredentialAuth: () => true }));
vi.mock("@/app/users/account/actions", () => ({ changePassword: change }));
import AccountPage from "@/app/users/account/page";

const first = "12345678-1234-4123-8123-123456789abc";
const second = "87654321-4321-4321-8321-cba987654321";
beforeEach(() => { vi.resetAllMocks(); owner.mockResolvedValue({ id: 7 }); });
function enterSecrets() {
  for (const label of ["現在のパスワード", "新しいパスワード", "新しいパスワード（確認）"])
    fireEvent.change(screen.getByLabelText(label), { target: { value: "private-password" } });
}
function expectEmpty() {
  for (const label of ["現在のパスワード", "新しいパスワード", "新しいパスワード（確認）"])
    expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
}
it("clears all password inputs after every successful change, including a second change", async () => {
  const view = render(await AccountPage({ searchParams: Promise.resolve({}) }));
  for (const changed of [first, second]) {
    enterSecrets();
    view.rerender(await AccountPage({ searchParams: Promise.resolve({ changed }) }));
    expectEmpty();
    expect(screen.getByRole("status").textContent).toContain("パスワードを変更しました");
  }
  expect(change).not.toHaveBeenCalled();
});
it("retains the draft on the same completion marker but clears it when the owner changes", async () => {
  const props = { searchParams: Promise.resolve({ changed: first }) };
  const view = render(await AccountPage(props));
  enterSecrets();
  view.rerender(await AccountPage(props));
  expect((screen.getByLabelText("現在のパスワード") as HTMLInputElement).value).toBe("private-password");
  owner.mockResolvedValue({ id: 8 });
  view.rerender(await AccountPage(props));
  expectEmpty();
});
it("keeps the legacy success URL working and ignores malformed completion markers", async () => {
  const view = render(await AccountPage({ searchParams: Promise.resolve({ changed: "1" }) }));
  expect(screen.getByRole("status")).toBeTruthy();
  view.rerender(await AccountPage({ searchParams: Promise.resolve({ changed: "invalid" }) }));
  expect(screen.queryByRole("status")).toBeNull();
});
it("requires authentication before reading completion parameters", async () => {
  owner.mockRejectedValue(new Error("Unauthenticated"));
  await expect(AccountPage({ searchParams: new Promise(() => {}) })).rejects.toThrow("Unauthenticated");
});
