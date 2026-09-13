CREATE TYPE "Rating" AS ENUM ('SS', 'S', 'A', 'B', 'C', 'D');

CREATE TYPE "WatchStatus" AS ENUM (
  'WATCHING',
  'COMPLETED',
  'PAUSED',
  'DROPPED',
  'PLAN_TO_WATCH'
);

CREATE TYPE "FriendRequestStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'REJECTED'
);

CREATE TABLE "User" (
  "id" SERIAL NOT NULL,
  "username" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Anime" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "rating" "Rating" NOT NULL,
  "review" TEXT,
  "status" "WatchStatus" NOT NULL DEFAULT 'WATCHING',
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "featuredAt" TIMESTAMP(3),
  "userId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Anime_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tag" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,

  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnimeTag" (
  "animeId" INTEGER NOT NULL,
  "tagId" INTEGER NOT NULL,

  CONSTRAINT "AnimeTag_pkey" PRIMARY KEY ("animeId", "tagId")
);

CREATE TABLE "UserFavoriteGenre" (
  "userId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,

  CONSTRAINT "UserFavoriteGenre_pkey" PRIMARY KEY ("userId", "name")
);

CREATE TABLE "FriendRequest" (
  "id" SERIAL NOT NULL,
  "senderId" INTEGER NOT NULL,
  "receiverId" INTEGER NOT NULL,
  "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Friendship" (
  "userId" INTEGER NOT NULL,
  "friendId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Friendship_pkey" PRIMARY KEY ("userId", "friendId")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "Anime_userId_idx" ON "Anime"("userId");
CREATE INDEX "Anime_userId_isFeatured_idx" ON "Anime"("userId", "isFeatured");
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
CREATE UNIQUE INDEX "FriendRequest_senderId_receiverId_key" ON "FriendRequest"("senderId", "receiverId");
CREATE INDEX "FriendRequest_receiverId_status_idx" ON "FriendRequest"("receiverId", "status");
CREATE INDEX "FriendRequest_senderId_status_idx" ON "FriendRequest"("senderId", "status");
CREATE INDEX "Friendship_friendId_idx" ON "Friendship"("friendId");

ALTER TABLE "Anime" ADD CONSTRAINT "Anime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimeTag" ADD CONSTRAINT "AnimeTag_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimeTag" ADD CONSTRAINT "AnimeTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFavoriteGenre" ADD CONSTRAINT "UserFavoriteGenre_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
