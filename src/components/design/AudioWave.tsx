const BAR_COUNT = 28;

// Alturas geradas por seno (determinístico — nada de Math.random, que
// quebraria a renderização no servidor x no navegador). Quando a gravação
// de verdade for ligada, isso vira AnalyserNode (Web Audio), reagindo ao
// volume do microfone — aqui é só a prévia visual.
function barHeight(index: number, amplitude: number, phase: number): number {
  const base = 10 + amplitude * (0.5 + 0.5 * Math.sin(index / 2.2 + phase));
  return Math.round(base);
}

/**
 * Onda de áudio em duas camadas (azul e coral), como no mockup. Decorativa
 * nesta prévia estática; respeita prefers-reduced-motion (ver globals.css,
 * .design-wave-bar) ficando parada numa altura média em vez de animar.
 */
export function AudioWave() {
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => ({
    accent: barHeight(i, 34, 0),
    record: barHeight(i, 26, 1.1),
  }));

  return (
    <div className="relative flex h-24 items-center justify-center" aria-hidden="true">
      <div className="absolute flex h-full items-center gap-1">
        {bars.map((bar, i) => (
          <span
            key={`record-${i}`}
            className="design-wave-bar w-1 rounded-full bg-design-record/70"
            style={{ height: `${bar.record}px`, animationDelay: `${i * 0.035}s` }}
          />
        ))}
      </div>
      <div className="absolute flex h-full items-center gap-1 mix-blend-multiply">
        {bars.map((bar, i) => (
          <span
            key={`accent-${i}`}
            className="design-wave-bar w-1 rounded-full bg-design-accent"
            style={{ height: `${bar.accent}px`, animationDelay: `${i * 0.035 + 0.12}s` }}
          />
        ))}
      </div>
    </div>
  );
}
