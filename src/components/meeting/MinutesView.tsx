import type { MinutesDocument } from "@/lib/minutes/schema";

export function MinutesView({
  document,
  isExample = false,
}: {
  document: MinutesDocument;
  isExample?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {isExample && (
        <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
          Exemplo de como a ata vai ficar. A geração real a partir da conversa chega numa próxima
          etapa, quando a chave da Anthropic estiver configurada.
        </p>
      )}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <pre className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-text">
          {document.ata_formal}
        </pre>
      </div>
    </div>
  );
}
