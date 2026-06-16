import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { portraits } from "../api/client";
import type {
  PortraitCompany,
  PortraitEmployeeDetail,
  PortraitEmployeeSummary,
  PortraitEmployeesResponse,
} from "../types";

type Tab = "employees" | "company";

const ANCHOR_COLOR: Record<string, string> = {
  engine: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  neutral: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  anchor: "bg-red-500/15 text-red-300 border-red-500/30",
  anchor_pretender: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const ANCHOR_LABEL: Record<string, string> = {
  engine: "Двигатель",
  neutral: "Нейтрал",
  anchor: "Якорь",
  anchor_pretender: "Якорь-притворщик",
};

export default function Portraits() {
  const [tab, setTab] = useState<Tab>("employees");

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Портреты</div>
          <h1 className="text-2xl sm:text-3xl font-semibold">
            Сотрудники и компания
          </h1>
          <div className="text-sm text-slate-400">
            Сводные психопортреты по сумме всех пройденных тестов
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/" className="btn-ghost text-sm">
            ← Дашборд
          </Link>
        </div>
      </header>

      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setTab("employees")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "employees"
              ? "border-smp-accent text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          🧑‍🔧 Сотрудники
        </button>
        <button
          onClick={() => setTab("company")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "company"
              ? "border-smp-accent text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          🏢 Компания глазами сотрудников
        </button>
      </div>

      {tab === "employees" ? <EmployeesTab /> : <CompanyTab />}
    </div>
  );
}

// ===== EMPLOYEES =====

function EmployeesTab() {
  const [data, setData] = useState<PortraitEmployeesResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    portraits.employees().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err)
    return (
      <div className="card text-smp-crit">Не удалось загрузить: {err}</div>
    );
  if (!data) return <div className="text-slate-400">Загрузка…</div>;

  const filtered = data.items.filter((it) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      it.full_name.toLowerCase().includes(q) ||
      (it.department || "").toLowerCase().includes(q) ||
      (it.position || "").toLowerCase().includes(q)
    );
  });

  const canSeeDetail = true;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className={selected ? "lg:col-span-5" : "lg:col-span-12"}>
        <div className="flex items-center gap-3 mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, отделу, должности…"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:border-smp-accent"
          />
          <span className="text-xs text-slate-500">
            {filtered.length} / {data.count}
          </span>
        </div>
        <ul className="space-y-2">
          {filtered.map((it) => (
            <li key={it.user_id}>
              <button
                onClick={() => canSeeDetail && setSelected(it.user_id)}
                className={`w-full text-left card hover:border-smp-accent/40 transition ${
                  selected === it.user_id ? "border-smp-accent/60" : ""
                } ${canSeeDetail ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-medium">{it.full_name}</div>
                    <div className="text-xs text-slate-500">
                      {it.position || "—"} · {it.department || "—"} ·{" "}
                      {it.site || "—"}
                    </div>
                  </div>
                  {it.anchor_engine && (
                    <span
                      className={`chip border ${
                        ANCHOR_COLOR[it.anchor_engine] ||
                        "bg-white/5 border-white/10"
                      }`}
                    >
                      {ANCHOR_LABEL[it.anchor_engine] || it.anchor_engine}
                      {it.anchor_engine_confidence != null && (
                        <span className="ml-1 opacity-70">
                          ({Math.round(it.anchor_engine_confidence * 100)}%)
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  <span>📊 тестов: {it.tests_passed}</span>
                  {it.risk_flags.slice(0, 4).map((f) => (
                    <span
                      key={f}
                      className="chip bg-red-500/10 text-red-300 border border-red-500/20"
                    >
                      {f}
                    </span>
                  ))}
                  {it.risk_flags.length > 4 && (
                    <span className="text-slate-500">
                      +{it.risk_flags.length - 4}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="text-slate-500 text-sm">
              Никого не нашли по фильтру.
            </li>
          )}
        </ul>
      </div>

      {selected && canSeeDetail && (
        <div className="lg:col-span-7">
          <EmployeeDetail
            user_id={selected}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  );
}

function EmployeeDetail({
  user_id,
  onClose,
}: {
  user_id: string;
  onClose: () => void;
}) {
  const [d, setD] = useState<PortraitEmployeeDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setD(null);
    portraits
      .employee(user_id)
      .then(setD)
      .catch((e) => setErr(e.message));
  }, [user_id]);

  if (err) return <div className="card text-smp-crit">{err}</div>;
  if (!d) return <div className="text-slate-400">Загрузка портрета…</div>;

  return (
    <div className="space-y-4 sticky top-4">
      <div className="card">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl font-semibold">{d.user.full_name}</h2>
            <div className="text-sm text-slate-400">
              {d.user.position || "—"} · {d.user.department || "—"} ·{" "}
              {d.user.site || "—"}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {d.user.email} · {d.user.role}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost text-xs">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {Object.entries(d.avg_metrics).map(([k, v]) => (
            <div
              key={k}
              className="border border-white/10 rounded-lg px-3 py-2 bg-white/[0.02]"
            >
              <div className="text-[11px] uppercase text-slate-500 tracking-wide">
                {k.replace(/_/g, " ")}
              </div>
              <div className="text-lg font-semibold">{v}</div>
            </div>
          ))}
        </div>

        {Object.keys(d.risk_freq).length > 0 && (
          <div className="mb-3">
            <div className="label mb-1">Частые риск-флаги</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(d.risk_freq).map(([f, c]) => (
                <span
                  key={f}
                  className="chip bg-red-500/10 text-red-300 border border-red-500/20"
                >
                  {f.replace(/_/g, " ")} · {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="label mb-2">История по циклам ({d.tests_passed})</div>
        <ul className="space-y-3">
          {d.history.map((h, i) => (
            <li
              key={i}
              className="border border-white/5 rounded-lg p-3 bg-white/[0.02]"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span>
                  {h.cycle_tag} ·{" "}
                  {h.submitted_at
                    ? new Date(h.submitted_at).toLocaleDateString("ru-RU")
                    : "—"}
                </span>
                {h.anchor_engine && (
                  <span
                    className={`chip border ${
                      ANCHOR_COLOR[h.anchor_engine] ||
                      "bg-white/5 border-white/10"
                    }`}
                  >
                    {ANCHOR_LABEL[h.anchor_engine] || h.anchor_engine}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-200 leading-relaxed mb-2">
                {h.summary}
              </p>
              {h.anchor_engine_reasoning && (
                <div className="text-xs text-slate-500 italic mb-2">
                  Reasoning: {h.anchor_engine_reasoning}
                </div>
              )}
              {h.recommendations.length > 0 && (
                <ul className="text-xs text-slate-400 space-y-1 mt-2">
                  {h.recommendations.slice(0, 3).map((r, j) => (
                    <li key={j}>→ {r}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ===== COMPANY =====

function CompanyTab() {
  const [d, setD] = useState<PortraitCompany | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    portraits.company().then(setD).catch((e) => setErr(e.message));
  }, []);

  if (err)
    return (
      <div className="card text-smp-crit">Не удалось загрузить: {err}</div>
    );
  if (!d) return <div className="text-slate-400">Загрузка портрета компании…</div>;

  const maxWeight = Math.max(...d.top_keywords.map((k) => k.weight), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      {/* Left: keywords + dept */}
      <div className="lg:col-span-7 space-y-4">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <div className="label">Облако слов · образ компании</div>
            <span className="text-xs text-slate-500">
              {d.respondents} респондентов
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {d.top_keywords.map((k) => {
              const scale = 0.7 + (k.weight / maxWeight) * 1.1;
              return (
                <span
                  key={k.keyword}
                  className="inline-block px-2.5 py-1 rounded-full bg-white/5 border border-white/10"
                  style={{ fontSize: `${scale}rem` }}
                  title={`weight=${k.weight} · упомянуто ${k.mentions} раз`}
                >
                  {k.keyword}
                </span>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="label mb-2">Тёмные сигналы (что портит образ)</div>
          {d.dark_signals.length === 0 ? (
            <div className="text-sm text-slate-500">
              За цикл явных «темных» сигналов нет.
            </div>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {d.dark_signals.map((s) => (
                <li
                  key={s}
                  className="chip bg-red-500/10 text-red-300 border border-red-500/20"
                >
                  {s.replace(/_/g, " ")} ({d.flag_freq[s] || 0})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="label mb-2">Светлые сигналы</div>
          {d.light_signals.length === 0 ? (
            <div className="text-sm text-slate-500">Нет.</div>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {d.light_signals.map((s) => (
                <li
                  key={s}
                  className="chip bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                >
                  {s.replace(/_/g, " ")} ({d.flag_freq[s] || 0})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="label mb-2">По отделам — топовые слова</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {Object.entries(d.by_department_top_keywords).map(([dept, words]) => (
              <div key={dept} className="border border-white/5 rounded-lg p-3">
                <div className="text-xs uppercase text-slate-500 tracking-wide mb-1">
                  {dept}
                </div>
                <div className="flex flex-wrap gap-1">
                  {words.map((w) => (
                    <span
                      key={w}
                      className="text-xs px-1.5 py-0.5 rounded bg-white/5"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: quotes */}
      <div className="lg:col-span-5">
        <div className="card">
          <div className="label mb-2">Цитаты сотрудников</div>
          <ul className="space-y-2 text-sm max-h-[600px] overflow-y-auto pr-1">
            {d.sample_sentences.map((s, i) => (
              <li
                key={i}
                className="border-l-2 border-smp-accent/40 pl-3 text-slate-300"
              >
                <p>«{s.text}»</p>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  цикл {s.cycle_tag}
                </div>
              </li>
            ))}
            {d.sample_sentences.length === 0 && (
              <li className="text-slate-500">
                Цитат за этот цикл не собрано.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
