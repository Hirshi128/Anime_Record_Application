import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TierBoard } from "@/app/tier-board";

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
