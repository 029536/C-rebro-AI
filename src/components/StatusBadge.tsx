export type MeetingChipStatus = "ata" | "parecer" | "andamento";

const STYLES: Record<MeetingChipStatus, string> = {
  ata: "bg-badge-ata-bg text-badge-ata-text",
  parecer: "bg-badge-parecer-bg text-badge-parecer-text",
  andamento: "bg-badge-andamento-bg text-badge-andamento-text",
};

const LABELS: Record<MeetingChipStatus, string> = {
  ata: "Ata Gerada",
  parecer: "Parecer Disponível",
  andamento: "Em Andamento",
};

export function StatusBadge({ status }: { status: MeetingChipStatus }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
