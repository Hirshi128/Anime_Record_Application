import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to check Postgres data.");
}

const sql = neon(connectionString);
const tables = [
  "User",
  "Anime",
  "Tag",
  "AnimeTag",
  "UserFavoriteGenre",
  "FriendRequest",
  "Friendship",
];
const counts = {};

for (const table of tables) {
  const rows = await sql.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
  counts[table] = rows[0].count;
}

console.log(JSON.stringify(counts, null, 2));
