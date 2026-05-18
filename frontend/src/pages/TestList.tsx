import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { tests as api } from "../api/client";
import type { ShareLink, Test, User } from "../types";

export default function TestList({ user }: { user: User }) {
  const [list, setList] = useState<Test[]>([]);
  const [shares, setShares] = useState<Record<string, ShareLink[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ test: Test; link: ShareLink } | null>(null);

  const canShare = user.role !== "employee";

  useEffect(() => {
    api.list().then(setList);
  }, []);

  const loadShares = async (id: string) => {
    if (!canShare) return;
    try {
      const links = await api.listShares(id);
      setShares((s) => ({ ...s, [id]: links }));
    } catch {
      /* демо-режим без авторизации может ответить 401 — игнорим */
    }
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
      setPopup({ test: t, link });
    } catch (e: unknown) {
      alert(
        "Не удалось создать ссылку: " +
          (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <Link
          to="/"
          className="text-xs text-slate-400 hover:text-smp-accent"
        >
          ← на дашборд
        </Link>
        <div className="label mt-2">Тесты</div>
        <h1 className="text-2xl sm:text-3xl font-semibold">
          Доступные опросы
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          У каждого теста — две легенды.{" "}
          <span className="text-slate-200">Видимая цель</span> — то, что
          говорим сотрудникам.{" "}
          <span className="text-smp-accent">Истинная цель</span> — что
          на самом деле замеряет ИИ. Ссылку можно сразу отправить в
          Telegram / WhatsApp / Max или скопировать.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map((t) => (
          <TestCard
            key={t.id}
            t={t}
            canShare={canShare}
            busy={busy === t.id}
            shares={shares[t.id] || []}
            onCreateLink={() => createLink(t)}
          />
        ))}
      </div>

      {popup && (
        <ShareModal
          test={popup.test}
          link={popup.link}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}

function ShareModal({
  test,
  link,
  onClose,
}: {
  test: Test;
  link: ShareLink;
  onClose: () => void;
}) {
  const copy = () => {
    navigator.clipboard?.writeText(link.share_url).then(
      () => flash("Ссылка скопирована"),
      () => prompt("Скопируйте вручную:", link.share_url)
    );
  };
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card card-accent max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="label">Ссылка готова</div>
        <h2 className="text-xl font-semibold mt-1">{test.title}</h2>
        <p className="text-sm text-slate-400 mt-1">
          Отправьте сотрудникам — анонимная, действительна 30 дней.
        </p>
        <div className="mt-4 bg-black/40 rounded-xl px-3 py-3 border border-white/10 break-all text-sm font-mono">
          {link.share_url}
        </div>
        <button className="btn-primary w-full mt-4" onClick={copy}>
          📋 Скопировать ссылку
        </button>
        <button className="btn-ghost w-full mt-2" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}

function TestCard({
  t,
  canShare,
  busy,
  shares,
  onCreateLink,
}: {
  t: Test;
  canShare: boolean;
  busy: boolean;
  shares: ShareLink[];
  onCreateLink: () => void;
}) {
  return (
    <article className="card flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h2 className="font-semibold text-lg">{t.title}</h2>
        <span className="chip bg-white/5">{cycleLabel(t.cycle)}</span>
      </div>

      {/* Видимая цель (что говорим сотрудникам) */}
      {t.description && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Видимая цель · что говорим сотрудникам
          </div>
          <p className="text-sm text-slate-300 whitespace-pre-line">
            {t.description}
          </p>
        </div>
      )}

      {/* Real focus (что замеряем) */}
      {t.real_focus && (
        <div className="mt-3 border-l-2 border-smp-accent/40 pl-3">
          <div className="text-[10px] uppercase tracking-wider text-smp-accent mb-1">
            Истинная цель · только для замполита
          </div>
          <p className="text-sm text-slate-200 whitespace-pre-line">
            {t.real_focus}
          </p>
        </div>
      )}

      <div className="text-xs text-slate-500 mt-3">
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
            onClick={onCreateLink}
            disabled={busy}
          >
            {busy ? "Создаю…" : "Создать ссылку"}
          </button>
        )}
      </div>

      {canShare && shares.length > 0 && (
        <div className="mt-3 border-t border-white/5 pt-3 space-y-3">
          <div className="label">Ссылки на тест</div>
          {shares.slice(0, 3).map((l) => (
            <ShareRow key={l.id} link={l} testTitle={t.title} />
          ))}
        </div>
      )}
    </article>
  );
}

function ShareRow({
  link,
  testTitle,
}: {
  link: ShareLink;
  testTitle: string;
}) {
  const text = `Привет! Пройди короткий опрос «${testTitle}» от СпецМонтажПроект — это анонимно и поможет улучшить рабочие условия:`;
  const fullText = `${text} ${link.share_url}`;

  const copy = () => {
    navigator.clipboard?.writeText(link.share_url).then(
      () => flash("Ссылка скопирована"),
      () => prompt("Скопируйте вручную:", link.share_url)
    );
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: testTitle,
          text,
          url: link.share_url,
        });
      } catch {
        /* пользователь отменил — ок */
      }
    } else {
      copy();
    }
  };

  const tgUrl =
    "https://t.me/share/url?url=" +
    encodeURIComponent(link.share_url) +
    "&text=" +
    encodeURIComponent(text);
  const waUrl = "https://wa.me/?text=" + encodeURIComponent(fullText);
  const maxUrl =
    "https://max.ru/share?url=" + encodeURIComponent(link.share_url);

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <code className="bg-black/40 rounded px-2 py-1 flex-1 truncate">
          {link.share_url}
        </code>
        <span className="text-slate-500">использований: {link.uses}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button className="btn-ghost text-xs" onClick={copy}>
          📋 Копировать
        </button>
        <button className="btn-ghost text-xs" onClick={nativeShare}>
          ↗ Поделиться
        </button>
        <a
          className="btn-ghost text-xs"
          href={tgUrl}
          target="_blank"
          rel="noreferrer"
        >
          Telegram
        </a>
        <a
          className="btn-ghost text-xs"
          href={waUrl}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp
        </a>
        <a
          className="btn-ghost text-xs"
          href={maxUrl}
          target="_blank"
          rel="noreferrer"
        >
          Max
        </a>
        <a
          className="btn-ghost text-xs"
          href={link.share_url}
          target="_blank"
          rel="noreferrer"
        >
          Открыть
        </a>
      </div>
    </div>
  );
}

function cycleLabel(cycle: string): string {
  const map: Record<string, string> = {
    weekly: "еженедельно",
    monthly: "ежемесячно",
    quarterly: "ежеквартально",
    yearly: "ежегодно",
    daily: "ежедневно",
  };
  return map[cycle] || cycle;
}

function flash(msg: string) {
  // мини-уведомление без библиотек
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0f172a;color:#e2e8f0;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.1);font-size:13px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.3)";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}
