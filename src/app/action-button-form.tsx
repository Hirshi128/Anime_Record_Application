"use client";

import { useActionState } from "react";
import { initialFormState, type FormAction } from "@/lib/form-state";

type ActionButtonFormProps = {
  action: FormAction;
  label: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  confirmation?: string;
  returnTo?: string;
};

export function ActionButtonForm({
  action,
  label,
  pendingLabel = "処理中...",
  className = "button-primary",
  disabled = false,
  confirmation,
  returnTo,
}: ActionButtonFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form
      action={formAction}
      className="min-w-0 space-y-2"
      aria-busy={pending}
      onSubmit={(event) => {
        if (confirmation && !window.confirm(confirmation))
          event.preventDefault();
      }}
    >
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <button
        className={className}
        type="submit"
        disabled={disabled || pending}
      >
        <span className="action-label">
          <span aria-hidden={pending} className={pending ? "invisible" : undefined}>
            {label}
          </span>
          <span aria-hidden={!pending} className={!pending ? "invisible" : undefined}>
            {pendingLabel}
          </span>
        </span>
      </button>
      {state.message ? (
        <p className="form-error max-w-72" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
