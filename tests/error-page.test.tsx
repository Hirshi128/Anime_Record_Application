import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";

describe("error recovery", () => {
  it("uses the installed Next.js retry callback and keeps internal errors private", () => {
    const retry = vi.fn();
    render(<ErrorPage retry={retry} error={new Error("private connection details")} />);
    expect(screen.queryByText(/private connection details/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
