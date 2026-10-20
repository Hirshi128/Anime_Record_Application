"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseCredentials } from "@/lib/auth-input";
import { parseUserBasics, isUniqueConstraintError } from "@/lib/user-form-data";
import { hashPassword, verifyPassword } from "@/lib/password";
import { allowAuthAttempt, newSession, setSessionCookie } from "@/lib/auth-session";
import { usesCredentialAuth } from "@/lib/auth-mode";
import type { FormState } from "@/lib/form-state";
import { lockUsers } from "@/lib/transaction-locks";

const unavailable = "ログインサービスを利用できません。しばらくしてからお試しください。";
const throttled = "試行回数が多いため、15分ほど待ってからお試しください。";

export async function signIn(_state: FormState, form: FormData): Promise<FormState> {
  if (!usesCredentialAuth()) return { message: unavailable };
  const parsed = parseCredentials(form);
  if (parsed.error) return { message: parsed.error };
  const { email, password } = parsed.data;
  try {
    if (!(await allowAuthAttempt(email, "login", 8))) return { message: throttled };
    const credential = await prisma.userCredential.findUnique({ where: { email } });
    if (!credential) {
      await verifyPassword(password, null);
      return { message: "メールアドレスまたはパスワードが違います。" };
    }
    const token = await prisma.$transaction(async (tx) => {
      await lockUsers(tx, credential.userId);
      const current = await tx.userCredential.findUnique({ where: { userId: credential.userId } });
      const valid = await verifyPassword(password, current?.passwordHash ?? null);
      if (!current || current.email !== email || !valid) return null;
      const session = newSession(current.userId);
      await tx.authSession.create({ data: session.data });
      return session.token;
    });
    if (!token) return { message: "メールアドレスまたはパスワードが違います。" };
    await setSessionCookie(token);
  } catch {
    return { message: unavailable };
  }
  revalidatePath("/", "layout");
  redirect("/anime");
}

export async function signUp(_state: FormState, form: FormData): Promise<FormState> {
  if (!usesCredentialAuth()) return { message: unavailable };
  const basics = parseUserBasics(form);
  if (basics.error) return { message: basics.error };
  if (basics.data.displayName.length > 100) return { message: "表示名は100文字以内で入力してください。" };
  if (basics.data.username.length > 64) return { message: "ユーザーIDは3〜64文字で入力してください。" };
  const parsed = parseCredentials(form, true);
  if (parsed.error) return { message: parsed.error };
  const { email, password } = parsed.data;
  try {
    if (!(await allowAuthAttempt(email, "signup", 5))) return { message: throttled };
    const passwordHash = await hashPassword(password);
    const token = await prisma.$transaction(async (tx) => {
      // Never attach credentials to an existing username or claim old records.
      const user = await tx.user.create({ data: { ...basics.data, credential: { create: { email, passwordHash } } }, select: { id: true } });
      const session = newSession(user.id);
      await tx.authSession.create({ data: session.data });
      return session.token;
    });
    await setSessionCookie(token);
  } catch (error) {
    return { message: isUniqueConstraintError(error) ? "この情報では登録できません。ログインするか、別の登録情報をお試しください。" : unavailable };
  }
  revalidatePath("/", "layout");
  redirect("/anime");
}
