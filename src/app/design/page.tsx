import { Mic } from "lucide-react";
import Link from "next/link";
import { DesignBottomNav } from "@/components/design/DesignBottomNav";
import { LogoMark } from "@/components/design/LogoMark";
import { StatusBadge, type DesignStatus } from "@/components/design/StatusBadge";

type ExampleMeeting = {
  title: string;
  when: string;
  status: DesignStatus;
};

const EXAMPLE_MEETINGS: ExampleMeeting[] = [
  { title: "Escritório de Advocacia", when: "Hoje, 10:30 · 52 min", status: "ata" },
  { title: "Alinhamento de sócios", when: "Hoje, 09:10 · 38 min", status: "parecer" },
  { title: "Visita à escola piloto", when: "Ontem, 16:00 · 29 min", status: "andamento" },
];

export default function DesignHomePage() {
  return (
    <>
      <header className="flex h-14 items-center gap-2 px-4">
        <LogoMark />
        <span className="font-semibold text-design-text">Cérebro IA</span>
      </header>

      <main className="flex flex-1 flex-col gap-5 px-4 pb-24">
        <div>
          <h1 className="text-2xl font-bold text-design-text">Reuniões</h1>
          <p className="text-sm text-design-text-secondary">
            {EXAMPLE_MEETINGS.length} reuniões gravadas
          </p>
        </div>

        <Link
          href="/design/gravando"
          className="flex flex-col items-center gap-3 rounded-2xl border border-design-border bg-design-surface p-6 text-center shadow-sm"
        >
          <span className="text-base font-semibold text-design-text">Nova reunião</span>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-design-accent-soft">
            <Mic size={28} className="text-design-accent" />
          </span>
          <span className="text-sm text-design-text-secondary">
            Toque para iniciar sua reunião
          </span>
          <span className="flex h-14 w-full items-center justify-center rounded-xl bg-design-accent text-base font-semibold text-white">
            Gravar
          </span>
        </Link>

        <div className="flex flex-col gap-3">
          {EXAMPLE_MEETINGS.map((meeting) => (
            <div
              key={meeting.title}
              className="flex flex-col gap-1.5 rounded-2xl border border-design-border bg-design-surface p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-design-text">{meeting.title}</span>
                <StatusBadge status={meeting.status} />
              </div>
              <span className="text-sm text-design-text-secondary">{meeting.when}</span>
            </div>
          ))}
        </div>
      </main>

      <DesignBottomNav />
    </>
  );
}
