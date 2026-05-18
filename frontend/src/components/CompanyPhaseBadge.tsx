import type { CompanyPhase } from "../types";

const STYLE: Record<CompanyPhase["phase"], { bg: string; dot: string; title: string }> = {
  разбитие: {
    bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-200",
    dot: "bg-emerald-400",
    title: "Разбитие",
  },
  среднее: {
    bg: "bg-cyan-500/10 border-cyan-500/30 text-cyan-200",
    dot: "bg-cyan-400",
    title: "Среднее",
  },
  стагнация: {
    bg: "bg-amber-500/10 border-amber-500/30 text-amber-200",
    dot: "bg-amber-400",
    title: "Стагнация",
  },
};

export function CompanyPhaseBadge({ phase }: { phase: CompanyPhase }) {
  const s = STYLE[phase.phase] || STYLE["среднее"];
  return (
    <div
      className={`mt-4 inline-flex items-start gap-3 rounded-2xl border px-4 py-3 ${s.bg}`}
    >
      <span className={`inline-block w-2.5 h-2.5 rounded-full mt-1.5 ${s.dot} shadow`} />
      <div className="text-sm leading-tight">
        <div className="font-semibold text-base">Фаза компании: {s.title}</div>
        <div className="text-xs opacity-80 mt-0.5">{phase.reason}</div>
        <div className="text-[11px] mt-1 opacity-60">
          двигатели {Math.round(phase.engines_share * 100)}% · якоря{" "}
          {Math.round(phase.anchors_share * 100)}% · позитив{" "}
          {phase.composite_positive.toFixed(1)}/5
        </div>
      </div>
    </div>
  );
}
