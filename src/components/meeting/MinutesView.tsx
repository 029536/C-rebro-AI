import type { MinutesDocument } from "@/lib/minutes/schema";
import { MinutesExportBar } from "@/components/meeting/MinutesExportBar";

export type Letterhead = { text: string; logo: string | null };

export function MinutesView({
  document,
  isExample = false,
  letterhead,
}: {
  document: MinutesDocument;
  isExample?: boolean;
  letterhead?: Letterhead;
}) {
  const ataFormal = document.ata_formal;
  const resolvedLetterhead = letterhead ?? { text: "", logo: null };
  const hasLetterhead = Boolean(resolvedLetterhead.text || resolvedLetterhead.logo);

  return (
    <div className="flex flex-col gap-3">
      {isExample && (
        <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
          Exemplo de como a ata vai ficar. A geração real a partir da conversa chega numa próxima
          etapa, quando a chave da Anthropic estiver configurada.
        </p>
      )}

      {!isExample && <MinutesExportBar document={document} letterhead={resolvedLetterhead} />}

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        {hasLetterhead && (
          <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
            {resolvedLetterhead.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolvedLetterhead.logo} alt="Logo" className="h-10 w-auto" />
            )}
            {resolvedLetterhead.text && (
              <p className="whitespace-pre-wrap text-xs text-text-secondary">{resolvedLetterhead.text}</p>
            )}
          </div>
        )}
        <pre className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-text">{ataFormal}</pre>
      </div>
    </div>
  );
}
