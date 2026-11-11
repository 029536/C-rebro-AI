import { describe, expect, it } from "vitest";
import { buildSessionChain } from "@/lib/meetings";

describe("buildSessionChain", () => {
  it("devolve só o ponto de partida quando não há nenhuma ligação de sessão", () => {
    expect(buildSessionChain([], "a")).toEqual(["a"]);
  });

  it("anda para trás (sessões mais antigas) a partir de qualquer ponto da corrente", () => {
    const edges = [
      { meetingId: "b", previousMeetingId: "a" },
      { meetingId: "c", previousMeetingId: "b" },
    ];
    expect(buildSessionChain(edges, "c")).toEqual(["a", "b", "c"]);
  });

  it("anda para a frente (sessões mais novas) a partir de qualquer ponto da corrente", () => {
    const edges = [
      { meetingId: "b", previousMeetingId: "a" },
      { meetingId: "c", previousMeetingId: "b" },
    ];
    expect(buildSessionChain(edges, "a")).toEqual(["a", "b", "c"]);
  });

  it("resolve a corrente inteira mesmo partindo do meio", () => {
    const edges = [
      { meetingId: "b", previousMeetingId: "a" },
      { meetingId: "c", previousMeetingId: "b" },
      { meetingId: "d", previousMeetingId: "c" },
    ];
    expect(buildSessionChain(edges, "b")).toEqual(["a", "b", "c", "d"]);
  });

  it("ignora ligações de outras correntes", () => {
    const edges = [
      { meetingId: "b", previousMeetingId: "a" },
      { meetingId: "y", previousMeetingId: "x" },
    ];
    expect(buildSessionChain(edges, "a")).toEqual(["a", "b"]);
  });
});
