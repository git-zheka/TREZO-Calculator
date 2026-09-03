"use client";

import { useActionState } from "react";
import { login, type LoginState } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <div className="login-wrap">
      <form className="login-card" action={action}>
        <h1>Райдер</h1>
        <p>Облік прокату. Введи пароль, щоб зайти.</p>
        <label className="f">
          <span>Пароль</span>
          <input className="i" type="password" name="password" autoComplete="current-password" autoFocus />
        </label>
        <button className="btn primary" type="submit" disabled={pending} style={{ width: "100%", justifyContent: "center", marginTop: 14 }}>
          {pending ? "Заходжу…" : "Увійти"}
        </button>
        {state.error ? <div className="login-err">{state.error}</div> : null}
      </form>
    </div>
  );
}
