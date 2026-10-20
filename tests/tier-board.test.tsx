import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import { TierBoard } from "@/app/tier-board";
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
});

it("shows the watched month and title without restoring extra card controls", () => {
  render(<TierBoard records={[{ id: "one", title: "作品タイトル", rating: "SS", watchedMonth: "2025-06", review: "非表示の感想", tags: ["SF"], status: "COMPLETED", updatedAt: "2026-01-01T00:00:00.000Z" }]} draft={null} onPlace={vi.fn()} onCancel={vi.fn()} />);
  const heading = screen.getByRole("heading", { name: /^作品タイトル$/ });
  expect(heading.closest(".tier-item")?.textContent).toBe("2025/06作品タイトル");
  expect(heading.closest(".tier-item")?.querySelector("time")?.getAttribute("datetime")).toBe("2025-06");
  expect(screen.getByRole("button", { name: "作品タイトルを移動" })).toBeTruthy();
  expect(screen.queryByText("2025-06")).toBeNull();
  expect(screen.queryByText("非表示の感想")).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull();
});
it("does not fabricate a watched month for legacy records", () => {
  render(<TierBoard records={[{ id: "legacy", title: "年月不明の作品", rating: "A", review: "", tags: [], status: "COMPLETED", updatedAt: "2026-01-01T00:00:00.000Z" }]} draft={null} onPlace={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByText("年月未登録")).toBeTruthy();
  expect(document.querySelector(".tier-item time")).toBeNull();
});

it("offers non-drag placement in a dialog without adding controls to cards", () => {
  const records = ["う", "え", "お"].map((title, i) => ({ id: `item-${i}`, title, rating: "S" as const, review: "", tags: [], status: "COMPLETED" as const, updatedAt: "2026-01-01T00:00:00.000Z" }));
  const onPlace = vi.fn();
  render(<TierBoard records={records} draft={null} onPlace={onPlace} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "えを移動" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "左へ移動" }));
  expect(onPlace).toHaveBeenCalledWith(records[1], "S", records[0].id, false);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("keeps placement open when storage refuses the change", () => {
  const record = { id: "one", title: "作品", rating: "A" as const, review: "", tags: [], status: "COMPLETED" as const, updatedAt: "2026-01-01T00:00:00.000Z" };
  render(<TierBoard records={[record]} draft={null} onPlace={() => false} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "作品を移動" }));
  fireEvent.change(screen.getByRole("combobox", { name: "評価" }), { target: { value: "S" } });
  fireEvent.click(screen.getByRole("button", { name: "配置を保存" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
});

it("does not accidentally append a work when its placement is saved unchanged", () => {
  const record = { id: "unchanged", title: "順番を保つ作品", rating: "A" as const, review: "", tags: [], status: "COMPLETED" as const, updatedAt: "2026-01-01T00:00:00.000Z" };
  const onPlace = vi.fn();
  render(<TierBoard records={[record]} draft={null} onPlace={onPlace} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "順番を保つ作品を移動" }));
  fireEvent.click(screen.getByRole("button", { name: "配置を保存" }));
  expect(onPlace).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});
