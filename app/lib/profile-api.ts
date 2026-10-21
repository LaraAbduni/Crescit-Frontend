import { ApiError, isMockProfileApi, profileApi } from "./api";
import type { FinancialGoal, InvestorProfileResponse, InvestorType, QuestionnaireRequest } from "./profile";

/** POST na primeira vez, PUT quando o usuário refaz o questionário. */
export async function saveQuestionnaire(
  answers: QuestionnaireRequest,
  isUpdate: boolean,
): Promise<InvestorProfileResponse> {
  if (isMockProfileApi) return mockClassify(answers);
  if (isUpdate) return profileApi("PUT", "/profiles/questionnaire", answers);
  try {
    return await profileApi("POST", "/profiles/questionnaire", answers);
  } catch (e) {
    // 409: o usuário já respondeu antes (ex.: em outro dispositivo), então atualiza
    if (e instanceof ApiError && e.status === 409) {
      return profileApi("PUT", "/profiles/questionnaire", answers);
    }
    throw e;
  }
}

// Espelha o ProfileClassificationService do backend.
function mockClassify(a: QuestionnaireRequest): InvestorProfileResponse {
  const goal: Record<FinancialGoal, number> = {
    EMERGENCY_RESERVE: 0,
    PRESERVE_CAPITAL: 0,
    GENERATE_INCOME: 1,
    RETIREMENT: 1,
    BUILD_WEALTH: 2,
  };
  const score =
    goal[a.financialGoal] +
    { LOW: 0, MEDIUM: 2, HIGH: 4 }[a.riskTolerance] +
    { SHORT_TERM: 0, MEDIUM_TERM: 1, LONG_TERM: 2 }[a.investmentHorizon] +
    (a.hasEmergencyReserve ? 1 : 0) +
    { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 }[a.experienceLevel];
  const investorType: InvestorType =
    score >= 9 ? "AGGRESSIVE" : score >= 5 ? "MODERATE" : "CONSERVATIVE";
  const now = new Date().toISOString();
  return {
    id: "demo",
    userId: "demo",
    investorType,
    score,
    createdAt: now,
    updatedAt: now,
  };
}
