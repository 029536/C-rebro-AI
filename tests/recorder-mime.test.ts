import { describe, expect, it } from "vitest";
import { pickRecorderMime } from "@/lib/recorder/mime";

describe("pickRecorderMime", () => {
  it("escolhe webm/opus quando o navegador suporta (Chrome/Android)", () => {
    const supported = new Set(["audio/webm;codecs=opus", "audio/webm"]);
    const result = pickRecorderMime((mimeType) => supported.has(mimeType));
    expect(result).toEqual({ mimeType: "audio/webm;codecs=opus", extension: "webm" });
  });

  it("cai para mp4/AAC quando só isso é suportado (Safari/iPhone)", () => {
    const supported = new Set(["audio/mp4;codecs=mp4a.40.2", "audio/mp4"]);
    const result = pickRecorderMime((mimeType) => supported.has(mimeType));
    expect(result).toEqual({ mimeType: "audio/mp4;codecs=mp4a.40.2", extension: "mp4" });
  });

  it("devolve null se nada for suportado", () => {
    const result = pickRecorderMime(() => false);
    expect(result).toBeNull();
  });
});
