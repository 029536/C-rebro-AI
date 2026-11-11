"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { MemoryItemCard, type MemoryItemRow } from "@/components/MemoryItemCard";
import { formatDateTime } from "@/lib/format";

const TIPO_SECTIONS: { tipo: MemoryItemRow["tipo"]; label: string }[] = [
  { tipo: "decisao", label: "Decisões" },
  { tipo: "pendencia", label: "Pendências" },
  { tipo: "estado", label: "Estado" },
  { tipo: "risco", label: "Riscos" },
];

export function ProjectMemoryPanel({
  projectId,
  initialItems,
  initialUpdatedAt,
  legacySummary,
}: {
  projectId: string;
  initialItems: MemoryItemRow[];
  initialUpdatedAt: string | null;
  legacySummary: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [newTipo, setNewTipo] = useState<MemoryItemRow["tipo"]>("pendencia");
  const [newTexto, setNewTexto] = useState("");
  const [adding, setAdding] = useState(false);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    const response = await fetch(`/api/projects/${projectId}/memory/refresh`, { method: "POST" });
    const data = await response.json().catch(() => null);
    setRefreshing(false);
    if (!response.ok) {
      setError(data?.error ?? "Não foi possível atualizar agora.");
      return;
    }
    // O servidor já tem os itens certos; recarrega a página para refletir
    // o que a IA mudou (novos/alterados/resolvidos não voltam na resposta do refresh).
    window.location.reload();
  }

  async function updateItem(id: string, patch: Partial<Pick<MemoryItemRow, "texto" | "travado" | "resolvido">>) {
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setUpdatedAt(new Date().toISOString());
    await fetch(`/api/projects/${projectId}/memory/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function deleteItem(id: string) {
    setItems((previous) => previous.filter((item) => item.id !== id));
    await fetch(`/api/projects/${projectId}/memory/items/${id}`, { method: "DELETE" });
  }

  async function addItem() {
    const texto = newTexto.trim();
    if (!texto) return;
    setAdding(true);
    const response = await fetch(`/api/projects/${projectId}/memory/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: newTipo, texto }),
    });
    setAdding(false);
    if (response.ok) {
      const created = await response.json();
      setItems((previous) => [...previous, { ...created, origem_meeting_title: null }]);
      setNewTexto("");
    }
  }

  const visibleItems = showResolved ? items : items.filter((item) => !item.resolvido);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-secondary">
          {updatedAt ? `Atualizada em ${formatDateTime(updatedAt)}` : "Ainda não atualizada"}
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-accent disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Atualizando..." : "Atualizar agora"}
        </button>
      </div>

      {error && <p className="text-sm text-record">{error}</p>}

      <button
        type="button"
        onClick={() => setShowResolved((value) => !value)}
        className="self-start text-xs font-semibold text-accent"
      >
        {showResolved ? "Ocultar resolvidos" : "Mostrar resolvidos"}
      </button>

      {visibleItems.length === 0 ? (
        <p className="text-text-secondary">
          Ainda não há itens — eles são criados sozinhos ao encerrar reuniões ligadas a este
          projeto, ou você pode adicionar um abaixo.
        </p>
      ) : (
        TIPO_SECTIONS.map((section) => {
          const sectionItems = visibleItems.filter((item) => item.tipo === section.tipo);
          if (sectionItems.length === 0) return null;
          return (
            <div key={section.tipo} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {section.label}
              </h3>
              {sectionItems.map((item) => (
                <MemoryItemCard
                  key={item.id}
                  item={item}
                  onUpdate={(patch) => updateItem(item.id, patch)}
                  onDelete={() => deleteItem(item.id)}
                />
              ))}
            </div>
          );
        })
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Adicionar item manual
        </h3>
        <select
          value={newTipo}
          onChange={(event) => setNewTipo(event.target.value as MemoryItemRow["tipo"])}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-text"
        >
          <option value="decisao">Decisão</option>
          <option value="pendencia">Pendência</option>
          <option value="estado">Estado</option>
          <option value="risco">Risco</option>
        </select>
        <textarea
          value={newTexto}
          onChange={(event) => setNewTexto(event.target.value)}
          rows={2}
          placeholder="Ex.: o prazo final é 30/03, não negociar."
          className="resize-none rounded-lg border border-border bg-background p-3 text-sm text-text outline-none"
        />
        <button
          type="button"
          onClick={addItem}
          disabled={adding || !newTexto.trim()}
          className="flex h-10 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white disabled:opacity-60"
        >
          {adding ? "Adicionando..." : "Adicionar"}
        </button>
      </div>

      {legacySummary && (
        <details className="rounded-xl border border-border bg-background p-3">
          <summary className="cursor-pointer text-xs font-semibold text-text-secondary">
            Nota geral (de antes desta memória ser por itens)
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">{legacySummary}</p>
        </details>
      )}
    </div>
  );
}
