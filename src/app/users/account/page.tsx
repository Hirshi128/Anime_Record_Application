import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";
import { usesCredentialAuth } from "@/lib/auth-mode";
import { PasswordChangeForm } from "./password-form";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ changed?: string | string[] }> }) {
  if (!usesCredentialAuth()) redirect("/users/profile");
  const user = await requireCurrentUser();
  const marker = (await searchParams).changed;
  const changed = typeof marker === "string" && (marker === "1" || /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(marker));
  return <main className="app-page text-zinc-950"><section className="page-shell max-w-xl space-y-8">
    <header className="space-y-6"><Link href="/users/profile" className="button-secondary"><ArrowLeft aria-hidden="true" size={18} />プロフィールへ戻る</Link><h1 className="text-3xl font-semibold">パスワード変更</h1></header>
    {changed ? <p role="status" className="border-l-4 border-teal-600 bg-teal-50 p-4 text-sm text-teal-900">パスワードを変更しました。他の端末からは再ログインが必要です。</p> : null}
    <PasswordChangeForm key={`${user.id}:${changed ? marker : ""}`} />
  </section></main>;
}
