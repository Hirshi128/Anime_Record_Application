import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
const { signIn, signUp } = vi.hoisted(() => ({ signIn: vi.fn(), signUp: vi.fn() }));
vi.mock("@/app/users/auth-actions", () => ({ signIn, signUp }));
import { CredentialsForm } from "@/app/users/credentials-form";

beforeEach(() => { vi.resetAllMocks(); });

it("toggles each password independently without changing its value or submitting", async () => {
  render(<CredentialsForm signingUp />);
  const user = userEvent.setup();
  const password = screen.getByLabelText("パスワード") as HTMLInputElement;
  const confirmation = screen.getByLabelText("パスワード（確認）") as HTMLInputElement;
  await user.type(password, "test-password");
  await user.click(screen.getByRole("button", { name: "パスワードを表示" }));
  expect(password.type).toBe("text");
  expect(password.value).toBe("test-password");
  expect(confirmation.type).toBe("password");
  const hide = screen.getByRole("button", { name: "パスワードを隠す" });
  expect(hide.getAttribute("aria-pressed")).toBe("true");
  expect(hide.getAttribute("aria-controls")).toBe(password.id);
  await user.click(hide);
  expect(password.type).toBe("password");
  expect(signUp).not.toHaveBeenCalled();
});

it("disables pending fields and retains credentials after an expected error", async () => {
  let finish!: (value: { message: string }) => void;
  signIn.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<CredentialsForm />);
  const user = userEvent.setup();
  const email = screen.getByLabelText("メールアドレス") as HTMLInputElement;
  const password = screen.getByLabelText("パスワード") as HTMLInputElement;
  await user.type(email, "test@example.com");
  await user.type(password, "test-password");
  await user.click(screen.getByRole("button", { name: "ログイン" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "確認中..." }).hasAttribute("disabled")).toBe(true));
  expect(password.matches(":disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "パスワードを表示" }).matches(":disabled")).toBe(true);
  await act(async () => finish({ message: "ログインを確認してください。" }));
  expect(screen.getByRole("alert").textContent).toContain("確認してください");
  expect((screen.getByLabelText("メールアドレス") as HTMLInputElement).value).toBe("test@example.com");
  expect((screen.getByLabelText("パスワード") as HTMLInputElement).value).toBe("test-password");
  expect(screen.getByLabelText("パスワード").matches(":disabled")).toBe(false);
  expect(screen.getByRole("button", { name: "ログイン" })).toBeTruthy();
});
