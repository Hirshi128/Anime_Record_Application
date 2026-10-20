import { getFormString } from "./anime-form-data";
import { isGenre } from "./anime-options";
import { parseRecordId } from "./record-id";

export function parseUserBasics(formData: FormData) {
  const displayName = getFormString(formData, "displayName");
  const username = getFormString(formData, "username").toLowerCase();
  if (!displayName) return { error: "表示名は必須です。" } as const;
  if (displayName.length > 100)
    return { error: "表示名は100文字以内で入力してください。" } as const;
  if (username.length > 64)
    return { error: "ユーザーIDは3〜64文字で入力してください。" } as const;
  if (!/^[a-z0-9_]{3,}$/.test(username)) {
    return {
      error: "ユーザーIDは3文字以上の英数字と_で入力してください。",
    } as const;
  }
  return { data: { displayName, username } } as const;
}

export function parseProfileChoices(formData: FormData) {
  const rawIds = formData.getAll("featuredAnimeIds");
  if (rawIds.some((id) => parseRecordId(id) === null)) {
    return { error: "イチ押しアニメの選択が不正です。" } as const;
  }
  const featuredAnimeIds = Array.from(new Set(rawIds.map(Number)));
  if (featuredAnimeIds.length > 3)
    return { error: "イチ押しアニメは3件まで選べます。" } as const;
  const favoriteGenres = Array.from(
    new Set(
      formData
        .getAll("favoriteGenres")
        .map((genre) => (typeof genre === "string" ? genre.trim() : ""))
        .filter(isGenre),
    ),
  );
  return { data: { featuredAnimeIds, favoriteGenres } } as const;
}

export function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
