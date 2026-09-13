import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const databasePath = path.resolve(process.cwd(), "prisma/dev.db");
const outputPath = path.resolve(process.cwd(), "prisma/sqlite-export.json");

if (!fs.existsSync(databasePath)) {
  throw new Error(`SQLite database was not found at ${databasePath}`);
}

const db = new Database(databasePath, { readonly: true });

function hasTable(tableName) {
  const table = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
    )
    .get(tableName);

  return Boolean(table);
}

function readTable(tableName, orderBy = "") {
  if (!hasTable(tableName)) {
    return [];
  }

  return db.prepare(`SELECT * FROM "${tableName}" ${orderBy}`).all();
}

const data = {
  exportedAt: new Date().toISOString(),
  users: readTable("User", `ORDER BY "id"`),
  anime: readTable("Anime", `ORDER BY "id"`),
  tags: readTable("Tag", `ORDER BY "id"`),
  animeTags: readTable("AnimeTag", `ORDER BY "animeId", "tagId"`),
  favoriteGenres: readTable("UserFavoriteGenre", `ORDER BY "userId", "name"`),
  friendRequests: readTable("FriendRequest", `ORDER BY "id"`),
  friendships: readTable("Friendship", `ORDER BY "userId", "friendId"`),
};

db.close();

fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);

console.log(`Exported SQLite data to ${outputPath}`);
console.log(
  [
    `${data.users.length} users`,
    `${data.anime.length} anime`,
    `${data.tags.length} tags`,
    `${data.animeTags.length} anime tag links`,
    `${data.favoriteGenres.length} favorite genres`,
    `${data.friendRequests.length} friend requests`,
    `${data.friendships.length} friendships`,
  ].join(", "),
);
