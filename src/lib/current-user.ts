import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const currentUserCookieName = "anime_record_user_id";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const rawUserId = cookieStore.get(currentUserCookieName)?.value;
  const userId = Number(rawUserId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/users");
  }

  return user;
}
