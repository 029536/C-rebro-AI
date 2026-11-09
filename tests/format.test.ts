import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatDuration, formatOffset, formatTime } from "@/lib/format";

describe("formatTime", () => {
  it("converte de UTC para America/Sao_Paulo (UTC-3), não mostra o horário cru do servidor", () => {
    // 21:24 UTC é 18:24 em São Paulo — o bug relatado foi ver a hora em UTC direto.
    expect(formatTime("2026-03-05T21:24:00Z")).toBe("18:24");
  });
});

describe("formatDate", () => {
  it("formata no padrão brasileiro", () => {
    expect(formatDate("2026-03-05T21:24:00Z")).toBe("05/03/2026");
  });
});

describe("formatDateTime", () => {
  it("junta data e hora sem vírgula", () => {
    expect(formatDateTime("2026-03-05T21:24:00Z")).toBe("05/03/2026 18:24");
  });
});

describe("formatDuration", () => {
  it("mostra só minutos quando dá menos de uma hora", () => {
    expect(formatDuration(125)).toBe("2 min");
  });

  it("mostra horas e minutos quando passa de uma hora", () => {
    expect(formatDuration(3_900)).toBe("1h5min");
  });

  it("mostra só horas quando é exato", () => {
    expect(formatDuration(7_200)).toBe("2h");
  });

  it("devolve um traço quando não há duração", () => {
    expect(formatDuration(null)).toBe("—");
  });
});

describe("formatOffset", () => {
  it("mostra mm:ss abaixo de uma hora", () => {
    expect(formatOffset(125)).toBe("02:05");
  });

  it("mostra h:mm:ss a partir de uma hora", () => {
    expect(formatOffset(3_725)).toBe("1:02:05");
  });

  it("mostra 00:00 para zero", () => {
    expect(formatOffset(0)).toBe("00:00");
  });
});
