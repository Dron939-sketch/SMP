import { useEffect, useState } from "react";
import { admin, settings as settingsApi } from "../api/client";
import type { AppSettings } from "../types";

/**
 * Админ-секция для дашборда. Сама по себе не секретна (любой видит блок),
 * но любое действие требует ввода ADMIN_TOKEN. Токен живёт только в state
 * этого компонента — не пишем его в localStorage, чтобы случайно не утёк.
 */
export function AdminPanel() {
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [adminToken, setAdminToken] = useState("");
  const [tokenStored, setTokenStored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    settingsApi.get().then(setAppSettings).catch(() => setAppSettings(null));
  }, []);

  const toggleConsent = async (next: boolean) => {
    if (!tokenStored || busy) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const updated = await settingsApi.update(
        "consent_collection_enabled",
        next,
        adminToken
      );
      setAppSettings(updated);
      setMsg(`Тумблер обновлён: ${next ? "включён" : "выключен"}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-3">
      <div className="label">Администрирование</div>

      {!tokenStored ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (adminToken.trim()) setTokenStored(true);
          }}
        >
          <p className="text-xs text-slate-500">
            Чтобы менять настройки или сбросить данные, введите{" "}
            <code>ADMIN_TOKEN</code> (берётся из .env на сервере).
          </p>
          <input
            type="password"
            autoComplete="off"
            placeholder="ADMIN_TOKEN"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
          />
          <button
            type="submit"
            className="btn-ghost text-sm"
            disabled={!adminToken.trim()}
          >
            Подтвердить
          </button>
        </form>
      ) : (
        <>
          <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!appSettings?.consent_collection_enabled}
              disabled={!appSettings || busy}
              onChange={(e) => toggleConsent(e.target.checked)}
              className="mt-1"
            />
            <span>
              Собирать согласие на обработку ПДн перед прохождением теста
              <div className="text-xs text-slate-500">
                Если выключено — модалка не показывается. Полезно, если у
                заказчика согласие собирается вне приложения.
              </div>
            </span>
          </label>

          <div className="border-t border-white/5 pt-3 space-y-2">
            <div className="text-sm font-medium text-amber-300">
              Опасная зона
            </div>
            <p className="text-xs text-slate-500">
              Удаляет все ответы и связанные ИИ-анализы. Тесты и share-ссылки
              сохраняются. Используется перед передачей приложения заказчику.
              Откатить нельзя.
            </p>
            <button
              className="btn-ghost text-sm border border-red-500/40 text-red-300 hover:bg-red-500/10"
              onClick={() => setResetOpen(true)}
            >
              Сбросить все метрики
            </button>
          </div>

          {msg && <div className="text-xs text-emerald-400">{msg}</div>}
          {err && <div className="text-xs text-smp-crit">{err}</div>}

          <button
            className="text-xs text-slate-500 hover:text-slate-300 underline"
            onClick={() => {
              setAdminToken("");
              setTokenStored(false);
              setMsg(null);
              setErr(null);
            }}
          >
            Забыть токен в этой вкладке
          </button>
        </>
      )}

      {resetOpen && (
        <ResetConfirmModal
          adminToken={adminToken}
          onClose={() => setResetOpen(false)}
          onDone={(report) => {
            setResetOpen(false);
            setMsg(
              `Удалено ответов: ${report.deleted_responses}, анализов: ${report.deleted_analyses}.`
            );
            // Дашборд держит свои данные в state — проще перезагрузить,
            // чтобы виджеты отрисовали пустое состояние.
            window.setTimeout(() => window.location.reload(), 600);
          }}
        />
      )}
    </div>
  );
}

function ResetConfirmModal({
  adminToken,
  onClose,
  onDone,
}: {
  adminToken: string;
  onClose: () => void;
  onDone: (report: { deleted_responses: number; deleted_analyses: number }) => void;
}) {
  const [phrase, setPhrase] = useState("");
  const [alsoShareLinks, setAlsoShareLinks] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ready = phrase.trim() === "СБРОС";

  const doReset = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const report = await admin.wipeResponses(adminToken);
      if (alsoShareLinks) {
        await admin.wipeShareLinks(adminToken);
      }
      onDone(report);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm grid place-items-center p-4 z-50">
      <div className="card max-w-md w-full space-y-4 border-red-500/40">
        <h2 className="text-xl font-semibold text-red-300">
          Сброс всех данных
        </h2>
        <p className="text-sm text-slate-300">
          Будут безвозвратно удалены все ответы и связанные ИИ-анализы. Тесты
          сохраняются. Для подтверждения введите{" "}
          <code className="text-red-300">СБРОС</code>.
        </p>
        <input
          autoFocus
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm"
          placeholder="СБРОС"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          disabled={busy}
        />
        <label className="flex items-start gap-2 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={alsoShareLinks}
            onChange={(e) => setAlsoShareLinks(e.target.checked)}
            className="mt-0.5"
            disabled={busy}
          />
          <span>Заодно удалить все share-ссылки на тесты</span>
        </label>
        {err && <div className="text-sm text-smp-crit">{err}</div>}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button
            className="btn-primary bg-red-500 hover:bg-red-400"
            disabled={!ready || busy}
            onClick={doReset}
          >
            {busy ? "Удаляю…" : "Удалить всё"}
          </button>
        </div>
      </div>
    </div>
  );
}
