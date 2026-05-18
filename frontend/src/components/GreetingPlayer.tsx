import { useEffect, useRef } from "react";

/**
 * Невидимый аудио-плеер. Через 5 секунд после монтирования
 * запускает /greeting.mp3 (положи файл в frontend/public/greeting.mp3).
 * Никакого UI, никакого текста.
 */
export function GreetingPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const el = audioRef.current;
      if (!el) return;
      // Браузер может заблокировать autoplay без user gesture —
      // тогда тихо игнорим, ничего страшного.
      el.play().catch(() => {});
    }, 5000);
    return () => window.clearTimeout(t);
  }, []);

  return <audio ref={audioRef} src="/greeting.mp3" preload="auto" hidden />;
}
