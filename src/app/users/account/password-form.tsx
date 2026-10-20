"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useFormAction } from "@/app/use-form-action";
import { changePassword } from "./actions";

export function PasswordChangeForm() {
  const [state, action, pending] = useFormAction(changePassword);
  const [values, setValues] = useState({ currentPassword: "", password: "", passwordConfirmation: "" });
  return <form action={action} onReset={(event) => event.preventDefault()} aria-busy={pending} className="space-y-5">
    <fieldset key={state.revision} disabled={pending} className="min-w-0 space-y-5">
      {([
        ["currentPassword", "現在のパスワード", "current-password"],
        ["password", "新しいパスワード", "new-password"],
        ["passwordConfirmation", "新しいパスワード（確認）", "new-password"],
      ] as const).map(([name, label, autoComplete]) => <label key={name} className="block space-y-2">
        <span className="text-sm font-semibold">{label}</span>
        <input className="field-control" name={name} type="password" autoComplete={autoComplete} required minLength={name === "currentPassword" ? 1 : 12} maxLength={128} value={values[name]} onChange={(event) => setValues({ ...values, [name]: event.target.value })} />
      </label>)}
    </fieldset>
    {state.message ? <p className="form-error" role="alert">{state.message}</p> : null}
    <button className="button-primary button-large w-full" type="submit" disabled={pending}><KeyRound aria-hidden="true" size={20} /><span className="action-label"><span aria-hidden={pending} className={pending ? "invisible" : undefined}>パスワードを変更</span><span aria-hidden={!pending} className={!pending ? "invisible" : undefined}>変更中...</span></span></button>
  </form>;
}
