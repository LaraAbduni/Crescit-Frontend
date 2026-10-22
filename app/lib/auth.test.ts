import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./auth";

describe("retorno após o login", () => {
  it.each([undefined, "https://example.com", "//example.com", "/\\example.com", "/\nexample.com"])("rejeita destino externo ou inválido: %s", (value) => {
    expect(safeReturnTo(value)).toBe("/inicio");
  });
  it("preserva a rota interna que o usuário estava acessando", () => {
    expect(safeReturnTo("/perfil/questionario?pergunta=3")).toBe("/perfil/questionario?pergunta=3");
  });
});
