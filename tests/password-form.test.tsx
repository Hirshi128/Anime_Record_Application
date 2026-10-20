import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
const { changePassword } = vi.hoisted(() => ({ changePassword: vi.fn() }));
vi.mock("@/app/users/account/actions", () => ({ changePassword }));
import { PasswordChangeForm } from "@/app/users/account/password-form";

it("keeps passwords after rejection, uses correct autocomplete, and disables pending controls", async () => {
  let finish!: (value: { message: string }) => void;
  changePassword.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<PasswordChangeForm />);
  const user = userEvent.setup();
  const entries = [
    ["現在のパスワード", "old-password", "current-password"],
    ["新しいパスワード", "new-password", "new-password"],
    ["新しいパスワード（確認）", "new-password", "new-password"],
  ];
  for (const [label, value, complete] of entries) {
    const input = screen.getByLabelText(label);
    expect(input.getAttribute("type")).toBe("password");
    expect(input.getAttribute("autocomplete")).toBe(complete);
    await user.type(input, value);
  }
  await user.click(screen.getByRole("button", { name: "パスワードを変更" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "変更中..." }).hasAttribute("disabled")).toBe(true));
  expect(screen.getByLabelText("現在のパスワード").matches(":disabled")).toBe(true);
  await act(async () => finish({ message: "現在のパスワードが違います。" }));
  expect(screen.getByRole("alert").textContent).toContain("違います");
  for (const [label, value] of entries) expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(value);
  expect(screen.getByLabelText("現在のパスワード").matches(":disabled")).toBe(false);
});
