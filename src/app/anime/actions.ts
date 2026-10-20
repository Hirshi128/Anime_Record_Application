"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { parseAnimeForm } from "@/lib/anime-form-data";
import type { FormState } from "@/lib/form-state";
import { lockUsers } from "@/lib/transaction-locks";
import { parseRecordId } from "@/lib/record-id";

function parseAnimeId(id: string) {
  const animeId = parseRecordId(id);

  if (animeId === null) {
    throw new Error("アニメIDが不正です。");
  }

  return animeId;
}

const featuredAnimeLimit = 3;

function revalidateAnimePages(animeId?: number) {
  revalidatePath("/anime");
  revalidatePath("/users/profile");
  revalidatePath("/users/search");
  if (animeId !== undefined) revalidatePath(`/anime/${animeId}`);
}

export async function createAnime(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireCurrentUser();
  const parsed = parseAnimeForm(formData);
  if (parsed.error) return { message: parsed.error };
  const { title, rating, status, review, tagNames } = parsed.data;

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

  revalidateAnimePages();
  redirect(`/anime/${anime.id}`);
}

export async function updateAnime(
  id: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireCurrentUser();
  const animeId = parseAnimeId(id);
  const parsed = parseAnimeForm(formData);
  if (parsed.error) return { message: parsed.error };
  const { title, rating, status, review, tagNames } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const existingAnime = await tx.anime.findFirst({
      where: {
        id: animeId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!existingAnime) {
      return {
        message:
          "編集できるアニメ記録が見つかりません。一覧を確認してください。",
      };
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
    return null;
  });

  if (result) return result;

  revalidateAnimePages(animeId);
  redirect(`/anime/${animeId}`);
}

export async function deleteAnime(id: string): Promise<FormState> {
  const user = await requireCurrentUser();
  const animeId = parseAnimeId(id);

  await prisma.anime.deleteMany({
    where: {
      id: animeId,
      userId: user.id,
    },
  });

  revalidateAnimePages(animeId);
  redirect("/anime");
}

export async function featureAnime(id: string): Promise<FormState> {
  const user = await requireCurrentUser();
  const animeId = parseAnimeId(id);

  const result = await prisma.$transaction(async (tx) => {
    await lockUsers(tx, user.id);
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
      return { message: "今イチ押しにできるアニメ記録が見つかりません。" };
    }

    if (anime.isFeatured) return null;

    if (!anime.isFeatured) {
      const featuredCount = await tx.anime.count({
        where: {
          userId: user.id,
          isFeatured: true,
        },
      });

      if (featuredCount >= featuredAnimeLimit) {
        return {
          message: `今イチ押しは${featuredAnimeLimit}件まで選べます。別の作品を解除してください。`,
        };
      }
    }

    await tx.anime.update({
      where: { id: animeId },
      data: {
        isFeatured: true,
        featuredAt: new Date(),
      },
    });
    return null;
  });

  if (result) return result;

  revalidateAnimePages(animeId);
  redirect(`/anime/${animeId}`);
}

export async function unfeatureAnime(id: string): Promise<FormState> {
  const user = await requireCurrentUser();
  const animeId = parseAnimeId(id);

  const result = await prisma.$transaction(async (tx) => {
    await lockUsers(tx, user.id);
    return tx.anime.updateMany({
      where: {
        id: animeId,
        userId: user.id,
      },
      data: {
        isFeatured: false,
        featuredAt: null,
      },
    });
  });

  if (result.count === 0) {
    return { message: "今イチ押しを解除できるアニメ記録が見つかりません。" };
  }

  revalidateAnimePages(animeId);
  redirect(`/anime/${animeId}`);
}
