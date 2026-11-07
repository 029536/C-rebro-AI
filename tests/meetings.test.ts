import { describe, expect, it } from "vitest";
import { defaultMeetingTitle } from "@/lib/meetings";

describe("defaultMeetingTitle", () => {
  it("formata data e hora em America/Sao_Paulo, nao no fuso da maquina que roda o codigo", () => {
    // -03:00 fixo: o horário de verão foi extinto no Brasil em 2019.
    const title = defaultMeetingTitle(new Date("2026-03-05T14:30:00-03:00"));
    expect(title).toBe("Reunião 05/03/2026 14:30");
  });
});
