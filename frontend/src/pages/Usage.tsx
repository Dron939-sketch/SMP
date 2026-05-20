import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface Event {
  id: string;
  created_at: string;
  user_label: string | null;
  method: string;
  path: string;
  action: string | null;
  status_code: number | null;
  duration_ms: number | null;
  ip: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
}

interface UsageData {
  since: string;
  since_hours: number;
  total_events: number;
  unique_ips: number;
  devices: Record<string, number>;
  browsers: Record<string, number>;
  top_actions: { action: string; count: number }[];
  items: Event[];
}

export default function Usage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hours, setHours] = useState(72);

  useEffect(() => {
    setData(null);
    fetch(`${BASE}/api/usage/events?since_hours=${hours}&limit=300`)
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, [hours]);

  if (err) return <div className="card text-smp-crit">Ошибка: {err}</div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <Link to="/" className="text-xs text-slate-400 hover:text-smp-accent">
          ← на дашборд
        </Link>
        <div className="label mt-2">Статистика</div>
        <h1 className="text-2xl sm:text-3xl font-semibold">
          Кто заходил и что делал
        </h1>
        <div className="text-sm text-slate-400 mt-1 flex flex-wrap gap-2 items-center">
          <span>Период:</span>
          {[24, 72, 168, 720].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={`text-xs px-2.5 py-1 rounded border transition ${
                hours === h
                  ? "bg-smp-accent/15 border-smp-accent text-smp-accent"
                  : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
              }`}
            >
              {h === 24 ? "1 день" : h === 72 ? "3 дня" : h === 168 ? "неделя" : "месяц"}
            </button>
          ))}
        </div>
      </header>

      {!data ? (
        <div className="card animate-pulse h-40" />
      ) : (
        <>
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPI label="Всего событий" value={data.total_events} />
            <KPI label="Уникальных IP" value={data.unique_ips} />
            <KPI label="Устройств" value={Object.keys(data.devices).length} />
            <KPI label="Браузеров" value={Object.keys(data.browsers).length} />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Breakdown title="По устройствам" data={data.devices} />
            <Breakdown title="По браузерам" data={data.browsers} />
            <div className="card">
              <div className="label mb-2">Топ-действия</div>
              <ul className="space-y-1 text-sm">
                {data.top_actions.slice(0, 8).map((a) => (
                  <li key={a.action} className="flex justify-between gap-2">
                    <span className="truncate text-slate-300">{a.action}</span>
                    <span className="text-slate-500 font-mono shrink-0">
                      {a.count}
                    </span>
                  </li>
                ))}
                {data.top_actions.length === 0 && (
                  <li className="text-slate-500">Действий пока нет.</li>
                )}
              </ul>
            </div>
          </section>

          <section className="card overflow-hidden p-0">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="label">Лента событий</div>
              <span className="text-xs text-slate-500">
                Показано {data.items.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-slate-500 text-[10px] uppercase tracking-wider">
                    <th className="px-4 py-2">Время</th>
                    <th className="px-4 py-2">Действие</th>
                    <th className="px-4 py-2">Пользователь</th>
                    <th className="px-4 py-2">Устройство</th>
                    <th className="px-4 py-2">Браузер</th>
                    <th className="px-4 py-2">ОС</th>
                    <th className="px-4 py-2">IP</th>
                    <th className="px-4 py-2 text-right">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((e) => (
                    <tr
                      key={e.id}
                      className="border-t border-white/5 hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-2 whitespace-nowrap text-slate-400">
                        {new Date(e.created_at).toLocaleString("ru-RU", {
                          dateStyle: "short",
                          timeStyle: "medium",
                        })}
                      </td>
                      <td className="px-4 py-2 text-slate-200">
                        {e.action || (
                          <span className="text-slate-600 font-mono">
                            {e.method} {e.path}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-300">
                        {e.user_label || "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-400">{e.device || "—"}</td>
                      <td className="px-4 py-2 text-slate-400">{e.browser || "—"}</td>
                      <td className="px-4 py-2 text-slate-400">{e.os || "—"}</td>
                      <td className="px-4 py-2 text-slate-400 font-mono">
                        {e.ip || "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span
                          className={
                            !e.status_code
                              ? "text-slate-600"
                              : e.status_code >= 500
                              ? "text-smp-crit"
                              : e.status_code >= 400
                              ? "text-smp-warn"
                              : "text-smp-ok"
                          }
                        >
                          {e.status_code || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {data.items.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-6 text-center text-slate-500"
                      >
                        Событий за выбранный период нет.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function KPI({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="label mb-1">{label}</div>
      <div className="text-2xl sm:text-3xl font-semibold kpi-value">{value}</div>
    </div>
  );
}

function Breakdown({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const items = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = items.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <div className="card">
      <div className="label mb-2">{title}</div>
      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-sm text-slate-500">Нет данных.</li>
        )}
        {items.map(([k, v]) => (
          <li key={k} className="text-sm">
            <div className="flex justify-between">
              <span className="text-slate-300">{k}</span>
              <span className="text-slate-500">
                {v} · {Math.round((v / total) * 100)}%
              </span>
            </div>
            <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-smp-accent rounded-full"
                style={{ width: `${(v / total) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
