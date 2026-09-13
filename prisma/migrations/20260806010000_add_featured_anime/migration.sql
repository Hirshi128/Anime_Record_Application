ALTER TABLE "Anime" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Anime" ADD COLUMN "featuredAt" DATETIME;

CREATE INDEX "Anime_userId_isFeatured_idx" ON "Anime"("userId", "isFeatured");
