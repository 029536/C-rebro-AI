import { describe, expect, it } from "vitest";
import { formatISODate } from "@/lib/format";

describe("formatISODate", () => {
  it("formata em AAAA-MM-DD, convertendo de UTC para America/Sao_Paulo", () => {
    // 02:00 UTC do dia 9 é 23:00 do dia 8 em São Paulo (UTC-3) — muda o dia.
    expect(formatISODate("2026-11-09T02:00:00Z")).toBe("2026-11-08");
  });

  it("mantém o dia quando o horário em UTC já cai dentro do mesmo dia em São Paulo", () => {
    expect(formatISODate("2026-11-08T14:00:00Z")).toBe("2026-11-08");
  });
});
