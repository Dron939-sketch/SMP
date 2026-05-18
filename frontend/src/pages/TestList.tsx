import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { tests as api } from "../api/client";
import type { ShareLink, Test, User } from "../types";

export default function TestList({ user }: { user: User }) {
  const [list, setList] = useState<Test[]>([]);
  const [shares, setShares] = useState<Record<string, ShareLink[]>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const canShare =
    user.role === "admin" ||
    user.role === "executive" ||
    user.role === "political_officer";

  useEffect(() => {
    api.list().then(setList);
  }, []);

  const loadShares = async (id: string) => {
    if (!canShare) return;
    const links = await api.listShares(id);
    setShares((s) => ({ ...s, [id]: links }));
  };

  useEffect(() => {
    if (!canShare) return;
    list.forEach((t) => loadShares(t.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const createLink = async (t: Test) => {
    setBusy(t.id);
    try {
      const link = await api.createShare(t.id, {
        cycle_tag: `${new Date().getFullYear()}-${String(
          new Date().getMonth() + 1
        ).padStart(2, "0")}`,
        expires_in_days: 30,
      });
      setShares((s) => ({ ...s, [t.id]: [link, ...(s[t.id] || [])] }));
    } finally {
      setBusy(null);
    }
  };

  const copy = (url: string) => {
    navigator.clipboard?.writeText(url).then(
      () => alert("Скопировано в буфер"),
      () => prompt("Скопируйте вручную:", url)
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <div className="label">Тесты</div>
        <h1 className="text-2xl sm:text-3xl font-semibold">
          Доступные опросы
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          У каждого теста — свой набор замаскированных вопросов и фокус на
          разных метриках. Замполит может создать ссылку и отправить её в
          чат / email / Telegram.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map((t) => (
          <article key={t.id} className="card flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h2 className="font-semibold text-lg">{t.title}</h2>
              <span className="chip bg-white/5">{t.cycle}</span>
            </div>
            <p className="text-sm text-slate-400 whitespace-pre-line flex-1">
              {t.description}
            </p>
            <div className="text-xs text-slate-500 mt-2">
              Вопросов: {t.questions.length}
              {t.time_limit_seconds &&
                ` · лимит ${Math.round(t.time_limit_seconds / 60)} мин`}
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <Link to={`/tests/${t.id}`} className="btn-primary text-sm">
                Пройти самому
              </Link>
              {canShare && (
                <button
                  className="btn-ghost text-sm"
                  onClick={() => createLink(t)}
                  disabled={busy === t.id}
                >
                  {busy === t.id ? "Создаю…" : "Создать ссылку"}
                </button>
              )}
            </div>

            {canShare && (shares[t.id] || []).length > 0 && (
              <div className="mt-3 border-t border-white/5 pt-3 space-y-2">
                <div className="label">Ссылки на тест</div>
                {(shares[t.id] || []).slice(0, 4).map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-wrap items-center gap-2 text-xs"
                  >
                    <code className="bg-black/40 rounded px-2 py-1 flex-1 truncate">
                      {l.share_url}
                    </code>
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => copy(l.share_url)}
                    >
                      Копировать
                    </button>
                    <a
                      className="btn-ghost text-xs"
                      href={l.share_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Открыть
                    </a>
                    <span className="text-slate-500">
                      использований: {l.uses}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
