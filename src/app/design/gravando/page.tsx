import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AudioWave } from "@/components/design/AudioWave";

type ExampleOpinion = {
  time: string;
  text: string;
};

const EXAMPLE_OPINIONS: ExampleOpinion[] = [
  {
    time: "12:30",
    text: "Antes de desenhar a integração, descubra quais ferramentas do escritório têm API. Sem isso, o plano muda.",
  },
  {
    time: "9:45",
    text: "Vale perguntar se a integração precisa ser em tempo real ou se uma sincronização diária já resolve — muda bastante o esforço.",
  },
];

export default function DesignRecordingPage() {
  return (
    <>
      <header className="flex h-14 items-center justify-between px-4">
        <Link href="/design" className="flex h-11 w-11 items-center justify-center text-design-text">
          <ArrowLeft size={22} />
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-design-text">Opinar automaticamente</span>
          <span className="flex h-7 w-12 items-center rounded-full bg-design-accent p-1">
            <span className="h-5 w-5 translate-x-5 rounded-full bg-white transition-transform" />
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-5 px-4 pb-32">
        <div className="flex flex-col items-center gap-1 pt-2 text-center">
          <span className="flex items-center gap-2 text-sm font-semibold text-design-record">
            <span className="h-2.5 w-2.5 rounded-full bg-design-record" />
            Gravando
          </span>
          <span className="text-4xl font-bold tabular-nums text-design-text">12:48</span>
          <span className="text-sm text-design-text-secondary">Escritório de Advocacia</span>
        </div>

        <AudioWave />

        <p className="rounded-xl bg-design-surface px-4 py-3 text-sm italic text-design-text-secondary shadow-sm">
          ...o advogado quer ver tudo numa tela só...
        </p>

        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-lg font-bold text-design-text">Claude opinando</h2>
            <span className="text-xs font-medium uppercase tracking-wide text-design-text-secondary">
              Opiniões da IA (Claude)
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {EXAMPLE_OPINIONS.map((opinion, index) => (
              <div
                key={opinion.time}
                className={
                  index === 0
                    ? "rounded-xl border-[1.5px] border-design-accent bg-design-accent-soft p-4"
                    : "rounded-xl border border-design-border bg-design-surface p-4 shadow-sm"
                }
              >
                <span className="text-xs font-semibold text-design-text-secondary">
                  {opinion.time}
                </span>
                <p className="mt-1 text-sm text-design-text">{opinion.text}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md gap-3 border-t border-design-border bg-design-surface-bottom p-4">
        <button
          type="button"
          className="flex h-14 flex-1 items-center justify-center rounded-xl border border-design-record text-sm font-semibold text-design-record"
        >
          Pedir opinião agora
        </button>
        <button
          type="button"
          className="flex h-14 flex-1 items-center justify-center rounded-xl bg-design-record text-sm font-semibold text-white"
        >
          Encerrar reunião
        </button>
      </div>
    </>
  );
}
