"use client";

import Link from "next/link";
import { useState } from "react";
import { Save } from "lucide-react";
import { updateUserProfile } from "../actions";
import { genreOptions, statusLabels } from "@/lib/anime-options";
import { useFormAction } from "@/app/use-form-action";
import type { Rating, WatchStatus } from "@/generated/prisma/enums";

type ProfileFormProps = {
  user: {
    displayName: string;
    username: string;
    favoriteGenres: { name: string }[];
  };
  animeList: {
    id: number;
    title: string;
    rating: Rating;
    status: WatchStatus;
    isFeatured: boolean;
  }[];
  pendingFriendRequestCount: number;
};

export function ProfileForm({
  user,
  animeList,
  pendingFriendRequestCount,
}: ProfileFormProps) {
  const [state, formAction, pending] = useFormAction(updateUserProfile);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [genres, setGenres] = useState(
    user.favoriteGenres.map((genre) => genre.name),
  );
  const [featuredIds, setFeaturedIds] = useState(
    animeList.filter((anime) => anime.isFeatured).map((anime) => anime.id),
  );

  return (
    <form
      action={formAction}
      className="space-y-6"
      aria-busy={pending}
      onReset={(event) => event.preventDefault()}
    >
      <fieldset key={state.revision} disabled={pending} className="min-w-0 space-y-6">
        <section className="surface-panel p-5">
          <h2 className="text-xl font-semibold">基本情報</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-zinc-800">
                表示名
              </span>
              <input
                className="field-control"
                name="displayName"
                maxLength={100}
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="nickname"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-zinc-800">
                ユーザーID
              </span>
              <input
                className="field-control"
                name="username"
                maxLength={64}
                required
                pattern="[A-Za-z0-9_]{3,}"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
          </div>
        </section>
        <section className="surface-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">イチ押しアニメ</h2>
            <span
              className="text-sm font-semibold text-zinc-600"
              role="status"
              aria-live="polite"
            >
              {featuredIds.length} / 3 件
            </span>
            <Link className="button-secondary w-fit" href="/anime/new">
              アニメを追加
            </Link>
          </div>
          {animeList.length === 0 ? (
            <p className="mt-5 text-sm text-zinc-600">
              イチ押しに選べるアニメ記録がありません。
            </p>
          ) : (
            <div className="mt-5 grid gap-3">
              {animeList.map((anime) => {
                const selected = featuredIds.includes(anime.id);
                return (
                  <label className="profile-anime-choice" key={anime.id}>
                    <input
                      className="size-4 shrink-0 accent-amber-700"
                      name="featuredAnimeIds"
                      type="checkbox"
                      value={anime.id}
                      checked={selected}
                      disabled={!selected && featuredIds.length >= 3}
                      onChange={(event) =>
                        setFeaturedIds((ids) =>
                          event.target.checked
                            ? [...ids, anime.id]
                            : ids.filter((id) => id !== anime.id),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{anime.title}</span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        評価 {anime.rating} / {statusLabels[anime.status]}
                      </span>
                    </span>
                    {selected ? (
                      <span className="featured-chip shrink-0">選択中</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          )}
        </section>
        <section className="surface-panel p-5">
          <fieldset>
            <legend className="text-xl font-semibold">好きなジャンル</legend>
            <div className="mt-5 grid gap-2 min-[360px]:grid-cols-2 lg:grid-cols-4">
              {genreOptions.map((genre) => (
                <label className="choice-tile" key={genre}>
                  <input
                    className="size-4 shrink-0 accent-amber-700"
                    name="favoriteGenres"
                    type="checkbox"
                    value={genre}
                    checked={genres.includes(genre)}
                    onChange={(event) =>
                      setGenres((values) =>
                        event.target.checked
                          ? [...values, genre]
                          : values.filter((value) => value !== genre),
                      )
                    }
                  />
                  <span>{genre}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>
      </fieldset>
      {state.message ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="form-actions">
        <button className="button-primary button-large" type="submit" disabled={pending}>
          <Save aria-hidden="true" size={20} />
          {pending ? "保存中..." : "プロフィールを保存"}
        </button>
        <Link
          className="button-secondary button-with-notification"
          href="/users/search"
        >
          フレンド検索へ
          {pendingFriendRequestCount > 0 ? (
            <>
              <span aria-hidden="true" className="friend-alert-mark">
                !
              </span>
              <span className="sr-only">
                未対応のフレンド申請 {pendingFriendRequestCount} 件
              </span>
            </>
          ) : null}
        </Link>
        <Link className="button-secondary" href="/anime">
          アニメ一覧へ
        </Link>
      </div>
    </form>
  );
}
