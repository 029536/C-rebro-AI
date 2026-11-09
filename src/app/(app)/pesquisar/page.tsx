import { Search } from "lucide-react";

export default function PesquisarPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold text-text">Pesquisar</h1>
      <div className="flex h-14 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-text-secondary">
        <Search size={18} />
        <span>Buscar por cliente, título, participante...</span>
      </div>
      <p className="text-text-secondary">A busca chega numa próxima etapa.</p>
    </div>
  );
}
