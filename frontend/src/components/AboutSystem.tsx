import { useState } from "react";

const SECTIONS = {
  goal: {
    title: "Цель",
    body: "Видеть истинное настроение коллектива — без эффекта «социально желательных» ответов.",
  },
  metrics: {
    title: "Что замеряем",
    body: "10 шкал: стресс, выгорание, баланс, бренд, доверие, безопасность, карьера, сплочённость, лояльность, психобезопасность.",
  },
  signal: {
    title: "Главный сигнал",
    body: "«Якорь под маской двигателя» — внешне лояльный сотрудник, скрыто тормозящий команду.",
  },
} as const;

type Key = keyof typeof SECTIONS;

export function AboutSystem() {
  const [briefOpen, setBriefOpen] = useState(false);
  const [manual, setManual] = useState(false);

  return (
    <section className="card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label mr-2">О системе</span>
        <button
          type="button"
          onClick={() => setBriefOpen(true)}
          className="text-xs px-3 py-1.5 rounded-lg border bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 transition"
        >
          Кратко
        </button>
        <button
          type="button"
          onClick={() => setManual(true)}
          className="text-xs px-3 py-1.5 rounded-lg border bg-smp-accent/10 border-smp-accent/40 text-smp-accent hover:bg-smp-accent/20 transition"
        >
          📖 Инструкция
        </button>
      </div>
      {briefOpen && <BriefModal onClose={() => setBriefOpen(false)} />}
      {manual && <ManualModal onClose={() => setManual(false)} />}
    </section>
  );
}

function BriefModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card card-accent max-w-xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="label">О системе</div>
            <h2 className="text-xl font-semibold mt-1">Кратко</h2>
          </div>
          <button className="btn-ghost text-xs" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="space-y-3">
          {(Object.keys(SECTIONS) as Key[]).map((k) => (
            <div
              key={k}
              className="rounded-xl border border-white/5 bg-black/20 p-3"
            >
              <div className="text-smp-accent text-sm font-semibold mb-1">
                {SECTIONS[k].title}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {SECTIONS[k].body}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-white/5 text-xs text-slate-500 text-center leading-relaxed">
          Разработано{" "}
          <span className="text-slate-300">Андреем Мейстером</span>{" "}
          специально для{" "}
          <span className="text-slate-300">СпецМонтажПроект</span>.
        </div>
        <button className="btn-primary w-full mt-3" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>
  );
}

function ManualModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card card-accent max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="label">Инструкция</div>
            <h2 className="text-xl font-semibold mt-1">Как пользоваться системой</h2>
          </div>
          <button className="btn-ghost text-xs" onClick={onClose}>
            ✕
          </button>
        </div>

        <Block title="Что это вообще">
          Система помогает замполиту видеть, что{" "}
          <em>на самом деле</em> происходит с людьми, а не то, что они
          говорят на совещании. Вы раздаёте сотрудникам тесты с
          замаскированными вопросами; ИИ по совокупности ответов
          восстанавливает скрытые метрики — стресс, доверие, лояльность,
          культуру безопасности и т.д. На дашборде вы видите агрегаты.
        </Block>

        <Block title="Как раздавать тесты">
          1. Идёте в раздел <b>«Тесты и ссылки»</b>.<br />
          2. Жмёте «Создать ссылку» на нужном тесте — открывается окно
          с готовой ссылкой и кнопкой «Скопировать».<br />
          3. Отправляете ссылку сотрудникам любым способом: Telegram,
          Max, WhatsApp, email, рассылка через бригадира. Ссылка
          анонимна и живёт 30 дней.<br />
          4. Сотрудник вводит ФИО (это видите только вы), проходит
          тест, видит «Спасибо». Никаких метрик ему не показывают.
        </Block>

        <Block title="Какой тест когда запускать">
          <b>Пульс недели</b> — раз в неделю. Короткий, ловит динамику
          настроения.<br />
          <b>Образ компании</b> — раз в квартал. Узнать, как сотрудники
          описывают компанию в нерабочей беседе.<br />
          <b>Культура безопасности</b> — раз в месяц. Критично для ОТ,
          снижает риск инцидентов.<br />
          <b>Связь с руководством</b> — раз в месяц. Главный детектор
          «якорей под маской двигателей».<br />
          <b>Годовой большой опрос</b> — раз в год. База для трендов.<br />
          <b>Кадровый резерв</b> — раз в квартал. Кто потянет рост.
        </Block>

        <Block title="На что обращать внимание на дашборде">
          <b>Фаза компании</b> сверху — это сводный диагноз.
          «Разбитие» — растём, «Среднее» — норма, «Стагнация» — план
          действий обязателен.<br />
          <b>Главный инсайт</b> — самая важная мысль дня, ИИ собирает
          из текущих данных.<br />
          <b>Якоря под маской двигателей</b> — главный сигнал.
          Внешне лояльны, но скрыто тянут команду вниз. Каждое такое
          имя — это 1:1 с непосредственным руководителем затронутого
          отдела на этой неделе.<br />
          <b>Тепловая карта</b> — где красные ячейки, туда смотреть в
          первую очередь.<br />
          <b>План на неделю</b> — готовые шаги, считаются сами.
        </Block>

        <Block title="Что делать с конкретным сотрудником">
          В разделе <b>«Отчёты»</b> кликните на строчку — увидите
          полный ИИ-разбор по этому респонденту: резюме, метку
          двигатель/якорь, рекомендации, все 10 шкал, сырые ответы.
          Никогда не используйте эти данные для увольнений или
          штрафов — это инструмент диагностики условий, не оценки
          людей. Сотрудники должны доверять системе, иначе пойдут
          социально-желательные ответы и валидность упадёт.
        </Block>

        <Block title="Метрика «Стагнация» — что делать">
          Если система показывает «Стагнация», значит позитивные
          шкалы низкие (бренд, доверие, лояльность, сплочённость), а
          доля якорей высокая. Это не катастрофа, но это сигнал.
          В таком случае: (1) проведите тесты по всем участкам, чтобы
          увидеть локальные очаги, (2) выполните пункты «Плана на
          неделю», (3) запланируйте «Образ компании» через 4 недели
          для сравнения.
        </Block>

        <Block title="Частые вопросы">
          <b>«Сотрудники могут хитрить?»</b> — Да, но замаскированные
          вопросы и контр-шкалы сильно снижают это. Плюс таймер на
          каждый вопрос ловит «прокликивание».<br />
          <b>«Что показывать руководству?»</b> — Только агрегаты:
          средние метрики, тренды, % якорей. Без имён.<br />
          <b>«Можно ли подключить тренды?»</b> — Да, после двух циклов
          у системы появятся данные для сравнения.<br />
          <b>«Что делать, если тестов мало?»</b> — Меньше 10 ответов в
          цикле — выводам не доверять. Цель: 30+ респондентов.
        </Block>

        <button className="btn-primary w-full mt-4" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4">
      <h3 className="text-smp-accent text-sm font-semibold mb-1.5">{title}</h3>
      <div className="text-sm text-slate-300 leading-relaxed">{children}</div>
    </section>
  );
}
