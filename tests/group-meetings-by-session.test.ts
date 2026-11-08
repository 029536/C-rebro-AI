import { describe, expect, it } from "vitest";
import { groupMeetingsBySession } from "@/lib/meetings";

describe("groupMeetingsBySession", () => {
  it("agrupa reuniões ligadas em cadeia na mesma sessão", () => {
    const groups = groupMeetingsBySession(
      ["a", "b", "c"],
      [
        { meetingId: "b", previousMeetingId: "a" },
        { meetingId: "c", previousMeetingId: "b" },
      ]
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.sort()).toEqual(["a", "b", "c"]);
  });

  it("mantém reuniões sem ligação de sessão em grupos separados", () => {
    const groups = groupMeetingsBySession(["a", "b"], []);
    expect(groups).toHaveLength(2);
  });

  it("ignora ligações para ids fora da lista (por exemplo, de outro filtro)", () => {
    const groups = groupMeetingsBySession(
      ["a", "b"],
      [{ meetingId: "b", previousMeetingId: "outro-id-nao-listado" }]
    );
    expect(groups).toHaveLength(2);
  });

  it("não confunde ligação de contexto com ligação de sessão (o chamador já filtra por link_type)", () => {
    // groupMeetingsBySession só recebe as arestas que o chamador decidiu passar;
    // aqui simulamos o caso em que nenhuma delas é de sessão.
    const groups = groupMeetingsBySession(["a", "b"], []);
    expect(groups).toHaveLength(2);
  });
});
