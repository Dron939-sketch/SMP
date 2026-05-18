import { useEffect, useRef, useState } from "react";
import { assistant } from "../api/client";

/**
 * Минимальный «при-входный» голосовой приветственник.
 * Никакого чата, микрофона, истории — только озвучка приветствия
 * один раз на устройство (флаг bp_jarvis_greeted в localStorage).
 *
 * Отображает компактный баннер с текстом приветствия и кнопками
 * «Озвучить» / «Звук вкл/выкл». Можно свернуть.
 */
export function GreetingPlayer() {
  const [text, setText] = useState<string>("");
  const [name, setName] = useState<string>("Джарвис");
  const [ttsProvider, setTtsProvider] = useState<"fish_audio" | "browser">("browser");
  const [voiceLang, setVoiceLang] = useState<string>("ru-RU");
  const [muted, setMuted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    assistant.greeting().then((g) => {
      if (cancelled) return;
      setText(g.text);
      setName(g.name);
      setTtsProvider(g.tts_provider);
      setVoiceLang(g.voice_lang);
      // Озвучка один раз навсегда.
      if (localStorage.getItem("bp_jarvis_greeted") === "1") {
        playedRef.current = true;
        return;
      }
      window.setTimeout(() => {
        if (cancelled || playedRef.current) return;
        playedRef.current = true;
        localStorage.setItem("bp_jarvis_greeted", "1");
        if (!muted) play(g.text, g.tts_provider, g.voice_lang);
      }, 5000);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function play(t: string, provider = ttsProvider, lang = voiceLang) {
    if (!t) return;
    if (provider === "fish_audio") {
      const blob = await assistant.speak(t);
      if (blob && audioRef.current) {
        audioRef.current.src = URL.createObjectURL(blob);
        audioRef.current.play().catch(() => {});
        return;
      }
    }
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = lang;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }

  if (!text) return null;

  return (
    <div className="card relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label">AI · {name}</div>
          {!collapsed && (
            <p className="mt-2 text-sm leading-relaxed text-slate-200">
              {text}
            </p>
          )}
        </div>
        <button
          className="btn-ghost text-xs shrink-0"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? "Развернуть" : "Свернуть"}
        </button>
      </div>
      {!collapsed && (
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            className="btn-ghost text-xs"
            onClick={() => play(text)}
          >
            🔊 Озвучить
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? "Звук выкл" : "Звук вкл"}
          </button>
        </div>
      )}
      <audio ref={audioRef} hidden />
    </div>
  );
}
