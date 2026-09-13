import { Rating, WatchStatus } from "@/generated/prisma/enums";

export const ratingOptions = [
  Rating.SS,
  Rating.S,
  Rating.A,
  Rating.B,
  Rating.C,
  Rating.D,
] as const;

export const statusOptions = [
  WatchStatus.WATCHING,
  WatchStatus.COMPLETED,
  WatchStatus.PAUSED,
  WatchStatus.DROPPED,
  WatchStatus.PLAN_TO_WATCH,
] as const;

export const statusLabels: Record<WatchStatus, string> = {
  [WatchStatus.WATCHING]: "視聴中",
  [WatchStatus.COMPLETED]: "視聴済み",
  [WatchStatus.PAUSED]: "一時停止",
  [WatchStatus.DROPPED]: "中断",
  [WatchStatus.PLAN_TO_WATCH]: "見る予定",
};

export const genreOptions = [
  "アクション",
  "冒険",
  "ファンタジー",
  "SF",
  "ロボット",
  "日常",
  "コメディ",
  "恋愛",
  "青春",
  "ドラマ",
  "ミステリー",
  "サスペンス",
  "ホラー",
  "スポーツ",
  "音楽",
  "アイドル",
  "魔法少女",
  "異世界",
  "歴史",
  "グルメ",
] as const;

export function isGenre(value: unknown): value is (typeof genreOptions)[number] {
  return (
    typeof value === "string" &&
    genreOptions.includes(value as (typeof genreOptions)[number])
  );
}

export function isRating(value: unknown): value is Rating {
  return typeof value === "string" && ratingOptions.includes(value as Rating);
}

export function isWatchStatus(value: unknown): value is WatchStatus {
  return (
    typeof value === "string" && statusOptions.includes(value as WatchStatus)
  );
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
