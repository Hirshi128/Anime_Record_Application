"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { isGenre, isRating, isWatchStatus } from "@/lib/anime-options";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseTagNames(formData: FormData) {
  const seen = new Set<string>();

  return formData
    .getAll("tags")
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter((tag) => {
      if (!isGenre(tag)) {
        return false;
      }

      const key = tag.toLocaleLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function parseAnimeForm(formData: FormData) {
  const title = getString(formData, "title");
  const rating = getString(formData, "rating");
  const status = getString(formData, "status");
  const review = getString(formData, "review");

  if (!title) {
    throw new Error("タイトルは必須です。");
  }

  if (!isRating(rating)) {
    throw new Error("評価の値が不正です。");
  }

  if (!isWatchStatus(status)) {
    throw new Error("視聴状況の値が不正です。");
  }

  return {
    title,
    rating,
    status,
    review: review || null,
    tagNames: parseTagNames(formData),
  };
}

function parseAnimeId(id: string) {
  const animeId = Number(id);

  if (!Number.isInteger(animeId) || animeId <= 0) {
    throw new Error("アニメIDが不正です。");
  }

  return animeId;
}

const featuredAnimeLimit = 3;

export async function createAnime(formData: FormData) {
  const user = await requireCurrentUser();
  const { title, rating, status, review, tagNames } = parseAnimeForm(formData);

  const anime = await prisma.anime.create({
    data: {
      title,
      rating,
      status,
      review,
      userId: user.id,
      tags: {
        create: tagNames.map((name) => ({
          tag: {
            connectOrCreate: {
              where: { name },
              create: { name },
            },
          },
        })),
      },
    },
    select: {
      id: true,
    },
  });

  revalidatePath("/anime");
  redirect(`/anime/${anime.id}`);
}

export async function updateAnime(id: string, formData: FormData) {
  const user = await requireCurrentUser();
  const animeId = parseAnimeId(id);
  const { title, rating, status, review, tagNames } = parseAnimeForm(formData);

  await prisma.$transaction(async (tx) => {
    const existingAnime = await tx.anime.findFirst({
      where: {
        id: animeId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!existingAnime) {
      throw new Error("編集できるアニメ記録が見つかりません。");
    }

    await tx.animeTag.deleteMany({
      where: { animeId },
    });

    await tx.anime.update({
      where: { id: animeId },
      data: {
        title,
        rating,
        status,
        review,
        tags: {
          create: tagNames.map((name) => ({
            tag: {
              connectOrCreate: {
                where: { name },
                create: { name },
              },
            },
          })),
        },
      },
    });
  });

  revalidatePath("/anime");
  revalidatePath(`/anime/${animeId}`);
  redirect(`/anime/${animeId}`);
}

export async function deleteAnime(id: string) {
  const user = await requireCurrentUser();
  const animeId = parseAnimeId(id);

  await prisma.anime.deleteMany({
    where: {
      id: animeId,
      userId: user.id,
    },
  });

  revalidatePath("/anime");
  redirect("/anime");
}

export async function featureAnime(id: string) {
  const user = await requireCurrentUser();
  const animeId = parseAnimeId(id);

  await prisma.$transaction(async (tx) => {
    const anime = await tx.anime.findFirst({
      where: {
        id: animeId,
        userId: user.id,
      },
      select: {
        id: true,
        isFeatured: true,
      },
    });

    if (!anime) {
      throw new Error("今イチ押しにできるアニメ記録が見つかりません。");
    }

    if (!anime.isFeatured) {
      const featuredCount = await tx.anime.count({
        where: {
          userId: user.id,
          isFeatured: true,
        },
      });

      if (featuredCount >= featuredAnimeLimit) {
        throw new Error(`今イチ押しは${featuredAnimeLimit}件まで選べます。`);
      }
    }

    await tx.anime.update({
      where: { id: animeId },
      data: {
        isFeatured: true,
        featuredAt: new Date(),
      },
    });
  });

  revalidatePath("/anime");
  revalidatePath(`/anime/${animeId}`);
  redirect(`/anime/${animeId}`);
}

export async function unfeatureAnime(id: string) {
  const user = await requireCurrentUser();
  const animeId = parseAnimeId(id);

  const result = await prisma.anime.updateMany({
    where: {
      id: animeId,
      userId: user.id,
    },
    data: {
      isFeatured: false,
      featuredAt: null,
    },
  });

  if (result.count === 0) {
    throw new Error("今イチ押しを解除できるアニメ記録が見つかりません。");
  }

  revalidatePath("/anime");
  revalidatePath(`/anime/${animeId}`);
  redirect(`/anime/${animeId}`);
}
