import { describe, expect, it } from "vitest";
import { defaultMeetingTitle } from "@/lib/meetings";

describe("defaultMeetingTitle", () => {
  it("formata data e hora em português", () => {
    const title = defaultMeetingTitle(new Date("2026-03-05T14:30:00"));
    expect(title).toBe("Reunião 05/03/2026 14:30");
  });
});
