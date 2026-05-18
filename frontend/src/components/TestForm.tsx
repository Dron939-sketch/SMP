import { useEffect, useMemo, useRef, useState } from "react";
import { QuestionRender, type AnswerValue } from "./QuestionRender";
import type { Test } from "../types";

interface Props {
  test: Test;
  cycleTag: string;
  onSubmit: (payload: {
    cycle_tag: string;
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
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [perQuestionMs, setPerQuestionMs] = useState<Record<string, number>>({});
  const [revisions, setRevisions] = useState<Record<string, number>>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [busy, setBusy] = useState(false);

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
  };

  const allAnswered = useMemo(
    () => test.questions.every((q) => !q.is_required || answers[q.id] != null && answers[q.id] !== ""),
    [answers, test.questions]
  );

  const handleSubmit = async () => {
    if (!allAnswered || busy) return;
    setBusy(true);
    const finished = new Date();
    const totalMs = finished.getTime() - startedAtRef.current.getTime();
    const payload = {
      cycle_tag: cycleTag,
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
    } finally {
      setBusy(false);
    }
  };

  if (!activeQ) return null;

  const elapsedSec = Math.round(perQuestionMs[activeQ.id] || 0) / 1000;

  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <div className="flex items-center justify-between mb-2">
          <div className="label">
            Вопрос {activeIdx + 1} из {total}
          </div>
          <div className="text-xs text-slate-500">
            на этом вопросе: {elapsedSec.toFixed(1)}с
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
            disabled={!allAnswered || busy}
          >
            {busy ? "Отправляю…" : "Завершить тест"}
          </button>
        )}
      </div>

      <div className="text-xs text-slate-500 text-center">
        Время на каждом вопросе и общее время учитываются для оценки
        качества ответов. Это анонимная служебная метрика.
      </div>
    </div>
  );
}
