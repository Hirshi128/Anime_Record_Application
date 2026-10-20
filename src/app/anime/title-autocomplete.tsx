"use client";

import { useEffect, useId, useRef, useState } from "react";
import { normalizedTitle } from "@/lib/personal-library";

type TitleSuggestion = { id: number; title: string; subtitle: string };
type TitleAutocompleteProps = {
  initialTitle?: string;
  value?: string;
  onChange?: (value: string) => void;
  recordedTitles?: string[];
};

export function TitleAutocomplete({
  initialTitle = "",
  value,
  onChange,
  recordedTitles = [],
}: TitleAutocompleteProps) {
  const listboxId = useId();
  const [localTitle, setLocalTitle] = useState(initialTitle);
  const title = value ?? localTitle;
  const [selectedTitle, setSelectedTitle] = useState(initialTitle);
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const search = title.trim();
    if (!isFocused || isComposing || search.length < 2 || title === selectedTitle) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/anime-title-suggestions?query=${encodeURIComponent(search)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Failed to fetch suggestions");
        const payload = (await response.json()) as {
          suggestions?: TitleSuggestion[];
        };
        // A cancelled request can still resolve after its response has been read.
        if (controller.signal.aborted) return;
        const results = payload.suggestions ?? [];
        setSuggestions(results);
        setActiveIndex(-1);
        setMessage(
          results.length === 0
            ? "一致する候補が見つかりませんでした。"
            : `${results.length}件の候補が見つかりました。`,
        );
      } catch {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setMessage(
          "候補を取得できませんでした。タイトルはそのまま入力できます。",
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [title, isFocused, isComposing, selectedTitle]);

  useEffect(() => {
    if (activeIndex >= 0)
      listRef.current?.children[activeIndex]?.scrollIntoView?.({
        block: "nearest",
      });
  }, [activeIndex]);

  const showSuggestions = isFocused && suggestions.length > 0;
  const activeSuggestion = suggestions[activeIndex];
  function changeTitle(nextTitle: string) {
    setLocalTitle(nextTitle);
    onChange?.(nextTitle);
  }
  function selectSuggestion(suggestion: TitleSuggestion) {
    changeTitle(suggestion.title);
    setSelectedTitle(suggestion.title);
    setSuggestions([]);
    setActiveIndex(-1);
    setIsLoading(false);
    setMessage("");
    setIsFocused(false);
  }

  return (
    <div className="relative space-y-2">
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-zinc-800">タイトル</span>
        <input
          aria-autocomplete="list"
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-expanded={showSuggestions}
          aria-activedescendant={
            showSuggestions && activeSuggestion
              ? `${listboxId}-${activeIndex}`
              : undefined
          }
          autoComplete="off"
          className="field-control text-base placeholder:text-zinc-400"
          name="title"
          onBlur={() => {
            setIsFocused(false);
            setIsComposing(false);
            setIsLoading(false);
          }}
          onChange={(event) => {
            changeTitle(event.target.value);
            setSelectedTitle("");
            setSuggestions([]);
            setActiveIndex(-1);
            setMessage("");
            setIsLoading(false);
            setIsFocused(true);
          }}
          onFocus={() => setIsFocused(true)}
          onCompositionStart={() => {
            setIsComposing(true);
            setSuggestions([]);
            setActiveIndex(-1);
            setIsLoading(false);
            setMessage("");
          }}
          onCompositionEnd={(event) => {
            changeTitle(event.currentTarget.value);
            setIsComposing(false);
          }}
          onKeyDown={(event) => {
            if (isComposing || event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (
              (event.key === "ArrowDown" || event.key === "ArrowUp") &&
              suggestions.length > 0
            ) {
              event.preventDefault();
              setIsFocused(true);
              setActiveIndex((index) =>
                event.key === "ArrowDown"
                  ? (index + 1) % suggestions.length
                  : index <= 0
                    ? suggestions.length - 1
                    : index - 1,
              );
            } else if (
              event.key === "Enter" &&
              showSuggestions &&
              activeSuggestion
            ) {
              event.preventDefault();
              selectSuggestion(activeSuggestion);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setIsFocused(false);
              setIsLoading(false);
              setActiveIndex(-1);
            }
          }}
          placeholder="例: 進撃"
          required
          role="combobox"
          type="text"
          value={title}
        />
      </label>
      {showSuggestions ? (
        <div
          className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto overscroll-contain rounded-md border border-zinc-200 bg-white shadow-lg"
          id={listboxId}
          ref={listRef}
          role="listbox"
          aria-label="アニメタイトルの候補"
        >
          {suggestions.map((suggestion, index) => (
            <button
              className={`block w-full border-t border-zinc-100 px-4 py-3 text-left transition first:border-t-0 hover:bg-amber-50 hover:text-amber-900 ${activeIndex === index ? "bg-amber-50" : ""}`}
              id={`${listboxId}-${index}`}
              key={suggestion.id}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(suggestion)}
              aria-selected={activeIndex === index}
              role="option"
              tabIndex={-1}
              type="button"
            >
              <span className="block text-sm font-semibold text-zinc-900">
                {suggestion.title}
              </span>
              {suggestion.subtitle ? (
                <span className="mt-1 block text-xs text-zinc-500">
                  {suggestion.subtitle}
                </span>
              ) : null}
              {recordedTitles.some(title => normalizedTitle(title) === normalizedTitle(suggestion.title)) ? <span className="mt-1 block text-xs font-semibold text-teal-700">記録済み</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <p
        className="min-h-4 text-xs text-zinc-500"
        role="status"
        aria-live="polite"
      >
        {isFocused ? (isLoading ? "検索中..." : message) : ""}
      </p>
    </div>
  );
}
