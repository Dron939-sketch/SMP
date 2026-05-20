import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { admin, dashboard } from "../api/client";
import { Jarvis } from "../components/Jarvis";
import { MetricCard } from "../components/MetricCard";
import type { AppSettings, DashboardPayload, User } from "../types";

const ANCHOR_COLORS: Record<string, string> = {
  engine: "#10b981",
  neutral: "#64748b",
  anchor: "#ef4444",
  anchor_pretender: "#f59e0b",
  unknown: "#334155",
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  warn: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  critical: "bg-red-500/10 text-red-300 border-red-500/30",
};

export default function Dashboard({ user }: { user: User }) {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const isAdmin = user.role === "admin";

  useEffect(() => {
    dashboard.political().then(setData).catch((e) => setErr(e.message));
    if (isAdmin) {
      admin.getSettings().then(setSettings).catch(() => setSettings(null));
    }
  }, [isAdmin]);

  const toggleConsent = async (next: boolean) => {
    if (settingsBusy) return;
    setSettingsBusy(true);
    try {
      const updated = await admin.updateSetting(
        "consent_collection_enabled",
        next
      );
      setSettings(updated);
    } finally {
      setSettingsBusy(false);
    }
  };

  if (err)
    return (
      <div className="card text-smp-crit">Не удалось загрузить дашборд: {err}</div>
    );
  if (!data) return <div className="text-slate-400">Загрузка дашборда…</div>;

  const cm = data.company_metrics;
  const deptRows = Object.entries(data.by_department).map(([dept, m]) => ({
    department: dept,
    stress: m.stress_index,
    trust: m.leadership_trust,
    safety: m.safety_culture,
    brand: m.employer_brand,
  }));
  const anchorRows = Object.entries(data.anchor_engine_distribution).map(
    ([name, value]) => ({ name, value })
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
      {/* Левая колонка: метрики + графики */}
      <div className="xl:col-span-8 space-y-4 sm:space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label">Дашборд замполита</div>
            <h1 className="text-2xl sm:text-3xl font-semibold">
              {data.company}
            </h1>
            <div className="text-sm text-slate-400">
              Цикл: {data.cycle_tag} · респондентов: {data.respondents}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to="/tests" className="btn-ghost text-sm">
              Тесты и ссылки
            </Link>
            <a className="btn-ghost text-sm" href={dashboard.exportXlsx()}>
              Excel
            </a>
          </div>
        </header>

        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <MetricCard
            label="Стресс"
            value={cm.stress_index}
            invert
            hint="ниже — лучше"
          />
          <MetricCard
            label="Доверие к рук-ву"
            value={cm.leadership_trust}
          />
          <MetricCard label="Безопасность" value={cm.safety_culture} />
          <MetricCard label="Бренд работодателя" value={cm.employer_brand} />
          <MetricCard label="Лояльность" value={cm.loyalty_intent} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="card">
            <div className="label mb-2">Срез по отделам</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptRows}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="department" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ background: "#111827", border: "1px solid #1f2937" }} />
                  <Bar dataKey="stress" fill="#ef4444" name="стресс" />
                  <Bar dataKey="trust" fill="#22d3ee" name="доверие" />
                  <Bar dataKey="safety" fill="#10b981" name="безопасность" />
                  <Bar dataKey="brand" fill="#f59e0b" name="бренд" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="label mb-2">
              Двигатели и якоря (с подсветкой «pretender»)
            </div>
            <div className="h-64 grid grid-cols-1 sm:grid-cols-2 items-center gap-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={anchorRows} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                    {anchorRows.map((r) => (
                      <Cell key={r.name} fill={ANCHOR_COLORS[r.name] || "#334155"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#111827", border: "1px solid #1f2937" }} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="text-sm space-y-1.5">
                {anchorRows.map((r) => (
                  <li key={r.name} className="flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ background: ANCHOR_COLORS[r.name] || "#334155" }}
                    />
                    <span className="capitalize">
                      {r.name.replace("_", " ")}
                    </span>
                    <span className="text-slate-500">— {r.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Anchor pretenders */}
        <section className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="label">Якоря под маской двигателей</div>
              <div className="text-sm text-slate-400">
                Внешне лояльны, но проективные ответы выдают саботаж
              </div>
            </div>
            <span className="chip bg-amber-500/10 text-amber-300">
              {data.anchor_pretenders.length}
            </span>
          </div>
          {data.anchor_pretenders.length === 0 ? (
            <div className="text-sm text-slate-500">
              За цикл не обнаружено. Хорошие новости, командор.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {data.anchor_pretenders.map((a, i) => (
                <li key={i} className="py-3 flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <div className="text-xs text-slate-500 sm:w-40 shrink-0">
                    {a.department || "—"} · {a.site || "—"}
                    <br />
                    <span className="text-amber-300">
                      conf. {Math.round((a.confidence ?? 0) * 100)}%
                    </span>
                  </div>
                  <div className="text-sm">{a.reasoning}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Employer image */}
        <section className="card">
          <div className="label mb-2">Образ компании в голове сотрудников</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {data.employer_image.top_keywords.map((k) => (
              <span
                key={k.keyword}
                className="chip bg-white/5"
                style={{ fontSize: 12 + Math.min(k.weight * 2, 8) }}
              >
                {k.keyword}
              </span>
            ))}
          </div>
          <ul className="space-y-1.5 text-sm text-slate-300">
            {data.employer_image.sample_sentences.map((s, i) => (
              <li key={i} className="border-l-2 border-smp-accent/40 pl-3">
                {s}
              </li>
            ))}
          </ul>
        </section>

        {/* Advisor */}
        {data.advisor && (
          <section className="card">
            <div className="label mb-3">Рекомендации (контент · продвижение · политика)</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(["content", "promotion", "internal_policy"] as const).map((cat) => (
                <div key={cat} className="space-y-2">
                  <div className="text-xs uppercase text-slate-500">
                    {cat === "content"
                      ? "Контент VK"
                      : cat === "promotion"
                      ? "Продвижение"
                      : "Внутренняя политика"}
                  </div>
                  {data.advisor![cat].map((it, i) => (
                    <div
                      key={i}
                      className={`border rounded-xl p-3 text-sm ${
                        SEVERITY_COLOR[it.severity] ||
                        "bg-white/5 border-white/10"
                      }`}
                    >
                      <div className="font-medium mb-1">{it.title}</div>
                      <div className="text-slate-300 text-sm">{it.detail}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {data.advisor.summary && (
              <div className="text-xs text-slate-500 mt-3 italic">
                {data.advisor.summary}
              </div>
            )}
          </section>
        )}

        {/* VK */}
        <section className="card">
          <div className="label mb-2">VK · страница компании</div>
          {!data.vk.enabled ? (
            <div className="text-sm text-slate-500">
              Интеграция выключена ({data.vk.reason || "VK_SERVICE_TOKEN не задан"}).
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm mb-3">
                <span className="font-semibold">{data.vk.group?.name || "—"}</span>
                <span className="text-slate-500">
                  подписчиков: {data.vk.group?.members_count ?? "—"}
                </span>
                <span className="text-slate-500">
                  постов: {data.vk.aggregate?.posts ?? 0}
                </span>
                <span className="text-slate-500">
                  ср. лайки: {data.vk.aggregate?.avg_likes ?? "—"}
                </span>
              </div>
              <ul className="space-y-2 text-sm max-h-72 overflow-y-auto pr-2">
                {data.vk.posts.slice(0, 8).map((p) => (
                  <li
                    key={p.id}
                    className="border border-white/5 rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between mb-1 text-xs text-slate-500">
                      <span>{new Date(p.date * 1000).toLocaleDateString("ru-RU")}</span>
                      <span>♥ {p.likes} · ↺ {p.reposts} · 💬 {p.comments}</span>
                    </div>
                    <div className="text-slate-300 line-clamp-3">{p.text || "(без текста)"}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {/* Правая колонка: Джарвис + быстрые алерты */}
      <aside className="xl:col-span-4 space-y-4 sm:space-y-6">
        <Jarvis />
        <div className="card">
          <div className="label mb-2">Алерты цикла</div>
          {data.alerts_summary.length === 0 ? (
            <div className="text-sm text-slate-500">Алертов нет.</div>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.alerts_summary.map(([code, count]) => (
                <li key={code} className="flex justify-between">
                  <span>{code.replace(/_/g, " ")}</span>
                  <span className="text-slate-500">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isAdmin && (
          <div className="card space-y-3">
            <div className="label">Администрирование</div>
            <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!settings?.consent_collection_enabled}
                disabled={!settings || settingsBusy}
                onChange={(e) => toggleConsent(e.target.checked)}
                className="mt-1"
              />
              <span>
                Собирать согласие на обработку ПДн перед прохождением теста
                <div className="text-xs text-slate-500">
                  Если выключено — модалка не показывается, бэк не требует
                  согласия. Используется, если у заказчика по регламенту
                  согласие собирается вне приложения.
                </div>
              </span>
            </label>
            <div className="border-t border-white/5 pt-3 space-y-2">
              <div className="text-sm font-medium text-amber-300">
                Опасная зона
              </div>
              <p className="text-xs text-slate-500">
                Полностью удалит ответы, анализы, тесты, share-ссылки, аудит
                и всех пользователей кроме вас. Используется для очистки перед
                передачей заказчику. Откатить нельзя.
              </p>
              <button
                className="btn-ghost text-sm border border-red-500/40 text-red-300 hover:bg-red-500/10"
                onClick={() => setResetOpen(true)}
              >
                Сбросить все метрики
              </button>
            </div>
          </div>
        )}
      </aside>

      {resetOpen && (
        <ResetConfirmModal
          onClose={() => setResetOpen(false)}
          onConfirmed={() => {
            setResetOpen(false);
            // После полного wipe проще всего перезагрузить страницу,
            // чтобы ре-фетчнуть всё с нуля.
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function ResetConfirmModal({
  onClose,
  onConfirmed,
}: {
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ready = phrase.trim() === "СБРОС";

  const doReset = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await admin.reset();
      onConfirmed();
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
          Будут безвозвратно удалены все ответы, анализы, тесты, share-ссылки,
          журнал аудита и все пользователи, кроме вашей учётной записи. Для
          подтверждения введите слово <code className="text-red-300">СБРОС</code>{" "}
          в поле ниже.
        </p>
        <input
          autoFocus
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm"
          placeholder="СБРОС"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          disabled={busy}
        />
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
