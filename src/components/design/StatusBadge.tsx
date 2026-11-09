export type DesignStatus = "ata" | "parecer" | "andamento";

const STYLES: Record<DesignStatus, string> = {
  ata: "bg-design-badge-ata-bg text-design-badge-ata-text",
  parecer: "bg-design-badge-parecer-bg text-design-badge-parecer-text",
  andamento: "bg-design-badge-andamento-bg text-design-badge-andamento-text",
};

const LABELS: Record<DesignStatus, string> = {
  ata: "Ata gerada",
  parecer: "Parecer disponível",
  andamento: "Em andamento",
};

export function StatusBadge({ status }: { status: DesignStatus }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
