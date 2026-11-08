import { describe, expect, it } from "vitest";
import { sortMeetingSuggestions, type MeetingSuggestion } from "@/lib/meetings";

const meetings: MeetingSuggestion[] = [
  { id: "1", title: "Reunião 1", startedAt: "2026-11-01", clientName: "Dra. Marina" },
  { id: "2", title: "Reunião 2", startedAt: "2026-11-02", clientName: "Outro cliente" },
  { id: "3", title: "Reunião 3", startedAt: "2026-11-03", clientName: "dra. marina" },
  { id: "4", title: "Reunião 4", startedAt: "2026-11-04", clientName: null },
];

describe("sortMeetingSuggestions", () => {
  it("sem cliente informado, mantém a ordem original", () => {
    expect(sortMeetingSuggestions(meetings, null)).toEqual(meetings);
    expect(sortMeetingSuggestions(meetings, undefined)).toEqual(meetings);
    expect(sortMeetingSuggestions(meetings, "   ")).toEqual(meetings);
  });

  it("coloca as reuniões do mesmo cliente primeiro, sem mudar a ordem relativa", () => {
    const result = sortMeetingSuggestions(meetings, "Dra. Marina");
    expect(result.map((m) => m.id)).toEqual(["1", "3", "2", "4"]);
  });

  it("compara o nome do cliente ignorando maiúsculas/minúsculas e espaços nas pontas", () => {
    const result = sortMeetingSuggestions(meetings, "  DRA. MARINA  ");
    expect(result.map((m) => m.id)).toEqual(["1", "3", "2", "4"]);
  });

  it("sem nenhuma reunião do cliente, devolve a lista inteira sem reordenar", () => {
    const result = sortMeetingSuggestions(meetings, "Cliente que nunca veio");
    expect(result.map((m) => m.id)).toEqual(["1", "2", "3", "4"]);
  });
});
