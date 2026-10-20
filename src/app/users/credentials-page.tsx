import Link from "next/link";
import { ArrowLeft, ArrowRight, KeyRound, UserRound } from "lucide-react";
import { CredentialsForm } from "./credentials-form";
import { logoutUser } from "./actions";
import { ActionButtonForm } from "@/app/action-button-form";

export function CredentialsPage({ user, logoutWarning = false }: { user: { displayName: string } | null; logoutWarning?: boolean }) {
  return <main className="app-page text-zinc-950">
    <section className="page-shell space-y-8">
      <header className="record-hero">
        <div className="record-hero-content space-y-6">
          <Link className="button-secondary" href="/"><ArrowLeft aria-hidden="true" size={18} />ホームへ戻る</Link>
          <h1 className="text-3xl font-semibold">{user ? "アカウント" : "ログイン・新規登録"}</h1>
        </div>
      </header>
      {logoutWarning ? <p role="alert" className="form-error">この端末からログアウトしました。サーバー上のセッション失効を確認できませんでした。</p> : null}
      {user ? <div className="space-y-6">
        <p className="break-all font-semibold">{user.displayName}さん</p>
        <div className="flex flex-wrap gap-4">
        <Link className="button-primary button-large" href="/anime">アニメ一覧へ<ArrowRight aria-hidden="true" size={20} /></Link>
        <Link className="button-secondary button-large" href="/users/profile"><UserRound aria-hidden="true" size={20} />プロフィール</Link>
        <Link className="button-secondary button-large" href="/users/account"><KeyRound aria-hidden="true" size={20} />パスワード変更</Link>
        </div>
        <ActionButtonForm action={logoutUser} label="ログアウト" pendingLabel="ログアウト中..." className="button-secondary" />
      </div> :
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <section className="surface-panel p-5"><h2 className="text-xl font-semibold">ログイン</h2><CredentialsForm /></section>
        <section className="surface-panel p-5"><h2 className="text-xl font-semibold">新規登録</h2><CredentialsForm signingUp /></section>
      </div>}
    </section>
  </main>;
}
