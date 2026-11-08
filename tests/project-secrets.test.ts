import { describe, expect, it } from "vitest";
import { detectSecret } from "@/lib/projects/secrets";

describe("detectSecret", () => {
  it("rejeita pelo nome de arquivo .env e variações", () => {
    expect(detectSecret({ path: ".env", content: "" })).not.toBeNull();
    expect(detectSecret({ path: ".env.local", content: "" })).not.toBeNull();
    expect(detectSecret({ path: "config/.env.production", content: "" })).not.toBeNull();
  });

  it("não confunde 'environment.ts' com .env", () => {
    expect(detectSecret({ path: "src/environment.ts", content: "export const x = 1;" })).toBeNull();
  });

  it("rejeita blocos de chave privada", () => {
    expect(
      detectSecret({ content: "-----BEGIN RSA PRIVATE KEY-----\nMIIB...\n-----END RSA PRIVATE KEY-----" })
    ).not.toBeNull();
  });

  it("rejeita padrões conhecidos de chave de API no conteúdo", () => {
    expect(detectSecret({ content: "ANTHROPIC_API_KEY=sk-ant-abcdef1234567890" })).not.toBeNull();
    expect(detectSecret({ content: "aws_key = AKIAABCDEFGHIJKLMNOP" })).not.toBeNull();
    expect(detectSecret({ content: "token: ghp_abcdefghijklmnopqrstuvwxyz012345" })).not.toBeNull();
  });

  it("não rejeita texto comum", () => {
    expect(detectSecret({ path: "src/app/page.tsx", content: "export default function Page() {}" })).toBeNull();
  });

  it("não exige path (texto de documento)", () => {
    expect(detectSecret({ content: "Ata da reunião de 05/11." })).toBeNull();
    expect(detectSecret({ content: "senha do banco: -----BEGIN PRIVATE KEY-----" })).not.toBeNull();
  });
});
