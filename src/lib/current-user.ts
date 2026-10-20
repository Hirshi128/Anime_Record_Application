import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { parseRecordId } from "@/lib/record-id";
import { usesCredentialAuth } from "@/lib/auth-mode";
import { getSessionUser } from "@/lib/auth-session";

export const currentUserCookieName = "anime_record_user_id";

export async function getCurrentUser() {
  if (usesCredentialAuth()) return getSessionUser();
  const cookieStore = await cookies();
  const rawUserId = cookieStore.get(currentUserCookieName)?.value;
  const userId = parseRecordId(rawUserId);

  if (userId === null) {
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
