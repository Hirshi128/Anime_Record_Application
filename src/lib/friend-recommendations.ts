import { requireCurrentUser } from "./current-user";
import { prisma } from "./prisma";
import type { Rating } from "@/generated/prisma/enums";

export type FriendRecommendation = {
  id: number;
  title: string;
  rating: Rating;
  friendName: string;
  username: string;
  genres: string[];
};

export async function getCurrentUserFriendRecommendations() {
  const owner = await requireCurrentUser();
  // Match only public featured picks; return neither reviews nor other private records.
  return prisma.$queryRaw<FriendRecommendation[]>`
    WITH mine AS (
      SELECT "id", "rating", "status",
        LOWER(BTRIM(REGEXP_REPLACE(NORMALIZE("title", NFKC), '[[:space:]]+', ' ', 'g'))) AS title_key
      FROM "Anime" WHERE "userId" = ${owner.id}
    ), liked_genres AS (
      SELECT DISTINCT at."tagId" FROM "AnimeTag" at
      JOIN mine m ON m."id" = at."animeId"
      WHERE m."status" = 'COMPLETED' AND m."rating" IN ('SS', 'S')
    ), matches AS (
      SELECT a."id", a."title", a."rating", a."featuredAt",
        u."displayName" AS "friendName", u."username",
        ARRAY_AGG(DISTINCT t."name" ORDER BY t."name") AS genres,
        COUNT(DISTINCT t."id")::int AS match_count,
        LOWER(BTRIM(REGEXP_REPLACE(NORMALIZE(a."title", NFKC), '[[:space:]]+', ' ', 'g'))) AS title_key
      FROM "Anime" a
      JOIN "Friendship" f ON f."friendId" = a."userId" AND f."userId" = ${owner.id}
      JOIN "User" u ON u."id" = a."userId"
      JOIN "AnimeTag" at ON at."animeId" = a."id"
      JOIN liked_genres lg ON lg."tagId" = at."tagId"
      JOIN "Tag" t ON t."id" = at."tagId"
      WHERE a."isFeatured" = true AND a."userId" <> ${owner.id}
        AND NOT EXISTS (
          SELECT 1 FROM mine m WHERE m.title_key =
            LOWER(BTRIM(REGEXP_REPLACE(NORMALIZE(a."title", NFKC), '[[:space:]]+', ' ', 'g')))
        )
      GROUP BY a."id", u."id"
    ), ranked AS (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY title_key
        ORDER BY match_count DESC, "rating" ASC, "featuredAt" DESC NULLS LAST, "id" DESC
      ) AS choice FROM matches
    )
    SELECT "id", "title", "rating", "friendName", "username", genres
    FROM ranked WHERE choice = 1 AND title_key <> ''
    ORDER BY match_count DESC, "rating" ASC, "featuredAt" DESC NULLS LAST, "id" DESC
    LIMIT 6
  `;
}
