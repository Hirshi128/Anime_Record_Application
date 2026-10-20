"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import type { Rating, WatchStatus } from "@/generated/prisma/enums";
import type { FormAction } from "@/lib/form-state";
import { useFormAction } from "@/app/use-form-action";
import {
  genreOptions,
  ratingOptions,
  statusLabels,
  statusOptions,
} from "@/lib/anime-options";
import { TitleAutocomplete } from "./title-autocomplete";

type AnimeFormValue = {
  title?: string;
  rating?: Rating;
  status?: WatchStatus;
  review?: string | null;
  tags?: string[];
};

type AnimeFormProps = {
  action: FormAction;
  anime?: AnimeFormValue;
  submitLabel: string;
};

export function AnimeForm({ action, anime, submitLabel }: AnimeFormProps) {
  const [state, formAction, pending] = useFormAction(action);
  const [title, setTitle] = useState(anime?.title ?? "");
  const [rating, setRating] = useState<Rating>(anime?.rating ?? "A");
  const [status, setStatus] = useState<WatchStatus>(
    anime?.status ?? "WATCHING",
  );
  const [review, setReview] = useState(anime?.review ?? "");
  const [selectedTags, setSelectedTags] = useState(anime?.tags ?? []);

  return (
    <form
      action={formAction}
      className="surface-panel space-y-6 p-6"
      aria-busy={pending}
      onReset={(event) => event.preventDefault()}
    >
      <fieldset key={state.revision} disabled={pending} className="min-w-0 space-y-6">
        <TitleAutocomplete
          initialTitle={anime?.title ?? ""}
          value={title}
          onChange={setTitle}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-zinc-800">評価</span>
            <select
              className="field-control"
              value={rating}
              onChange={(event) => setRating(event.target.value as Rating)}
              name="rating"
            >
              {ratingOptions.map((rating) => (
                <option key={rating} value={rating}>
                  {rating}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-zinc-800">
              視聴状況
            </span>
            <select
              className="field-control"
              value={status}
              onChange={(event) => setStatus(event.target.value as WatchStatus)}
              name="status"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-zinc-800">
            ジャンル
          </legend>
          <div className="grid gap-2 min-[360px]:grid-cols-2 lg:grid-cols-3">
            {genreOptions.map((genre) => (
              <label className="choice-tile" key={genre}>
                <input
                  className="size-4 shrink-0 accent-amber-700"
                  checked={selectedTags.includes(genre)}
                  onChange={(event) =>
                    setSelectedTags((tags) =>
                      event.target.checked
                        ? [...tags, genre]
                        : tags.filter((tag) => tag !== genre),
                    )
                  }
                  name="tags"
                  type="checkbox"
                  value={genre}
                />
                <span>{genre}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-zinc-800">感想</span>
          <textarea
            className="field-control min-h-40 leading-7 placeholder:text-zinc-400"
            value={review}
            onChange={(event) => setReview(event.target.value)}
            name="review"
            placeholder="印象に残った場面、好きだった要素、次に見たい作品のヒントなど"
          />
        </label>
      </fieldset>

      {state.message ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="form-actions">
        <button className="button-primary button-large" type="submit" disabled={pending}>
          <Save aria-hidden="true" size={20} />
          {pending ? "保存中..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
