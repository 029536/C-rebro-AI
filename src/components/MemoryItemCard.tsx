"use client";

import { Check, Lock, Trash2, Unlock } from "lucide-react";
import { useState } from "react";

export type MemoryItemRow = {
  id: string;
  tipo: "decisao" | "pendencia" | "estado" | "risco";
  texto: string;
  travado: boolean;
  resolvido: boolean;
  origem_meeting_title: string | null;
  created_at: string;
};

export function MemoryItemCard({
  item,
  onUpdate,
  onDelete,
}: {
  item: MemoryItemRow;
  onUpdate: (patch: Partial<Pick<MemoryItemRow, "texto" | "travado" | "resolvido">>) => void;
  onDelete: () => void;
}) {
  const [texto, setTexto] = useState(item.texto);

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border p-3 ${
        item.resolvido ? "border-border bg-background opacity-60" : "border-border bg-surface"
      }`}
    >
      <textarea
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        onBlur={() => {
          if (texto.trim() && texto.trim() !== item.texto) onUpdate({ texto: texto.trim() });
        }}
        rows={2}
        disabled={item.travado}
        className="resize-none bg-transparent text-sm text-text outline-none disabled:text-text"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">
          {item.origem_meeting_title ? `Via ${item.origem_meeting_title}` : "Adicionado manualmente"}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onUpdate({ travado: !item.travado })}
            aria-label={item.travado ? "Destravar item" : "Travar item"}
            className={item.travado ? "text-accent" : "text-text-secondary"}
          >
            {item.travado ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
          {!item.resolvido && (
            <button
              type="button"
              onClick={() => onUpdate({ resolvido: true })}
              aria-label="Marcar resolvido"
              className="text-text-secondary"
            >
              <Check size={16} />
            </button>
          )}
          <button type="button" onClick={onDelete} aria-label="Excluir item" className="text-record">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
