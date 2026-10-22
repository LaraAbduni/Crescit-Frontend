import { describe, expect, it, vi } from "vitest";
import { ApiError, profileApi } from "./api";
import { getProfile, saveQuestionnaire } from "./profile-api";
import type { QuestionnaireRequest } from "./profile";

vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), profileApi: vi.fn() }));
const api = vi.mocked(profileApi);
const answers: QuestionnaireRequest = { financialGoal: "BUILD_WEALTH", riskTolerance: "HIGH", investmentHorizon: "LONG_TERM", hasEmergencyReserve: true, experienceLevel: "ADVANCED" };

describe("contrato de perfil", () => {
  it("recupera o perfil usando o sub codificado", async () => {
    api.mockResolvedValueOnce({ userId: "auth0|123" });
    await expect(getProfile("auth0|123")).resolves.toEqual({ userId: "auth0|123" });
    expect(api).toHaveBeenCalledWith("GET", "/profiles/auth0%7C123");
  });
  it("trata somente 404 como primeiro acesso", async () => {
    api.mockRejectedValueOnce(new ApiError(404, "not found"));
    await expect(getProfile("auth0|123")).resolves.toBeUndefined();
    api.mockRejectedValueOnce(new ApiError(403, "forbidden"));
    await expect(getProfile("auth0|123")).rejects.toMatchObject({ status: 403 });
  });
  it("recusa um perfil de outra conta", async () => {
    api.mockResolvedValueOnce({ userId: "auth0|outra" });
    await expect(getProfile("auth0|123")).rejects.toMatchObject({ status: 403 });
  });
  it("usa PUT depois de um conflito, sem enviar userId no corpo", async () => {
    api.mockRejectedValueOnce(new ApiError(409, "exists")).mockResolvedValueOnce({ score: 11 });
    await expect(saveQuestionnaire(answers, false)).resolves.toEqual({ score: 11 });
    expect(api.mock.calls).toEqual([["POST", "/profiles/questionnaire", answers], ["PUT", "/profiles/questionnaire", answers]]);
  });
  it("não transforma uma falha de permissão em atualização", async () => {
    api.mockRejectedValueOnce(new ApiError(403, "forbidden"));
    await expect(saveQuestionnaire(answers, false)).rejects.toMatchObject({ status: 403 });
    expect(api).toHaveBeenCalledTimes(1);
  });
  it("atualiza diretamente ao refazer o questionário", async () => {
    api.mockResolvedValueOnce({ score: 11 });
    await saveQuestionnaire(answers, true);
    expect(api).toHaveBeenCalledWith("PUT", "/profiles/questionnaire", answers);
  });
});
