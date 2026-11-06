"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-text">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-14 rounded-xl border border-border bg-surface px-4 text-base text-text outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-text">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-14 rounded-xl border border-border bg-surface px-4 text-base text-text outline-none focus:border-accent"
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-record">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-14 rounded-xl bg-accent text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
