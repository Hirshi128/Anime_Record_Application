import "dotenv/config";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

if (!databaseUrl.startsWith("file:")) {
  throw new Error(`Only SQLite file URLs are supported. Received: ${databaseUrl}`);
}

const rawPath = databaseUrl.slice("file:".length);
const databasePath = path.resolve(process.cwd(), rawPath);
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS "User" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "username" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

CREATE TABLE IF NOT EXISTS "Anime" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "title" TEXT NOT NULL,
  "rating" TEXT NOT NULL,
  "review" TEXT,
  "status" TEXT NOT NULL DEFAULT 'WATCHING',
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "featuredAt" DATETIME,
  "userId" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Anime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Tag" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tag_name_key" ON "Tag"("name");

CREATE TABLE IF NOT EXISTS "AnimeTag" (
  "animeId" INTEGER NOT NULL,
  "tagId" INTEGER NOT NULL,
  CONSTRAINT "AnimeTag_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AnimeTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("animeId", "tagId")
);

CREATE TABLE IF NOT EXISTS "UserFavoriteGenre" (
  "userId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "UserFavoriteGenre_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("userId", "name")
);

CREATE TABLE IF NOT EXISTS "FriendRequest" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "senderId" INTEGER NOT NULL,
  "receiverId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FriendRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FriendRequest_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "FriendRequest_senderId_receiverId_key" ON "FriendRequest"("senderId", "receiverId");
CREATE INDEX IF NOT EXISTS "FriendRequest_receiverId_status_idx" ON "FriendRequest"("receiverId", "status");
CREATE INDEX IF NOT EXISTS "FriendRequest_senderId_status_idx" ON "FriendRequest"("senderId", "status");

CREATE TABLE IF NOT EXISTS "Friendship" (
  "userId" INTEGER NOT NULL,
  "friendId" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Friendship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Friendship_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("userId", "friendId")
);

CREATE INDEX IF NOT EXISTS "Friendship_friendId_idx" ON "Friendship"("friendId");
`);

const animeColumns = db.prepare(`PRAGMA table_info("Anime")`).all();
const hasUserId = animeColumns.some((column) => column.name === "userId");
const hasIsFeatured = animeColumns.some((column) => column.name === "isFeatured");
const hasFeaturedAt = animeColumns.some((column) => column.name === "featuredAt");

if (!hasUserId) {
  db.exec(`ALTER TABLE "Anime" ADD COLUMN "userId" INTEGER`);
}

if (!hasIsFeatured) {
  db.exec(`ALTER TABLE "Anime" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false`);
}

if (!hasFeaturedAt) {
  db.exec(`ALTER TABLE "Anime" ADD COLUMN "featuredAt" DATETIME`);
}

db.exec(`CREATE INDEX IF NOT EXISTS "Anime_userId_idx" ON "Anime"("userId")`);
db.exec(`CREATE INDEX IF NOT EXISTS "Anime_userId_isFeatured_idx" ON "Anime"("userId", "isFeatured")`);

db.close();

console.log(`SQLite database initialized at ${databasePath}`);
