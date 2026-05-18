import { useState } from "react";

const SECTIONS = {
  goal: {
    title: "Цель",
    body: "Видеть истинное настроение коллектива — без эффекта «социально желательных» ответов.",
  },
  metrics: {
    title: "Что замеряем",
    body: "10 шкал: стресс, выгорание, баланс, бренд, доверие, безопасность, карьера, сплочённость, лояльность, психобезопасность.",
  },
  signal: {
    title: "Главный сигнал",
    body: "«Якорь под маской двигателя» — внешне лояльный сотрудник, скрыто тормозящий команду.",
  },
} as const;

type Key = keyof typeof SECTIONS;

export function AboutSystem() {
  const [active, setActive] = useState<Key | null>(null);

  return (
    <section className="card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label mr-2">О системе</span>
        {(Object.keys(SECTIONS) as Key[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setActive(active === k ? null : k)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition ${
              active === k
                ? "bg-smp-accent/15 border-smp-accent text-smp-accent"
                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
            }`}
          >
            {SECTIONS[k].title}
          </button>
        ))}
      </div>
      {active && (
        <p className="text-sm text-slate-300 leading-relaxed mt-3">
          {SECTIONS[active].body}
        </p>
      )}
    </section>
  );
}
