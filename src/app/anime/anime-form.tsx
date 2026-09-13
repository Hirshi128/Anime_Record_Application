import type { Rating, WatchStatus } from "@/generated/prisma/enums";
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
  action: (formData: FormData) => Promise<void>;
  anime?: AnimeFormValue;
  submitLabel: string;
};

export function AnimeForm({ action, anime, submitLabel }: AnimeFormProps) {
  const selectedTags = new Set(anime?.tags ?? []);

  return (
    <form
      action={action}
      className="surface-panel space-y-6 p-6"
    >
      <TitleAutocomplete initialTitle={anime?.title ?? ""} />

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-zinc-800">評価</span>
          <select
            className="field-control"
            defaultValue={anime?.rating ?? "A"}
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
          <span className="text-sm font-semibold text-zinc-800">視聴状況</span>
          <select
            className="field-control"
            defaultValue={anime?.status ?? "WATCHING"}
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
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {genreOptions.map((genre) => (
            <label
              className="choice-tile"
              key={genre}
            >
              <input
                className="size-4 accent-amber-700"
                defaultChecked={selectedTags.has(genre)}
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
          defaultValue={anime?.review ?? ""}
          name="review"
          placeholder="印象に残った場面、好きだった要素、次に見たい作品のヒントなど"
        />
      </label>

      <button
        className="button-primary"
        type="submit"
      >
        {submitLabel}
      </button>
    </form>
  );
}
