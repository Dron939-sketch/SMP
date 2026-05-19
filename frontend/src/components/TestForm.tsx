import { useEffect, useMemo, useRef, useState } from "react";
import { QuestionRender, type AnswerValue } from "./QuestionRender";
import type { Test } from "../types";

interface Props {
  test: Test;
  cycleTag: string;
  onSubmit: (payload: {
    cycle_tag: string;
    respondent_name: string;
    answers: {
      question_id: string;
      code: string;
      value: AnswerValue;
      text: string | null;
      time_spent_ms: number;
      revisions: number;
    }[];
    total_time_ms: number;
    client_started_at: string;
    client_finished_at: string;
  }) => Promise<void>;
}

/**
 * Замеры времени:
 *   - startTime — момент монтирования формы;
 *   - perQuestionMs[id] — суммарное «активное» время на вопрос;
 *   - revisions[id] — сколько раз сменили ответ;
 *   - паузы (>30с без взаимодействия) не засчитываются.
 */
export function TestForm({ test, cycleTag, onSubmit }: Props) {
  const [respondentName, setRespondentName] = useState("");
  const [stage, setStage] = useState<"name" | "questions">("name");
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [perQuestionMs, setPerQuestionMs] = useState<Record<string, number>>({});
  const [revisions, setRevisions] = useState<Record<string, number>>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startedAtRef = useRef<Date>(new Date());
  const lastTickRef = useRef<number>(Date.now());
  const lastActiveRef = useRef<number>(Date.now());

  const total = test.questions.length;
  const activeQ = test.questions[activeIdx];
  const progress = Math.round(((activeIdx + 1) / total) * 100);

  // Тикаем каждую секунду: накидываем время на текущий вопрос,
  // если пользователь не отсутствует > 30с.
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      const idle = now - lastActiveRef.current;
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      if (idle < 30_000 && activeQ) {
        setPerQuestionMs((p) => ({
          ...p,
          [activeQ.id]: (p[activeQ.id] || 0) + delta,
        }));
      }
    }, 1000);
    const bump = () => (lastActiveRef.current = Date.now());
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    document.addEventListener("visibilitychange", bump);
    return () => {
      clearInterval(id);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, [activeQ]);

  const setAnswer = (v: AnswerValue) => {
    if (!activeQ) return;
    setAnswers((a) => {
      const had = activeQ.id in a;
      if (had) {
        setRevisions((r) => ({ ...r, [activeQ.id]: (r[activeQ.id] || 0) + 1 }));
      }
      return { ...a, [activeQ.id]: v };
    });
    lastActiveRef.current = Date.now();

    // Автопереход к следующему вопросу для одиночных кликов.
    if (
      activeQ.question_type === "likert_5" ||
      activeQ.question_type === "single_choice"
    ) {
      const next = activeIdx + 1;
      if (next < total) {
        window.setTimeout(() => setActiveIdx(next), 220);
      }
    }
  };

  const isAnswered = (q: { id: string; question_type: string }) => {
    const v = answers[q.id];
    if (v == null) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  };

  const allAnswered = useMemo(
    () => test.questions.every((q) => !q.is_required || isAnswered(q)),
    [answers, test.questions]
  );

  const missingIndices = useMemo(
    () =>
      test.questions
        .map((q, i) => ({ i, q }))
        .filter(({ q }) => q.is_required && !isAnswered(q))
        .map(({ i }) => i),
    [answers, test.questions]
  );

  const handleSubmit = async () => {
    setError(null);
    if (!allAnswered) {
      const first = missingIndices[0];
      if (first !== undefined) {
        setActiveIdx(first);
        setError(
          `Не заполнено ${missingIndices.length} ${
            missingIndices.length === 1 ? "вопрос" : "вопросов"
          }. Открыл первый из них.`
        );
      }
      return;
    }
    if (busy) return;
    setBusy(true);
    const finished = new Date();
    const totalMs = finished.getTime() - startedAtRef.current.getTime();
    const payload = {
      cycle_tag: cycleTag,
      respondent_name: respondentName.trim(),
      total_time_ms: totalMs,
      client_started_at: startedAtRef.current.toISOString(),
      client_finished_at: finished.toISOString(),
      answers: test.questions.map((q) => {
        const v = answers[q.id] ?? null;
        const isText = q.question_type === "open_text";
        return {
          question_id: q.id,
          code: q.code,
          value: isText ? null : v,
          text: isText ? (typeof v === "string" ? v : null) : null,
          time_spent_ms: Math.round(perQuestionMs[q.id] || 0),
          revisions: revisions[q.id] || 0,
        };
      }),
    };
    try {
      await onSubmit(payload);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Не удалось отправить: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  if (stage === "name") {
    const valid = respondentName.trim().length >= 2;
    return (
      <form
        className="card max-w-lg mx-auto space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) {
            startedAtRef.current = new Date();
            lastTickRef.current = Date.now();
            lastActiveRef.current = Date.now();
            setStage("questions");
          }
        }}
      >
        <div>
          <div className="label">Перед началом</div>
          <h2 className="text-xl font-semibold mt-1">Как вас зовут?</h2>
          <p className="text-sm text-slate-400 mt-1">
            Фамилия Имя Отчество — нужно для учёта прохождения.
            Линейные руководители имена не видят, только агрегаты.
          </p>
        </div>
        <input
          autoFocus
          value={respondentName}
          onChange={(e) => setRespondentName(e.target.value)}
          placeholder="Иванов Иван Иванович"
          className="w-full bg-black/40 rounded-xl px-4 py-3 border border-white/10"
        />
        <button type="submit" className="btn-primary w-full" disabled={!valid}>
          Начать тест →
        </button>
      </form>
    );
  }

  if (!activeQ) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <div className="flex items-center justify-between mb-2">
          <div className="label">
            Вопрос {activeIdx + 1} из {total}
          </div>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-smp-accent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div className="card space-y-4">
        <div className="text-lg sm:text-xl leading-snug">
          {activeQ.display_text}
        </div>
        <QuestionRender
          q={activeQ}
          value={answers[activeQ.id] ?? null}
          onChange={setAnswer}
        />
      </div>

      <div className="flex flex-wrap gap-2 justify-between">
        <button
          className="btn-ghost"
          onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
          disabled={activeIdx === 0 || busy}
        >
          ← Назад
        </button>

        {activeIdx < total - 1 ? (
          <button
            className="btn-primary"
            onClick={() => setActiveIdx((i) => Math.min(total - 1, i + 1))}
            disabled={busy}
          >
            Дальше →
          </button>
        ) : (
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={busy}
          >
            {busy
              ? "Отправляю…"
              : allAnswered
              ? "Завершить тест"
              : `Заполнить ещё ${missingIndices.length}`}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-smp-crit/30 bg-red-500/10 text-red-200 text-sm px-3 py-2">
          {error}
        </div>
      )}

    </div>
  );
}
