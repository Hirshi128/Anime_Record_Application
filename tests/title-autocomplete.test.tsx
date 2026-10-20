import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TitleAutocomplete } from "@/app/anime/title-autocomplete";

const suggestions = [
  { id: 1, title: "進撃の巨人", subtitle: "2013 / TV" },
  { id: 2, title: "進撃の巨人 Season 2", subtitle: "2017 / TV" },
];
const response = (items = suggestions) => ({
  ok: true,
  json: async () => ({ suggestions: items }),
});
afterEach(() => vi.unstubAllGlobals());
function search(query = "進撃") {
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: query } });
  return input;
}

describe("title suggestions", () => {
  it("announces result availability after loading without preselecting a candidate", async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { finish = resolve; })));
    render(<TitleAutocomplete />);
    const input = search();
    await screen.findByText("検索中...");
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    await act(async () => finish(response()));
    expect(screen.getByRole("status").textContent).toBe("2件の候補が見つかりました。");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: /Season 2/ }));
    expect(screen.getByRole("status").textContent).toBe("");
  });
  it("announces an empty result rather than a successful candidate count", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([])));
    render(<TitleAutocomplete />);
    search();
    await screen.findByText("一致する候補が見つかりませんでした。");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("status").textContent).not.toContain("0件");
  });
  it("resumes searching after a composition is abandoned by leaving the input", async () => {
    const fetch = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetch);
    render(<TitleAutocomplete />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "進撃" } });
    fireEvent.blur(input);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.focus(input);
    await screen.findByRole("option", { name: /Season 2/ });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("waits for IME composition to finish before searching the committed title", async () => {
    const fetch = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetch);
    render(<TitleAutocomplete />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "進撃" } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.compositionEnd(input);
    await screen.findByRole("option", { name: /Season 2/ });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("進撃")), expect.any(Object));
  });
  it("cancels an in-flight search when composition starts and ignores its late response", async () => {
    let resolveOld!: (value: ReturnType<typeof response>) => void;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(response([{ id: 3, title: "化物語", subtitle: "" }]));
    vi.stubGlobal("fetch", fetch);
    render(<TitleAutocomplete />);
    const input = search();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    fireEvent.compositionStart(input);
    await act(async () => { resolveOld(response()); });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.change(input, { target: { value: "化物" } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.compositionEnd(input);
    await screen.findByRole("option", { name: "化物語" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("option", { name: /進撃/ })).toBeNull();
  });
  it.each([
    [{ id: 3, title: "Refreshed title", subtitle: "" }],
    [{ id: 3, title: "First new title", subtitle: "" }, { id: 4, title: "Last new title", subtitle: "" }],
  ])("clears the keyboard selection when refocusing refreshes the result set", async (...items) => {
    const updated = items as typeof suggestions;
    const fetch = vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(response(updated));
    vi.stubGlobal("fetch", fetch);
    render(<TitleAutocomplete />);
    const input = search();
    await screen.findByRole("option", { name: /Season 2/ });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.getAttribute("aria-activedescendant")).toBe(screen.getByRole("option", { name: /Season 2/ }).id);
    fireEvent.blur(input);
    fireEvent.focus(input);
    const last = updated[updated.length - 1];
    await screen.findByRole("option", { name: last.title });
    expect(input.getAttribute("aria-activedescendant")).toBeNull();
    expect(screen.getAllByRole("option").every((option) => option.getAttribute("aria-selected") === "false")).toBe(true);
    expect((input as HTMLInputElement).value).toBe("進撃");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect((input as HTMLInputElement).value).toBe(last.title);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("selects with arrows and Enter without submitting the parent form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    const submit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <TitleAutocomplete />
      </form>,
    );
    const input = search();
    await screen.findByRole("option", { name: /Season 2/ });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const option = screen.getByRole("option", { name: /Season 2/ });
    expect(input.getAttribute("aria-activedescendant")).toBe(option.id);
    fireEvent.keyDown(input, { key: "Enter" });
    expect((input as HTMLInputElement).value).toBe(suggestions[1].title);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });
  it("clears old options and ignores responses from cancelled searches", async () => {
    let resolveOld!: (value: ReturnType<typeof response>) => void;
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce(
        response([{ id: 3, title: "化物語", subtitle: "" }]),
      );
    vi.stubGlobal("fetch", fetch);
    render(<TitleAutocomplete />);
    const input = search();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: "化物" } });
    await screen.findByRole("option", { name: "化物語" });
    await act(async () => {
      resolveOld(response());
    });
    expect(screen.queryByRole("option", { name: /進撃/ })).toBeNull();
    expect(screen.getByRole("option", { name: "化物語" })).toBeTruthy();
    fireEvent.change(input, { target: { value: "a" } });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("does not re-search a selected title", async () => {
    const fetch = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetch);
    render(<TitleAutocomplete />);
    const input = search();
    fireEvent.click(await screen.findByRole("option", { name: /Season 2/ }));
    fireEvent.focus(input);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("does not treat an IME confirmation as candidate selection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    render(<TitleAutocomplete />);
    const input = search();
    await screen.findByRole("listbox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect((input as HTMLInputElement).value).toBe("進撃");
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("keeps manual input usable when the provider fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<TitleAutocomplete />);
    search();
    await screen.findByText(/候補を取得できませんでした/);
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe(
      "進撃",
    );
  });
});
