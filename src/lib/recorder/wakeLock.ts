export type WakeLockHandle = {
  release: () => Promise<void>;
};

/**
 * Pede para a tela não apagar durante a gravação. Em navegadores sem suporte
 * (ou se o pedido falhar, por exemplo com a aba em segundo plano), devolve
 * null — o chamador mostra o aviso de manter a tela ligada de qualquer forma.
 */
export async function requestWakeLock(): Promise<WakeLockHandle | null> {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
    return null;
  }

  try {
    const sentinel = await navigator.wakeLock.request("screen");
    return {
      release: async () => {
        try {
          await sentinel.release();
        } catch {
          // Já liberado (por exemplo, a aba foi para segundo plano sozinha).
        }
      },
    };
  } catch {
    return null;
  }
}
