"use client";

import { useState } from "react";

export type UserSettings = { default_auto_opine: boolean; chunk_seconds: number };

/** Configurações simples do Perfil: padrão do "Opinar automaticamente" e intervalo dos trechos. */
export function UserSettingsForm({ initial }: { initial: UserSettings }) {
  const [settings, setSettings] = useState(initial);
  const [saved, setSaved] = useState(false);

  async function update(patch: Partial<UserSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaved(false);
    const response = await fetch("/api/user-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (response.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
        Configurações de gravação
      </p>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-text">Claude opina sozinho, por padrão</p>
          <p className="text-xs text-text-secondary">
            Vale para a próxima vez que você gravar num aparelho novo (depois, o interruptor
            lembra sua última escolha).
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.default_auto_opine}
          onClick={() => update({ default_auto_opine: !settings.default_auto_opine })}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
            settings.default_auto_opine ? "bg-accent" : "bg-border"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
              settings.default_auto_opine ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div>
        <p className="text-text">Intervalo dos trechos de áudio</p>
        <p className="text-xs text-text-secondary">
          Entre 15 e 60 segundos — trechos mais curtos deixam a transcrição mais ao vivo; mais
          longos, mais econômicos.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={15}
            max={60}
            step={1}
            value={settings.chunk_seconds}
            onChange={(event) => setSettings({ ...settings, chunk_seconds: Number(event.target.value) })}
            onPointerUp={() => update({ chunk_seconds: settings.chunk_seconds })}
            className="flex-1"
          />
          <span className="w-12 text-right text-sm font-semibold text-text">{settings.chunk_seconds}s</span>
        </div>
      </div>

      {saved && <p className="text-xs font-semibold text-accent">Salvo.</p>}
    </div>
  );
}
