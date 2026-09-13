"use client";

import { useEffect, useId, useRef, useState } from "react";

type TitleSuggestion = {
  id: number;
  title: string;
  subtitle: string;
};

type TitleAutocompleteProps = {
  initialTitle?: string;
};

export function TitleAutocomplete({
  initialTitle = "",
}: TitleAutocompleteProps) {
  const listboxId = useId();
  const [title, setTitle] = useState(initialTitle);
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const search = title.trim();

    if (search.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setMessage("");

      try {
        const response = await fetch(
          `/api/anime-title-suggestions?query=${encodeURIComponent(search)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch suggestions");
        }

        const payload = (await response.json()) as {
          suggestions?: TitleSuggestion[];
        };
        setSuggestions(payload.suggestions ?? []);
        setMessage(
          payload.suggestions?.length === 0
            ? "一致する候補が見つかりませんでした。"
            : "",
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSuggestions([]);
          setMessage("候補を取得できませんでした。");
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [title]);

  const showSuggestions = isFocused && (suggestions.length > 0 || isLoading);

  function handleTitleChange(value: string) {
    setTitle(value);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setMessage("");
      setIsLoading(false);
    }
  }

  return (
    <div className="relative space-y-2">
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-zinc-800">タイトル</span>
        <input
          aria-autocomplete="list"
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-expanded={showSuggestions}
          autoComplete="off"
          className="field-control text-base placeholder:text-zinc-400"
          name="title"
          onBlur={() => {
            blurTimer.current = setTimeout(() => setIsFocused(false), 120);
          }}
          onChange={(event) => handleTitleChange(event.target.value)}
          onFocus={() => {
            if (blurTimer.current) {
              clearTimeout(blurTimer.current);
            }
            setIsFocused(true);
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
          role="listbox"
        >
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-zinc-500">検索中...</div>
          ) : null}
          {suggestions.map((suggestion) => (
            <button
              className="block w-full border-t border-zinc-100 px-4 py-3 text-left transition first:border-t-0 hover:bg-amber-50 hover:text-amber-900"
              key={suggestion.id}
              onClick={() => {
                setTitle(suggestion.title);
                setSuggestions([]);
                setIsFocused(false);
              }}
              aria-selected={title === suggestion.title}
              role="option"
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
            </button>
          ))}
        </div>
      ) : null}

      {message ? <p className="text-xs text-zinc-500">{message}</p> : null}
    </div>
  );
}
