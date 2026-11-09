import { describe, expect, it } from "vitest";
import { deriveMeetingChips } from "@/lib/meetings";

describe("deriveMeetingChips", () => {
  it("mostra só 'Em andamento' para uma reunião gravando, mesmo que já tenha ata/parecer de uma versão anterior", () => {
    expect(
      deriveMeetingChips({ meetingStatus: "recording", hasReadyMinutes: true, hasAnalysis: true })
    ).toEqual(["andamento"]);
  });

  it("mostra Ata gerada e Parecer disponível juntos quando a reunião tem os dois", () => {
    expect(
      deriveMeetingChips({ meetingStatus: "ready", hasReadyMinutes: true, hasAnalysis: true })
    ).toEqual(["ata", "parecer"]);
  });

  it("mostra só Ata gerada quando ainda não há parecer", () => {
    expect(
      deriveMeetingChips({ meetingStatus: "ready", hasReadyMinutes: true, hasAnalysis: false })
    ).toEqual(["ata"]);
  });

  it("não mostra nenhum selo para uma reunião encerrada sem ata nem parecer ainda", () => {
    expect(
      deriveMeetingChips({ meetingStatus: "ready", hasReadyMinutes: false, hasAnalysis: false })
    ).toEqual([]);
  });
});
