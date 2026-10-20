"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { usesCredentialAuth } from "@/lib/auth-mode";
import { requireCurrentUser } from "@/lib/current-user";
import { parsePasswordChange } from "@/lib/auth-input";
import { allowAuthAttempt, newSession, setSessionCookie } from "@/lib/auth-session";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/transaction-locks";
import type { FormState } from "@/lib/form-state";

export async function changePassword(_state: FormState, form: FormData): Promise<FormState> {
  if (!usesCredentialAuth()) return { message: "パスワード認証が有効ではありません。" };
  const user = await requireCurrentUser();
  const parsed = parsePasswordChange(form);
  if (parsed.error) return { message: parsed.error };
  try {
    if (!(await allowAuthAttempt(String(user.id), "password", 5))) return { message: "試行回数が多いため、15分ほど待ってからお試しください。" };
    const result = await prisma.$transaction(async (tx) => {
      await lockUsers(tx, user.id);
      const credential = await tx.userCredential.findUnique({ where: { userId: user.id } });
      // Re-read under the owner lock so concurrent changes cannot use an old hash.
      const valid = await verifyPassword(parsed.data.currentPassword, credential?.passwordHash ?? null);
      if (!credential || !valid) return { error: "現在のパスワードが違います。" } as const;
      const passwordHash = await hashPassword(parsed.data.password);
      await tx.userCredential.update({ where: { userId: user.id }, data: { passwordHash } });
      await tx.authSession.deleteMany({ where: { userId: user.id } });
      const session = newSession(user.id);
      await tx.authSession.create({ data: session.data });
      return { token: session.token } as const;
    });
    if (result.error) return { message: result.error };
    await setSessionCookie(result.token);
  } catch {
    return { message: "パスワードを変更できませんでした。再度ログインして確認してください。" };
  }
  revalidatePath("/", "layout");
  // A public completion marker resets the form, never a session token or password.
  redirect(`/users/account?changed=${randomUUID()}`);
}
