import { afterEach, describe, expect, it, vi } from "vitest";
import { generateProjectMemoryChanges } from "@/lib/ai/projectMemory";
import { AnthropicKeyMissingError } from "@/lib/ai/anthropic";
import { memoryChangeSchema } from "@/lib/projects/memorySchema";

afterEach(() => {
  vi.unstubAllEnvs();
});

const BASE_PARAMS = { currentItemsBlock: null, meetingTitle: "Reunião de teste" };

describe("generateProjectMemoryChanges", () => {
  it("com MOCK_AI=1 nunca toca no cliente da Anthropic e devolve uma diferença válida", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "1");
    const change = await generateProjectMemoryChanges(BASE_PARAMS);
    expect(memoryChangeSchema.safeParse(change).success).toBe(true);
  });

  it("sem MOCK_AI e sem chave, propaga AnthropicKeyMissingError para o chamador tratar", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MOCK_AI", "0");
    await expect(generateProjectMemoryChanges(BASE_PARAMS)).rejects.toThrow(AnthropicKeyMissingError);
  });
});
