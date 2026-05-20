import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { admin, auth, tests } from "../api/client";
import { ConsentModal } from "../components/ConsentModal";
import { TestForm } from "../components/TestForm";
import type { Test, User } from "../types";

export default function SharedTest() {
  const { token } = useParams<{ token: string }>();
  const [test, setTest] = useState<Test | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [consentRequired, setConsentRequired] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    tests.getShared(token).then(setTest).catch((e) => setErr(e.message));
    auth.me().then(setMe).catch(() => setMe(null));
    admin
      .getSettings()
      .then((s) => setConsentRequired(s.consent_collection_enabled))
      .catch(() => setConsentRequired(true));
  }, [token]);

  if (err) return <div className="card max-w-lg mx-auto m-6 text-smp-crit">{err}</div>;
  if (!test || consentRequired === null)
    return <div className="m-6 text-slate-400">Загрузка…</div>;

  if (done) {
    return (
      <div className="card max-w-lg mx-auto m-6 text-center space-y-3">
        <div className="text-2xl">Спасибо!</div>
        <div className="text-sm text-slate-400">Ответы получены.</div>
      </div>
    );
  }

  const needConsent = !!me && consentRequired && !me.consent_given;

  return (
    <div className="min-h-screen bg-smp-ink text-slate-100 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <header className="mb-4 sm:mb-6">
          <div className="label">СпецМонтажПроект · опрос по ссылке</div>
          <h1 className="text-2xl sm:text-3xl font-semibold">{test.title}</h1>
          {test.description && (
            <p className="text-sm text-slate-400 mt-2 whitespace-pre-line">
              {test.description}
            </p>
          )}
        </header>

        {!me ? (
          <div className="card space-y-2 text-sm">
            Чтобы пройти тест, войдите под своей учёткой:{" "}
            <a className="text-smp-accent underline" href="/login">
              войти
            </a>
            .<div className="text-xs text-slate-500">
              Ваши ответы анонимны для линейных руководителей; обработка —
              только для агрегированной аналитики.
            </div>
          </div>
        ) : (
          <TestForm
            test={test}
            cycleTag={`shared:${token!.slice(0, 6)}`}
            onSubmit={async (payload) => {
              await tests.submitShared(token!, payload);
              setDone(true);
            }}
          />
        )}

        {needConsent && (
          <ConsentModal
            onCancel={() => setMe(null)}
            onAccept={async () => {
              const updated = await auth.consent();
              setMe(updated);
            }}
          />
        )}
      </div>
    </div>
  );
}
