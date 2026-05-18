import { useEffect, useRef, useState } from "react";
import { assistant } from "../api/client";
import type { AssistantGreeting, AssistantMessage } from "../types";

/**
 * Голосовой ассистент. Использует:
 *  - Fish Audio (через серверный прокси /api/assistant/speak) — основной TTS;
 *  - Web Speech API SpeechSynthesis — fallback, если ключ Fish не задан;
 *  - MediaRecorder + Deepgram (через /api/assistant/listen) — основной STT;
 *  - browser SpeechRecognition — fallback STT.
 */
export function Jarvis() {
  const [greeting, setGreeting] = useState<AssistantGreeting | null>(null);
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [muted, setMuted] = useState(false);
  const [enableSearch, setEnableSearch] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const greetedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    assistant.greeting().then((g) => {
      if (cancelled) return;
      setGreeting(g);
      setMessages([{ role: "assistant", content: g.text }]);

      // Авто-приветствие через 5 секунд после загрузки дашборда +
      // вежливый запрос разрешения на микрофон сразу после.
      window.setTimeout(async () => {
        if (cancelled || greetedRef.current) return;
        greetedRef.current = true;
        if (!muted) speak(g.text, g);

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Сразу освобождаем — нам важно только получить разрешение,
          // настоящий запис стартует только по нажатию микрофона.
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          // пользователь отказал — голосовой ввод всё равно можно
          // включить позже, кнопка останется кликабельной.
        }
      }, 5000);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function speak(text: string, g: AssistantGreeting | null = greeting) {
    if (muted || !text) return;
    if (g?.tts_provider === "fish_audio") {
      const blob = await assistant.speak(text);
      if (blob) {
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play().catch(() => {});
        }
        return;
      }
    }
    // browser fallback
    if ("speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = g?.voice_lang || "ru-RU";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }
  }

  async function send(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setInput("");
    try {
      const res = await assistant.ask(question, messages, enableSearch);
      setMessages([
        ...next,
        { role: "assistant", content: res.answer },
      ]);
      speak(res.answer);
    } catch (e: any) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `Сбой: ${e.message || "ассистент недоступен"}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function startVoice() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    // Try server STT (Deepgram) if available — record and send
    if (greeting?.stt_provider === "deepgram") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
        chunksRef.current = [];
        rec.ondataavailable = (e) => chunksRef.current.push(e.data);
        rec.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          stream.getTracks().forEach((t) => t.stop());
          const text = await assistant.listen(blob);
          if (text) send(text);
          setRecording(false);
        };
        mediaRecorderRef.current = rec;
        rec.start();
        setRecording(true);
        return;
      } catch (e) {
        // fall through to browser STT
      }
    }
    // Browser SpeechRecognition fallback
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Голосовой ввод не поддержан этим браузером.");
      return;
    }
    const sr = new SR();
    sr.lang = greeting?.voice_lang || "ru-RU";
    sr.interimResults = false;
    sr.onresult = (e: any) => {
      const text = e.results[0]?.[0]?.transcript;
      if (text) send(text);
    };
    sr.onend = () => setRecording(false);
    sr.start();
    setRecording(true);
  }

  return (
    <div className="card relative">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="label">AI-помощник</div>
          <div className="font-semibold text-lg">
            {greeting?.name || "Джарвис"}{" "}
            <span className="text-xs text-slate-500">
              · DeepSeek · {greeting?.tts_provider || "browser"} TTS
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`chip ${muted ? "bg-white/10" : "bg-smp-accent/20 text-smp-accent"}`}
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? "Звук выкл" : "Звук вкл"}
          </button>
          <button className="btn-ghost text-xs" onClick={() => setOpen((o) => !o)}>
            {open ? "Свернуть" : "Развернуть"}
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 mb-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm rounded-xl px-3 py-2 ${
                  m.role === "user"
                    ? "bg-smp-accent/10 ml-8"
                    : "bg-white/5 mr-8"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
                  {m.role === "user" ? "вы" : greeting?.name || "джарвис"}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            ))}
            {busy && <div className="text-xs text-slate-500">думаю…</div>}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <button
              type="button"
              onClick={startVoice}
              className={`btn ${
                recording ? "bg-smp-crit text-white" : "bg-white/5 hover:bg-white/10"
              }`}
              title="Голосовой ввод"
            >
              {recording ? "● стоп" : "🎤"}
            </button>
            <input
              className="flex-1 bg-black/40 rounded-xl px-4 py-2 border border-white/10"
              placeholder="Спросите Джарвиса…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              ↵
            </button>
          </form>

          <label className="flex items-center gap-2 text-xs text-slate-500 mt-2">
            <input
              type="checkbox"
              checked={enableSearch}
              onChange={(e) => setEnableSearch(e.target.checked)}
            />
            Подключить веб-поиск (Tavily) для свежих данных
          </label>
        </>
      )}

      <audio ref={audioRef} hidden />
    </div>
  );
}
