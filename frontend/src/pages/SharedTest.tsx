import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { settings as settingsApi, tests } from "../api/client";
import {
  ConsentModal,
  hasLocalConsent,
} from "../components/ConsentModal";
import { TestForm } from "../components/TestForm";
import type { Test } from "../types";

/**
 * Страница теста по shared-ссылке.
 * Минимум интерфейса: только тест → отправить → «Спасибо!».
 * Логин не требуется — бэкенд в демо-режиме принимает анонимный submit.
 * Если включён тумблер сбора согласия — сначала модалка с согласием.
 */
export default function SharedTest() {
  const { token } = useParams<{ token: string }>();
  const [test, setTest] = useState<Test | null>(null);
  const [consentRequired, setConsentRequired] = useState<boolean | null>(null);
  const [consentAccepted, setConsentAccepted] = useState<boolean>(
    hasLocalConsent()
  );
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    tests.getShared(token).then(setTest).catch((e) => setErr(e.message));
    settingsApi
      .get()
      .then((s) => setConsentRequired(s.consent_collection_enabled))
      .catch(() => setConsentRequired(true));
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

  if (!test || consentRequired === null)
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

  const needConsent = consentRequired && !consentAccepted;

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

        {needConsent && (
          <ConsentModal
            onCancel={() => {
              // Если отказался — просто закрываем вкладку-эквивалент:
              // вернёмся на начальный экран (можно было бы и сразу
              // window.close(), но не во всех браузерах сработает).
              window.location.href = "/";
            }}
            onAccept={() => setConsentAccepted(true)}
          />
        )}
      </div>
    </div>
  );
}
