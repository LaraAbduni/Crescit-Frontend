import { ApiError, profileApi } from "./api";
import type { InvestorProfileResponse, QuestionnaireRequest } from "./profile";

/** 404 significa primeiro acesso; erros de autenticação e rede são preservados. */
export async function getProfile(userId: string): Promise<InvestorProfileResponse | undefined> {
  try {
    const profile = await profileApi<InvestorProfileResponse>("GET", `/profiles/${encodeURIComponent(userId)}`);
    if (profile.userId !== userId) throw new ApiError(403, "O perfil recebido não pertence à sua conta.");
    return profile;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return undefined;
    throw e;
  }
}

/** POST na primeira vez, PUT ao refazer ou quando outro dispositivo já criou o perfil. */
export async function saveQuestionnaire(answers: QuestionnaireRequest, isUpdate: boolean): Promise<InvestorProfileResponse> {
  if (isUpdate) return profileApi("PUT", "/profiles/questionnaire", answers);
  try {
    return await profileApi("POST", "/profiles/questionnaire", answers);
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return profileApi("PUT", "/profiles/questionnaire", answers);
    throw e;
  }
}
