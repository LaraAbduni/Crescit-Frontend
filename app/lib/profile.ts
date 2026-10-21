// Questionário de suitability e perfis do investidor. Os valores enviados ao
// backend são os enums do Serviço de Perfil (Crescit-PerfilDeInvestidor/model/enums).

export type FinancialGoal =
  | "EMERGENCY_RESERVE"
  | "PRESERVE_CAPITAL"
  | "GENERATE_INCOME"
  | "BUILD_WEALTH"
  | "RETIREMENT";
export type RiskTolerance = "LOW" | "MEDIUM" | "HIGH";
export type InvestmentHorizon = "SHORT_TERM" | "MEDIUM_TERM" | "LONG_TERM";
export type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type InvestorType = "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";

/** Corpo de POST/PUT /profiles/questionnaire. */
export interface QuestionnaireRequest {
  financialGoal: FinancialGoal;
  riskTolerance: RiskTolerance;
  investmentHorizon: InvestmentHorizon;
  hasEmergencyReserve: boolean;
  experienceLevel: ExperienceLevel;
}

/** Resposta de POST/PUT /profiles/questionnaire e GET /profiles/{userId}. */
export interface InvestorProfileResponse {
  id: string;
  userId: string;
  investorType: InvestorType;
  score: number;
  createdAt: string;
  updatedAt: string;
}

// --- Perguntas -----------------------------------------------------------

export type QuestionId = "goal" | "horizon" | "income" | "wealth" | "reserve" | "products" | "lossReaction";

/** Respostas do questionário: um valor por pergunta (ou vários, nas de múltipla escolha). */
export type Responses = Partial<Record<QuestionId, string | string[]>>;

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
  /** Desmarca as demais opções (ex.: "Nunca investi"). */
  exclusive?: boolean;
}

export interface Question {
  id: QuestionId;
  eyebrow: string;
  title: string;
  hint?: string;
  multiple?: boolean;
  options: QuestionOption[];
}

export const QUESTIONS: Question[] = [
  {
    id: "goal",
    eyebrow: "Objetivo",
    title: "Qual é o seu principal objetivo ao investir?",
    options: [
      { value: "EMERGENCY_RESERVE", label: "Montar minha reserva de emergência", description: "Ter dinheiro guardado para imprevistos" },
      { value: "PRESERVE_CAPITAL", label: "Preservar o que já tenho", description: "Proteger da inflação, sem correr riscos" },
      { value: "GENERATE_INCOME", label: "Gerar renda extra", description: "Receber rendimentos todo mês" },
      { value: "BUILD_WEALTH", label: "Construir patrimônio", description: "Fazer o dinheiro crescer no longo prazo" },
      { value: "RETIREMENT", label: "Planejar a aposentadoria", description: "Acumular com calma para o futuro" },
    ],
  },
  {
    id: "horizon",
    eyebrow: "Prazo",
    title: "Por quanto tempo você pretende manter seus investimentos?",
    options: [
      { value: "SHORT_TERM", label: "Menos de 1 ano", description: "Posso precisar do dinheiro em breve" },
      { value: "MEDIUM_TERM", label: "Entre 1 e 5 anos", description: "Tenho planos para os próximos anos" },
      { value: "LONG_TERM", label: "Mais de 5 anos", description: "Não pretendo mexer tão cedo" },
    ],
  },
  {
    id: "income",
    eyebrow: "Situação financeira",
    title: "Qual é a sua renda mensal?",
    options: [
      { value: "UP_TO_3K", label: "Até R$ 3.000" },
      { value: "3K_TO_10K", label: "De R$ 3.000 a R$ 10.000" },
      { value: "10K_TO_30K", label: "De R$ 10.000 a R$ 30.000" },
      { value: "OVER_30K", label: "Mais de R$ 30.000" },
    ],
  },
  {
    id: "wealth",
    eyebrow: "Situação financeira",
    title: "Quanto você tem investido hoje, somando tudo?",
    options: [
      { value: "UP_TO_10K", label: "Até R$ 10 mil" },
      { value: "10K_TO_100K", label: "De R$ 10 mil a R$ 100 mil" },
      { value: "100K_TO_1M", label: "De R$ 100 mil a R$ 1 milhão" },
      { value: "OVER_1M", label: "Mais de R$ 1 milhão" },
    ],
  },
  {
    id: "reserve",
    eyebrow: "Reserva",
    title: "Você tem uma reserva para emergências?",
    options: [
      { value: "YES", label: "Sim, já tenho", description: "Cobre pelo menos 6 meses dos meus gastos" },
      { value: "NO", label: "Ainda não", description: "Ou ela ainda não cobre 6 meses de gastos" },
    ],
  },
  {
    id: "products",
    eyebrow: "Experiência",
    title: "Em quais destes produtos você já investiu?",
    hint: "Pode marcar mais de um.",
    multiple: true,
    options: [
      { value: "SAVINGS", label: "Poupança" },
      { value: "FIXED_INCOME", label: "Renda fixa", description: "Tesouro Direto, CDB, LCI, LCA" },
      { value: "FUNDS", label: "Fundos de investimento", description: "Renda fixa, multimercado" },
      { value: "VARIABLE_INCOME", label: "Renda variável", description: "Ações, FIIs, ETFs" },
      { value: "DERIVATIVES", label: "Derivativos ou criptoativos", description: "Opções, futuros, bitcoin" },
      { value: "NONE", label: "Nunca investi", exclusive: true },
    ],
  },
  {
    id: "lossReaction",
    eyebrow: "Risco",
    title: "Seus investimentos caíram 10% em um mês. O que você faz?",
    options: [
      { value: "LOW", label: "Resgato tudo", description: "Prefiro não ver meu dinheiro diminuir" },
      { value: "MEDIUM", label: "Mantenho e espero recuperar", description: "Oscilações fazem parte" },
      { value: "HIGH", label: "Aproveito para investir mais", description: "Quedas são oportunidades de compra" },
    ],
  },
];

export function isAnswered(q: Question, responses: Responses) {
  const r = responses[q.id];
  return Array.isArray(r) ? r.length > 0 : r !== undefined;
}

export const isComplete = (responses: Responses) => QUESTIONS.every((q) => isAnswered(q, responses));

/** Nível de experiência a partir dos produtos que a pessoa já usou. */
function experienceFrom(products: string[]): ExperienceLevel {
  if (products.includes("VARIABLE_INCOME") || products.includes("DERIVATIVES")) return "ADVANCED";
  if (products.includes("FIXED_INCOME") || products.includes("FUNDS")) return "INTERMEDIATE";
  return "BEGINNER";
}

/**
 * Converte as respostas no corpo esperado pelo backend. Renda e patrimônio
 * ainda não são enviados: o Serviço de Perfil só pontua os 5 campos abaixo.
 */
export function toQuestionnaireRequest(r: Responses): QuestionnaireRequest {
  return {
    financialGoal: r.goal as FinancialGoal,
    investmentHorizon: r.horizon as InvestmentHorizon,
    riskTolerance: r.lossReaction as RiskTolerance,
    hasEmergencyReserve: r.reserve === "YES",
    experienceLevel: experienceFrom((r.products as string[] | undefined) ?? []),
  };
}

// --- Perfis --------------------------------------------------------------

// Mesmas faixas do ProfileClassificationService (pontuação máxima 11).
export const MAX_SCORE = 11;

export const INVESTOR_TYPES: Record<
  InvestorType,
  { label: string; range: [number, number]; description: string }
> = {
  CONSERVATIVE: {
    label: "Conservador",
    range: [0, 4],
    description:
      "Você prioriza segurança e liquidez: prefere ver o dinheiro crescer devagar a correr o risco de perder parte dele.",
  },
  MODERATE: {
    label: "Moderado",
    range: [5, 8],
    description:
      "Você busca equilíbrio: aceita alguma oscilação para fazer o patrimônio crescer, sem abrir mão de uma base segura.",
  },
  AGGRESSIVE: {
    label: "Sofisticado",
    range: [9, MAX_SCORE],
    description:
      "Você conhece o mercado, pensa no longo prazo e aceita oscilações maiores em busca de retornos acima da média.",
  },
};

/** Etiquetas curtas mostradas no resultado (ex.: "Médio prazo"). */
export function answerTags(r: Responses): string[] {
  const req = toQuestionnaireRequest(r);
  const goal: Record<FinancialGoal, string> = {
    EMERGENCY_RESERVE: "Objetivo: reserva",
    PRESERVE_CAPITAL: "Objetivo: preservar",
    GENERATE_INCOME: "Objetivo: renda",
    BUILD_WEALTH: "Objetivo: patrimônio",
    RETIREMENT: "Objetivo: aposentadoria",
  };
  const horizon: Record<InvestmentHorizon, string> = {
    SHORT_TERM: "Curto prazo",
    MEDIUM_TERM: "Médio prazo",
    LONG_TERM: "Longo prazo",
  };
  const risk: Record<RiskTolerance, string> = {
    LOW: "Tolerância baixa",
    MEDIUM: "Tolerância média",
    HIGH: "Tolerância alta",
  };
  const experience: Record<ExperienceLevel, string> = {
    BEGINNER: "Iniciante",
    INTERMEDIATE: "Experiência em renda fixa",
    ADVANCED: "Experiência em renda variável",
  };
  return [
    goal[req.financialGoal],
    horizon[req.investmentHorizon],
    risk[req.riskTolerance],
    req.hasEmergencyReserve ? "Tem reserva" : "Sem reserva",
    experience[req.experienceLevel],
  ];
}
