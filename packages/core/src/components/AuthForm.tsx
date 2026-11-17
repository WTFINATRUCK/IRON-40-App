"use client";

import { useActionState } from "react";

type State = { error?: string; ok?: string } | undefined;

export function AuthForm({
  action,
  submit,
  next,
  newPassword,
  children,
}: {
  action: (prev: State, form: FormData) => Promise<State>;
  submit: string;
  next?: string;
  newPassword?: boolean;
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="form">
      {next && <input type="hidden" name="next" value={next} />}
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required maxLength={254} />
      </label>
      <label>
        Password {newPassword && <span className="hint">at least 10 characters</span>}
        <input
          name="password"
          type="password"
          autoComplete={newPassword ? "new-password" : "current-password"}
          required
          minLength={10}
          maxLength={128}
        />
      </label>
      {children}
      {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      {state?.ok && <p className="notice" role="status">{state.ok}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Working…" : submit}</button>
    </form>
  );
}
