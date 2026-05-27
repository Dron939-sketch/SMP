import type { Question } from "../types";

export type AnswerValue = number | string | string[] | null;

export function QuestionRender({
  q,
  value,
  onChange,
}: {
  q: Question;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  switch (q.question_type) {
    case "likert_5":
      return (
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`btn ${
                value === n
                  ? "bg-smp-accent text-slate-900"
                  : "bg-white/5 hover:bg-white/10"
              }`}
              aria-pressed={value === n}
            >
              {n}
            </button>
          ))}
          <div className="col-span-5 flex justify-between text-[10px] text-slate-500 px-1">
            <span>совсем не так</span>
            <span>да, постоянно</span>
          </div>
        </div>
      );

    case "single_choice":
      return (
        <div className="space-y-2">
          {(q.options?.choices || []).map((c) => (
            <label
              key={c}
              className={`flex items-start gap-3 cursor-pointer rounded-xl p-3 border transition ${
                value === c
                  ? "border-smp-accent bg-smp-accent/10"
                  : "border-white/10 hover:bg-white/5"
              }`}
            >
              <input
                type="radio"
                className="mt-1"
                checked={value === c}
                onChange={() => onChange(c)}
              />
              <span className="text-sm">{c}</span>
            </label>
          ))}
        </div>
      );

    case "multiple_choice":
      return (
        <div className="space-y-2">
          {(q.options?.choices || []).map((c) => {
            const arr = Array.isArray(value) ? value : [];
            const checked = arr.includes(c);
            return (
              <label
                key={c}
                className={`flex items-start gap-3 cursor-pointer rounded-xl p-3 border transition ${
                  checked
                    ? "border-smp-accent bg-smp-accent/10"
                    : "border-white/10 hover:bg-white/5"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked
                        ? arr.filter((x) => x !== c)
                        : [...arr, c]
                    )
                  }
                />
                <span className="text-sm">{c}</span>
              </label>
            );
          })}
        </div>
      );

    case "open_text":
      return (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value.slice(0, 10000))}
          rows={4}
          maxLength={10000}
          className="w-full bg-black/40 rounded-xl px-4 py-3 border border-white/10 text-sm"
          placeholder="Напишите своими словами…"
        />
      );

    default:
      return (
        <div className="text-xs text-slate-500">
          Тип вопроса {q.question_type} ещё не поддержан в UI.
        </div>
      );
  }
}
