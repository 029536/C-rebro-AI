import { describe, expect, it } from "vitest";
import { sortMeetingSuggestions, type MeetingSuggestion } from "@/lib/meetings";

const meetings: MeetingSuggestion[] = [
  { id: "1", title: "Reunião 1", startedAt: "2026-11-01", clientName: "Dra. Marina", projectId: null },
  { id: "2", title: "Reunião 2", startedAt: "2026-11-02", clientName: "Outro cliente", projectId: "proj-a" },
  { id: "3", title: "Reunião 3", startedAt: "2026-11-03", clientName: "dra. marina", projectId: null },
  { id: "4", title: "Reunião 4", startedAt: "2026-11-04", clientName: null, projectId: null },
];

describe("sortMeetingSuggestions", () => {
  it("sem cliente nem projeto informados, mantém a ordem original", () => {
    expect(sortMeetingSuggestions(meetings, {})).toEqual(meetings);
    expect(sortMeetingSuggestions(meetings, { clientName: null, projectId: null })).toEqual(meetings);
    expect(sortMeetingSuggestions(meetings, { clientName: "   " })).toEqual(meetings);
  });

  it("coloca as reuniões do mesmo cliente primeiro, sem mudar a ordem relativa", () => {
    const result = sortMeetingSuggestions(meetings, { clientName: "Dra. Marina" });
    expect(result.map((m) => m.id)).toEqual(["1", "3", "2", "4"]);
  });

  it("compara o nome do cliente ignorando maiúsculas/minúsculas e espaços nas pontas", () => {
    const result = sortMeetingSuggestions(meetings, { clientName: "  DRA. MARINA  " });
    expect(result.map((m) => m.id)).toEqual(["1", "3", "2", "4"]);
  });

  it("sem nenhuma reunião do cliente, devolve a lista inteira sem reordenar", () => {
    const result = sortMeetingSuggestions(meetings, { clientName: "Cliente que nunca veio" });
    expect(result.map((m) => m.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("prioriza o mesmo projeto acima do mesmo cliente", () => {
    const result = sortMeetingSuggestions(meetings, { clientName: "Dra. Marina", projectId: "proj-a" });
    expect(result.map((m) => m.id)).toEqual(["2", "1", "3", "4"]);
  });
});
