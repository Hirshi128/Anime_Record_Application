"use client";

import { useId, useState } from "react";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { signIn, signUp } from "./auth-actions";
import { useFormAction } from "@/app/use-form-action";

function PasswordField({ confirmation = false, signingUp = false, value, onChange }: { confirmation?: boolean; signingUp?: boolean; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const label = confirmation ? "パスワード（確認）" : "パスワード";
  const toggleLabel = `${label}を${visible ? "隠す" : "表示"}`;
  const Icon = visible ? EyeOff : Eye;
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
    <div className="relative">
      <input id={id} className="field-control pr-14" name={confirmation ? "passwordConfirmation" : "password"} type={visible ? "text" : "password"} required autoComplete={signingUp ? "new-password" : "current-password"} minLength={signingUp ? 12 : 1} maxLength={128} autoCapitalize="none" spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} />
      <button type="button" className="absolute right-0 top-0 flex h-full min-h-11 w-11 items-center justify-center rounded-md text-zinc-600 hover:text-zinc-950" aria-label={toggleLabel} title={toggleLabel} aria-controls={id} aria-pressed={visible} onClick={() => setVisible(!visible)}><Icon aria-hidden="true" size={20} /></button>
    </div>
    {signingUp && !confirmation ? <span className="block text-xs text-zinc-500">12〜128文字</span> : null}
  </div>;
}

export function CredentialsForm({ signingUp = false }: { signingUp?: boolean }) {
  const [state, action, pending] = useFormAction(signingUp ? signUp : signIn);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const Icon = signingUp ? UserPlus : LogIn;
  return (
    <form action={action} aria-busy={pending} onReset={(event) => event.preventDefault()} className="mt-5 space-y-5">
      <fieldset key={state.revision} disabled={pending} className="min-w-0 space-y-5">
        {signingUp ? <>
          <label className="block space-y-2">
            <span className="text-sm font-semibold">表示名</span>
            <input className="field-control" name="displayName" required autoComplete="nickname" maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold">ユーザーID</span>
            <input className="field-control" name="username" required autoComplete="username" pattern="[A-Za-z0-9_]{3,64}" maxLength={64} autoCapitalize="none" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
        </> : null}
        <label className="block space-y-2">
          <span className="text-sm font-semibold">メールアドレス</span>
          <input className="field-control" name="email" type="email" required autoComplete="email" maxLength={254} autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <PasswordField signingUp={signingUp} value={password} onChange={setPassword} />
        {signingUp ? <PasswordField signingUp confirmation value={confirmation} onChange={setConfirmation} /> : null}
      </fieldset>
      {state.message ? <p className="form-error" role="alert">{state.message}</p> : null}
      <button className="button-primary button-large w-full" disabled={pending} type="submit">
        <Icon aria-hidden="true" size={20} />
        <span className="action-label"><span className={!pending ? "" : "invisible"} aria-hidden={pending}>{signingUp ? "登録してログイン" : "ログイン"}</span><span className={pending ? "" : "invisible"} aria-hidden={!pending}>確認中...</span></span>
      </button>
    </form>
  );
}
