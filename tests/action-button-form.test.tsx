import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActionButtonForm } from "@/app/action-button-form";

describe("destructive action confirmation", () => {
  it("keeps recoverable server feedback next to the command and restores the button", async () => {
    render(<ActionButtonForm action={async () => ({ message: "ページを更新して結果を確認してください。" })} label="フレンド申請" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "フレンド申請" }));
    expect(screen.getByRole("alert").textContent).toContain("ページを更新");
    expect((screen.getByRole("button", { name: "フレンド申請" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("reserves both labels while exposing only the current accessible name", async () => {
    let complete!: (value: { message: string }) => void;
    const action = vi.fn(() => new Promise<{ message: string }>((resolve) => {
      complete = resolve;
    }));
    render(<ActionButtonForm action={action} label="削除" pendingLabel="削除中..." />);
    const button = screen.getByRole("button", { name: "削除" });
    const labels = button.querySelectorAll(".action-label > span");
    expect(labels).toHaveLength(2);
    expect(labels[1].getAttribute("aria-hidden")).toBe("true");
    await userEvent.setup().click(button);
    expect(screen.getByRole("button", { name: "削除中..." })).toBe(button);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(labels[0].getAttribute("aria-hidden")).toBe("true");
    expect(labels[1].getAttribute("aria-hidden")).toBe("false");
    await act(async () => complete({ message: "" }));
    expect(screen.getByRole("button", { name: "削除" })).toBe(button);
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
  it("does not invoke the action when deletion is cancelled", () => {
    const action = vi.fn().mockResolvedValue({ message: "" });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <ActionButtonForm
        action={action}
        label="削除"
        confirmation="この記録を削除しますか？"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    expect(confirm).toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
