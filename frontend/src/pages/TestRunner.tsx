import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { admin, auth, tests } from "../api/client";
import { ConsentModal } from "../components/ConsentModal";
import { TestForm } from "../components/TestForm";
import type { Test, User } from "../types";

function currentCycle(period = "weekly"): string {
  const d = new Date();
  if (period === "weekly") {
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(
      ((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7
    );
    return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  if (period === "quarterly") {
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `${d.getFullYear()}-Q${q}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Props {
  user: User;
  onUserUpdate: (u: User) => void;
}

export default function TestRunner({ user, onUserUpdate }: Props) {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [test, setTest] = useState<Test | null>(null);
  const [consentRequired, setConsentRequired] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    tests.get(id).then(setTest).catch((e) => setErr(e.message));
    admin
      .getSettings()
      .then((s) => setConsentRequired(s.consent_collection_enabled))
      .catch(() => setConsentRequired(true));
  }, [id]);

  if (err) return <div className="card text-smp-crit">Ошибка: {err}</div>;
  if (!test || consentRequired === null)
    return <div className="text-slate-400">Загружаю тест…</div>;

  if (done) {
    return (
      <div className="card text-center space-y-3 max-w-lg mx-auto">
        <div className="text-2xl">Спасибо!</div>
        <div className="text-sm text-slate-400">
          Ответы отправлены. Результат повлияет на агрегированные метрики, но
          останется анонимным для линейных руководителей.
        </div>
        <button className="btn-primary mt-4" onClick={() => nav("/")}>
          На дашборд
        </button>
      </div>
    );
  }

  const needConsent = consentRequired && !user.consent_given;

  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-4 sm:mb-6">
        <div className="label">Тест</div>
        <h1 className="text-2xl sm:text-3xl font-semibold">{test.title}</h1>
        {test.description && (
          <p className="text-sm text-slate-400 mt-2 whitespace-pre-line">
            {test.description}
          </p>
        )}
      </header>
      <TestForm
        test={test}
        cycleTag={currentCycle(test.cycle)}
        onSubmit={async (payload) => {
          await tests.submit(test.id, payload);
          setDone(true);
        }}
      />
      {needConsent && (
        <ConsentModal
          onCancel={() => nav("/")}
          onAccept={async () => {
            const updated = await auth.consent();
            onUserUpdate(updated);
          }}
        />
      )}
    </div>
  );
}
