import { useState } from "react";
import { auth, setTokens } from "../api/client";
import type { User } from "../types";

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("zorin@smp.local");
  const [password, setPassword] = useState("zorin12345");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const tokens = await auth.login(email, password);
      setTokens(tokens.access_token, tokens.refresh_token);
      const u = await auth.me();
      onLogin(u);
    } catch (e: any) {
      setErr(e.message || "Ошибка входа");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div>
          <div className="text-lg font-semibold">BuildPulse</div>
          <div className="text-xs text-slate-400">
            HR-аналитика СпецМонтажПроект
          </div>
        </div>
        <div className="space-y-2">
          <div className="label">Email</div>
          <input
            className="w-full bg-black/40 rounded-lg px-3 py-2 border border-white/10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className="label">Пароль</div>
          <input
            type="password"
            className="w-full bg-black/40 rounded-lg px-3 py-2 border border-white/10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {err && (
          <div className="text-sm text-smp-crit bg-red-500/10 rounded-lg p-2">
            {err}
          </div>
        )}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Вхожу…" : "Войти"}
        </button>
        <div className="text-xs text-slate-500 leading-relaxed">
          Демо-учётки:
          <br />• zorin@smp.local / zorin12345 (замполит)
          <br />• admin@smp.local / admin12345
          <br />• e1@smp.local / employee123 (сотрудник)
        </div>
      </form>
    </div>
  );
}
