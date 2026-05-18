import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { tests } from "../api/client";
import { TestForm } from "../components/TestForm";
import type { Test } from "../types";

/**
 * Страница теста по shared-ссылке.
 * Минимум интерфейса: только тест → отправить → «Спасибо!».
 * Логин не требуется — бэкенд в демо-режиме принимает анонимный submit.
 */
export default function SharedTest() {
  const { token } = useParams<{ token: string }>();
  const [test, setTest] = useState<Test | null>(null);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    tests.getShared(token).then(setTest).catch((e) => setErr(e.message));
  }, [token]);

  if (err)
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <div className="card max-w-lg w-full text-smp-crit text-center">
          Ссылка недействительна или истекла.
          <div className="text-xs text-slate-500 mt-2">{err}</div>
        </div>
      </div>
    );

  if (!test)
    return (
      <div className="min-h-screen grid place-items-center text-slate-400">
        Загрузка теста…
      </div>
    );

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <div className="card max-w-lg w-full text-center space-y-3">
          <div className="text-3xl">🙏</div>
          <div className="text-2xl font-semibold">Спасибо!</div>
          <div className="text-sm text-slate-400">
            Ваши ответы получены. Они влияют на агрегированную аналитику
            и помогают улучшать условия работы.
            <br />
            Можно закрыть вкладку.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-smp-ink text-slate-100 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <header className="mb-4 sm:mb-6">
          <div className="label">СпецМонтажПроект</div>
          <h1 className="text-2xl sm:text-3xl font-semibold">{test.title}</h1>
          {test.description && (
            <p className="text-sm text-slate-400 mt-2 whitespace-pre-line">
              {test.description}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-3">
            Ответы анонимны. Линейные руководители видят только агрегаты
            по отделу — не персональные ответы.
          </p>
        </header>

        <TestForm
          test={test}
          cycleTag={`shared:${token!.slice(0, 6)}`}
          onSubmit={async (payload) => {
            await tests.submitShared(token!, payload);
            setDone(true);
          }}
        />
      </div>
    </div>
  );
}
