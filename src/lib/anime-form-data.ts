import { isGenre, isRating, isWatchStatus } from "./anime-options";

export function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function parseAnimeForm(formData: FormData) {
  const title = getFormString(formData, "title");
  const rating = getFormString(formData, "rating");
  const status = getFormString(formData, "status");
  const review = getFormString(formData, "review");

  if (!title) return { error: "タイトルは必須です。" } as const;
  if (!isRating(rating)) return { error: "評価の値が不正です。" } as const;
  if (!isWatchStatus(status))
    return { error: "視聴状況の値が不正です。" } as const;

  const tagNames = Array.from(
    new Set(
      formData
        .getAll("tags")
        .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
        .filter(isGenre),
    ),
  );

  return {
    data: { title, rating, status, review: review || null, tagNames },
  } as const;
}
