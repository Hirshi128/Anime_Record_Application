import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { updateUserProfile } = vi.hoisted(() => ({
  updateUserProfile: vi.fn(),
}));
vi.mock("@/app/users/actions", () => ({ updateUserProfile }));
import { ProfileForm } from "@/app/users/profile/profile-form";

const animeList = Array.from({ length: 4 }, (_, index) => ({
  id: index + 1,
  title: `作品${index + 1}`,
  rating: "A" as const,
  status: "COMPLETED" as const,
  isFeatured: index < 2,
}));
const props = {
  user: { displayName: "名前", username: "user_1", favoriteGenres: [] },
  animeList,
  pendingFriendRequestCount: 2,
};

describe("profile form", () => {
  it("uses the same input length limits as credential signup", () => {
    render(<ProfileForm {...props} />);
    expect((screen.getByRole("textbox", { name: "表示名" }) as HTMLInputElement).maxLength).toBe(100);
    expect((screen.getByRole("textbox", { name: "ユーザーID" }) as HTMLInputElement).maxLength).toBe(64);
  });
  it("prevents a fourth selection and updates chips immediately", () => {
    render(<ProfileForm {...props} />);
    const third = screen.getByRole("checkbox", { name: /作品3/ });
    const fourth = screen.getByRole("checkbox", {
      name: /作品4/,
    }) as HTMLInputElement;
    fireEvent.click(third);
    expect(fourth.disabled).toBe(true);
    expect(screen.getAllByText("選択中")).toHaveLength(3);
    fireEvent.click(screen.getByRole("checkbox", { name: /作品1/ }));
    expect(fourth.disabled).toBe(false);
    expect(screen.getAllByText("選択中")).toHaveLength(2);
  });
  it.each([
    "このユーザーIDはすでに使われています。",
    "プロフィールの保存結果を確認できませんでした。入力内容を確認し、時間をおいて再度お試しください。",
  ])("keeps profile edits and choices after server feedback: %s", async (message) => {
    updateUserProfile.mockResolvedValue({ message });
    const user = userEvent.setup();
    render(<ProfileForm {...props} />);
    const displayName = screen.getByRole("textbox", {
      name: "表示名",
    }) as HTMLInputElement;
    await user.clear(displayName);
    await user.type(displayName, "変更した名前");
    const username = screen.getByRole("textbox", { name: "ユーザーID" });
    await user.clear(username);
    await user.type(username, "changed_user");
    await user.click(screen.getByRole("checkbox", { name: "SF" }));
    await user.click(screen.getByRole("checkbox", { name: /作品3/ }));
    await user.click(
      screen.getByRole("button", { name: "プロフィールを保存" }),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect((screen.getByRole("textbox", { name: "表示名" }) as HTMLInputElement).value).toBe("変更した名前");
    expect((screen.getByRole("textbox", { name: "ユーザーID" }) as HTMLInputElement).value).toBe("changed_user");
    expect((screen.getByRole("checkbox", { name: /作品3/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByText("選択中")).toHaveLength(3);
    expect(
      (screen.getByRole("checkbox", { name: "SF" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      screen.getByRole("link", { name: /未対応のフレンド申請 2 件/ }),
    ).toBeTruthy();
  });
});
