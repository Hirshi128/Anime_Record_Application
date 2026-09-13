CREATE TABLE "UserFavoriteGenre" (
  "userId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "UserFavoriteGenre_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("userId", "name")
);
