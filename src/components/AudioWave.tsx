"use client";

import { useEffect, useRef, useState } from "react";

const BAR_COUNT = 32;
const MIN_LEVEL = 0.08;

type Levels = { accent: number[]; record: number[] };

function restingLevels(): Levels {
  return {
    accent: Array<number>(BAR_COUNT).fill(MIN_LEVEL),
    record: Array<number>(BAR_COUNT).fill(MIN_LEVEL),
  };
}

/**
 * Onda de áudio em duas camadas (azul e coral), de borda a borda, reagindo
 * ao volume real do microfone via Web Audio (AnalyserNode) — não é coberta
 * por teste automatizado (áudio real, ver checklist manual no CLAUDE.md).
 * Parada e esmaecida quando `active` é falso (sem gravação ou pausada) ou
 * quando o navegador prefere menos movimento.
 */
export function AudioWave({ stream, active }: { stream: MediaStream | null; active: boolean }) {
  const [levels, setLevels] = useState<Levels>(restingLevels);
  const frameRef = useRef<number | null>(null);
  const canAnalyse = Boolean(stream && active && typeof window !== "undefined" && "AudioContext" in window);

  useEffect(() => {
    if (!canAnalyse || !stream) {
      return;
    }

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const step = Math.max(1, Math.floor(data.length / BAR_COUNT));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function readLevels(): Levels {
      analyser.getByteFrequencyData(data);
      const accent: number[] = [];
      const record: number[] = [];
      for (let i = 0; i < BAR_COUNT; i++) {
        const value = Math.max(MIN_LEVEL, (data[i * step] ?? 0) / 255);
        accent.push(value);
        record.push(Math.max(MIN_LEVEL, value * 0.75));
      }
      return { accent, record };
    }

    function tick() {
      setLevels(readLevels());
      if (!reduceMotion) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }
    tick();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      source.disconnect();
      analyser.disconnect();
      audioContext.close().catch(() => {});
    };
  }, [stream, canAnalyse]);

  const displayLevels = canAnalyse ? levels : restingLevels();

  return (
    <div className="relative flex h-24 w-full items-center justify-between" aria-hidden="true">
      <div className="absolute flex h-full w-full items-center justify-between">
        {displayLevels.record.map((level, i) => (
          <span
            key={`record-${i}`}
            className="w-[3px] rounded-full bg-record/70 transition-[height] duration-100 ease-out"
            style={{ height: `${10 + level * 64}px` }}
          />
        ))}
      </div>
      <div className="absolute flex h-full w-full items-center justify-between mix-blend-multiply">
        {displayLevels.accent.map((level, i) => (
          <span
            key={`accent-${i}`}
            className="w-[3px] rounded-full bg-accent transition-[height] duration-100 ease-out"
            style={{ height: `${10 + level * 72}px` }}
          />
        ))}
      </div>
      <span
        className="pointer-events-none absolute inset-0 transition-opacity"
        style={{ opacity: active ? 0 : 0.55, background: "var(--background)" }}
      />
    </div>
  );
}
