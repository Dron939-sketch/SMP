import { useState } from "react";

interface Props {
  onAccept: () => Promise<void> | void;
  onCancel: () => void;
}

export function ConsentModal({ onAccept, onCancel }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!agreed || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onAccept();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm grid place-items-center p-4 z-50">
      <div className="card max-w-lg w-full space-y-4">
        <h2 className="text-xl font-semibold">
          Согласие на обработку персональных данных
        </h2>
        <div className="text-sm text-slate-300 space-y-2 max-h-64 overflow-y-auto pr-1">
          <p>
            Я даю согласие компании СпецМонтажПроект на обработку моих
            персональных данных, а также ответов на вопросы данного теста
            в целях формирования агрегированной аналитики и улучшения
            внутренних процессов.
          </p>
          <p>
            Данные хранятся в защищённом виде. Линейным руководителям
            результаты передаются только в обезличенном агрегированном виде.
            Согласие можно отозвать, обратившись к администратору.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span>
            Я ознакомился(-ась) и даю согласие на обработку персональных данных
          </span>
        </label>
        {err && <div className="text-sm text-smp-crit">{err}</div>}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>
            Отмена
          </button>
          <button
            className="btn-primary"
            disabled={!agreed || busy}
            onClick={handleAccept}
          >
            {busy ? "Сохраняю…" : "Принять и продолжить"}
          </button>
        </div>
      </div>
    </div>
  );
}
