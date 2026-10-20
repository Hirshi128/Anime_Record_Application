import { requireCurrentUser } from "./current-user";
import { prisma } from "./prisma";
import { ratingOptions } from "./anime-options";

type AggregateRow = { kind: "rating" | "genre"; name: string; total: number; high: number };

export function summarizeAnimeInsights(rows: AggregateRow[]) {
  const ratings = ratingOptions.map((rating) => ({ rating, count: rows.find((row) => row.kind === "rating" && row.name === rating)?.total ?? 0 }));
  const completedCount = ratings.reduce((total, row) => total + row.count, 0);
  const highRatedCount = ratings.filter((row) => row.rating === "SS" || row.rating === "S").reduce((total, row) => total + row.count, 0);
  const genres = rows.filter((row) => row.kind === "genre").map((row) => ({
    name: row.name, count: row.total, highCount: row.high,
    highPercentage: row.total ? Math.round(row.high / row.total * 100) : 0,
  })).sort((a, b) => b.highCount - a.highCount || b.count - a.count || a.name.localeCompare(b.name, "ja"));
  return { completedCount, highRatedCount, ratings, genres };
}

export async function getCurrentUserInsights() {
  const owner = await requireCurrentUser();
  // One snapshot, aggregate-only: private reviews and other owners never leave the DB.
  const rows = await prisma.$queryRaw<AggregateRow[]>`
    WITH completed AS (
      SELECT "id", "rating" FROM "Anime"
      WHERE "userId" = ${owner.id} AND "status" = 'COMPLETED'
    )
    SELECT 'rating' AS kind, "rating"::text AS name, COUNT(*)::int AS total,
      (COUNT(*) FILTER (WHERE "rating" IN ('SS', 'S')))::int AS high
    FROM completed GROUP BY "rating"
    UNION ALL
    SELECT 'genre' AS kind, t."name", COUNT(*)::int AS total,
      (COUNT(*) FILTER (WHERE c."rating" IN ('SS', 'S')))::int AS high
    FROM completed c
    JOIN "AnimeTag" at ON at."animeId" = c."id"
    JOIN "Tag" t ON t."id" = at."tagId"
    GROUP BY t."name"
  `;
  return { ownerName: owner.displayName, ...summarizeAnimeInsights(rows) };
}
