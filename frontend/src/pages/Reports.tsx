import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { reports } from "../api/client";
import { flagLabel, metricLabel, validityLabel } from "../labels";
import type { ResponseDetail, ResponseListItem } from "../types";

const ANCHOR_COLOR: Record<string, string> = {
  engine: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  neutral: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  anchor: "bg-red-500/15 text-red-300 border-red-500/30",
  anchor_pretender: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const ANCHOR_LABEL: Record<string, string> = {
  engine: "двигатель",
  neutral: "нейтрален",
  anchor: "якорь",
  anchor_pretender: "якорь под маской двигателя",
};

export default function Reports() {
  const [items, setItems] = useState<ResponseListItem[] | null>(null);
  const [open, setOpen] = useState<ResponseDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    reports
      .list()
      .then((r) => setItems(r.items))
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="card text-smp-crit">Ошибка: {err}</div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <Link to="/" className="text-xs text-slate-400 hover:text-smp-accent">
          ← на дашборд
        </Link>
        <div className="label mt-2">Отчёты</div>
        <h1 className="text-2xl sm:text-3xl font-semibold">
          Пройденные тесты
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Каждая строка — одно прохождение. Кликни, чтобы открыть
          полный анализ системы.
        </p>
      </header>

      {!items ? (
        <div className="card animate-pulse h-40" />
      ) : items.length === 0 ? (
        <div className="card text-sm text-slate-400">
          Пока никто не прошёл ни один тест.
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">ФИО</th>
                  <th className="px-4 py-3">Тест</th>
                  <th className="px-4 py-3">Цикл</th>
                  <th className="px-4 py-3">Дата</th>
                  <th className="px-4 py-3">Метка</th>
                  <th className="px-4 py-3">Валидность</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr
                    key={it.response_id}
                    className="border-t border-white/5 hover:bg-white/[0.03] cursor-pointer transition"
                    onClick={() =>
                      reports.get(it.response_id).then(setOpen).catch((e) => setErr(e.message))
                    }
                  >
                    <td className="px-4 py-3 font-medium">
                      {it.respondent_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {it.test_title}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{it.cycle_tag}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(it.submitted_at).toLocaleString("ru-RU", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {it.anchor_engine ? (
                        <span
                          className={`chip border ${
                            ANCHOR_COLOR[it.anchor_engine] || "bg-white/5"
                          }`}
                        >
                          {ANCHOR_LABEL[it.anchor_engine] || it.anchor_engine}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {validityLabel(it.validity_flag)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && <DetailModal data={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function DetailModal({
  data,
  onClose,
}: {
  data: ResponseDetail;
  onClose: () => void;
}) {
  const a = data.analysis;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card-accent rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="card overflow-y-auto overscroll-contain flex-1 scroll-fade-bottom"
          style={{ scrollbarGutter: "stable" }}
        >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="label">Отчёт по тесту</div>
            <h2 className="text-xl font-semibold mt-1">{data.test.title}</h2>
            <div className="text-xs text-slate-400 mt-1">
              {data.respondent_name || "ФИО не указано"} ·{" "}
              {new Date(data.submitted_at).toLocaleString("ru-RU")} · цикл {data.cycle_tag}
            </div>
          </div>
          <button className="btn-ghost text-xs" onClick={onClose}>
            ✕
          </button>
        </div>

        {a && (
          <>
            <section className="mt-4">
              <div className="label mb-1">Резюме</div>
              <p className="text-sm text-slate-200 leading-relaxed">
                {a.summary_text}
              </p>
            </section>

            <section className="mt-4">
              <div className="label mb-1">Поведенческий маркер</div>
              <div className="flex items-center gap-2">
                <span
                  className={`chip border ${
                    ANCHOR_COLOR[a.anchor_engine || ""] || "bg-white/5"
                  }`}
                >
                  {ANCHOR_LABEL[a.anchor_engine || ""] || a.anchor_engine || "—"}
                </span>
                {a.anchor_engine_confidence != null && (
                  <span className="text-xs text-slate-500">
                    уверенность {Math.round(a.anchor_engine_confidence * 100)}%
                  </span>
                )}
              </div>
              {a.anchor_engine_reasoning && (
                <p className="text-xs text-slate-400 mt-1.5">
                  {a.anchor_engine_reasoning}
                </p>
              )}
            </section>

            {a.recommendations.length > 0 && (
              <section className="mt-4">
                <div className="label mb-1">Рекомендации замполиту</div>
                <ul className="text-sm space-y-1 list-disc list-inside text-slate-300">
                  {a.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-4">
              <div className="label mb-2">Метрики</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {Object.entries(a.score_metrics).map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-lg bg-black/30 border border-white/5 px-2.5 py-1.5 flex justify-between"
                  >
                    <span className="text-slate-400 truncate">{metricLabel(k)}</span>
                    <span className="font-mono">{Number(v).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </section>

            {a.risk_flags.length > 0 && (
              <section className="mt-4">
                <div className="label mb-1">Сигналы</div>
                <div className="flex flex-wrap gap-1.5">
                  {a.risk_flags.map((f) => (
                    <span
                      key={f}
                      className="chip bg-red-500/10 text-red-200 border border-red-500/20"
                    >
                      {flagLabel(f)}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <section className="mt-5 border-t border-white/5 pt-4">
          <div className="label mb-2">Сырые ответы</div>
          <ul className="space-y-2 text-sm">
            {data.answers.map((ans, i) => (
              <li key={i} className="border border-white/5 rounded-lg p-2.5">
                <div className="text-xs text-slate-400 mb-1">
                  {ans.display_text || ans.code}
                </div>
                <div className="text-slate-200">
                  {ans.text || JSON.stringify(ans.value) || "—"}
                </div>
              </li>
            ))}
          </ul>
        </section>
        </div>
      </div>
    </div>
  );
}
