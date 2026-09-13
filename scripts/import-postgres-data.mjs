import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

const inputPath = path.resolve(process.cwd(), "prisma/sqlite-export.json");
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to import data into Postgres.");
}

if (!fs.existsSync(inputPath)) {
  throw new Error(`Export file was not found at ${inputPath}`);
}

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const sql = neon(connectionString);

function timestamp(value) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function bool(value) {
  return value === true || value === 1 || value === "1";
}

for (const user of data.users ?? []) {
  await sql`
    INSERT INTO "User" ("id", "username", "displayName", "createdAt", "updatedAt")
    VALUES (${user.id}, ${user.username}, ${user.displayName}, ${timestamp(user.createdAt)}, ${timestamp(user.updatedAt)})
    ON CONFLICT ("id") DO UPDATE SET
      "username" = EXCLUDED."username",
      "displayName" = EXCLUDED."displayName",
      "createdAt" = EXCLUDED."createdAt",
      "updatedAt" = EXCLUDED."updatedAt"
  `;
}

for (const tag of data.tags ?? []) {
  await sql`
    INSERT INTO "Tag" ("id", "name")
    VALUES (${tag.id}, ${tag.name})
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED."name"
  `;
}

for (const anime of data.anime ?? []) {
  await sql`
    INSERT INTO "Anime" (
      "id",
      "title",
      "rating",
      "review",
      "status",
      "isFeatured",
      "featuredAt",
      "userId",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${anime.id},
      ${anime.title},
      ${anime.rating},
      ${anime.review ?? null},
      ${anime.status},
      ${bool(anime.isFeatured)},
      ${timestamp(anime.featuredAt)},
      ${anime.userId ?? null},
      ${timestamp(anime.createdAt)},
      ${timestamp(anime.updatedAt)}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "title" = EXCLUDED."title",
      "rating" = EXCLUDED."rating",
      "review" = EXCLUDED."review",
      "status" = EXCLUDED."status",
      "isFeatured" = EXCLUDED."isFeatured",
      "featuredAt" = EXCLUDED."featuredAt",
      "userId" = EXCLUDED."userId",
      "createdAt" = EXCLUDED."createdAt",
      "updatedAt" = EXCLUDED."updatedAt"
  `;
}

for (const favoriteGenre of data.favoriteGenres ?? []) {
  await sql`
    INSERT INTO "UserFavoriteGenre" ("userId", "name")
    VALUES (${favoriteGenre.userId}, ${favoriteGenre.name})
    ON CONFLICT ("userId", "name") DO NOTHING
  `;
}

for (const request of data.friendRequests ?? []) {
  await sql`
    INSERT INTO "FriendRequest" (
      "id",
      "senderId",
      "receiverId",
      "status",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${request.id},
      ${request.senderId},
      ${request.receiverId},
      ${request.status},
      ${timestamp(request.createdAt)},
      ${timestamp(request.updatedAt)}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "senderId" = EXCLUDED."senderId",
      "receiverId" = EXCLUDED."receiverId",
      "status" = EXCLUDED."status",
      "createdAt" = EXCLUDED."createdAt",
      "updatedAt" = EXCLUDED."updatedAt"
  `;
}

for (const friendship of data.friendships ?? []) {
  await sql`
    INSERT INTO "Friendship" ("userId", "friendId", "createdAt")
    VALUES (${friendship.userId}, ${friendship.friendId}, ${timestamp(friendship.createdAt)})
    ON CONFLICT ("userId", "friendId") DO UPDATE SET
      "createdAt" = EXCLUDED."createdAt"
  `;
}

for (const animeTag of data.animeTags ?? []) {
  await sql`
    INSERT INTO "AnimeTag" ("animeId", "tagId")
    VALUES (${animeTag.animeId}, ${animeTag.tagId})
    ON CONFLICT ("animeId", "tagId") DO NOTHING
  `;
}

await sql`
  SELECT setval(pg_get_serial_sequence('"User"', 'id'), COALESCE((SELECT MAX("id") FROM "User"), 1), (SELECT MAX("id") IS NOT NULL FROM "User"))
`;
await sql`
  SELECT setval(pg_get_serial_sequence('"Anime"', 'id'), COALESCE((SELECT MAX("id") FROM "Anime"), 1), (SELECT MAX("id") IS NOT NULL FROM "Anime"))
`;
await sql`
  SELECT setval(pg_get_serial_sequence('"Tag"', 'id'), COALESCE((SELECT MAX("id") FROM "Tag"), 1), (SELECT MAX("id") IS NOT NULL FROM "Tag"))
`;
await sql`
  SELECT setval(pg_get_serial_sequence('"FriendRequest"', 'id'), COALESCE((SELECT MAX("id") FROM "FriendRequest"), 1), (SELECT MAX("id") IS NOT NULL FROM "FriendRequest"))
`;

console.log(`Imported data from ${inputPath} into Postgres.`);
