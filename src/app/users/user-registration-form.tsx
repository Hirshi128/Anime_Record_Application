"use client";

import { useActionState, useState } from "react";
import { createUser } from "./actions";
import { initialFormState } from "@/lib/form-state";

export function UserRegistrationForm() {
  const [state, formAction, pending] = useActionState(
    createUser,
    initialFormState,
  );
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");

  return (
    <form
      action={formAction}
      className="mt-5 space-y-5"
      aria-busy={pending}
      onReset={(event) => event.preventDefault()}
    >
      <fieldset disabled={pending} className="min-w-0 space-y-5">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-zinc-800">表示名</span>
          <input
            className="field-control"
            name="displayName"
            maxLength={100}
            placeholder="例: hirsh"
            required
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={pending}
            autoComplete="nickname"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-zinc-800">
            ユーザーID
          </span>
          <input
            className="field-control"
            name="username"
            maxLength={64}
            pattern="[A-Za-z0-9_]{3,}"
            placeholder="例: hirsh_anime"
            required
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={pending}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
      </fieldset>
      {state.message ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <button className="button-primary button-large w-full" type="submit" disabled={pending}>
        {pending ? "作成中..." : "作成してログイン"}
      </button>
    </form>
  );
}
