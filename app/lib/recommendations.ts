import { recommendationsApi } from "./api";
import type { RateType } from "./fixed-income";
import type { InvestorType } from "./profile";

// Valores dos enums do Serviço de Recomendações (entity/AssetType e RiskLevel).
// FUND só existe no Serviço de Portfólio: fundos são cadastrados pelo usuário.
export type AssetType = "STOCK" | "FII" | "ETF" | "FIXED_INCOME" | "FUND";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

/** RecommendationResponseDto */
export interface Recommendation {
  id: string;
  userId: string;
  assetId: string;
  ticker: string;
  assetName: string;
  assetType: AssetType;
  riskLevel: RiskLevel;
  currentPrice: number;
  investorType: InvestorType;
  compatibilityScore: number;
  reason: string;
  createdAt: string;
}

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  STOCK: "Ação",
  FII: "FII",
  ETF: "ETF",
  FIXED_INCOME: "Renda fixa",
  FUND: "Fundo",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: "Risco baixo",
  MEDIUM: "Risco médio",
  HIGH: "Risco alto",
};

/** Níveis de risco que cada estratégia do backend recomenda. */
export const RISK_SCOPE: Record<InvestorType, string> = {
  CONSERVATIVE: "risco baixo",
  MODERATE: "risco baixo e médio",
  AGGRESSIVE: "todos os níveis de risco",
};

// O "reason" do backend é genérico ("Ativo compativel com perfil moderado"),
// então o card mostra uma explicação curta por tipo de ativo.
export const ASSET_TYPE_DESCRIPTION: Record<AssetType, string> = {
  FIXED_INCOME: "Baixa oscilação e rendimento previsível: uma base segura para a carteira.",
  ETF: "Diversifica em vários ativos com uma única compra.",
  FII: "Renda mensal de aluguéis de imóveis, sem precisar comprar um imóvel.",
  STOCK: "Participação direta em uma empresa, com potencial de valorização no longo prazo.",
  FUND: "Um gestor profissional escolhe os ativos: diversifica sem precisar escolher cada um.",
};

/** Explicação curta de cada nível de risco, para a tela de detalhe. */
export const RISK_EXPLANATION: Record<RiskLevel, string> = {
  LOW: "Oscila pouco. Adequado para todos os perfis, inclusive para a reserva de emergência.",
  MEDIUM: "Pode ter altos e baixos no curto prazo. Indicado para objetivos de alguns anos.",
  HIGH: "Pode variar bastante, para cima e para baixo. Só para quem aceita oscilações e pensa no longo prazo.",
};

/**
 * Busca as recomendações salvas. Gera de novo quando ainda não existem
 * (primeiro acesso), quando o perfil mudou ou quando o catálogo ganhou
 * ativos depois da última geração.
 */
export async function getRecommendations(userId: string, investorType: InvestorType): Promise<Recommendation[]> {
  const id = encodeURIComponent(userId);
  let list = await recommendationsApi<Recommendation[]>("GET", `/recommendations/${id}`);
  let stale = list.length === 0 || list[0].investorType !== investorType;
  if (!stale) {
    const generatedAt = list.reduce((max, r) => (r.createdAt > max ? r.createdAt : max), "");
    const catalog = await getAssets().catch(() => []);
    stale = catalog.some((a) => a.active && a.createdAt && a.createdAt > generatedAt);
  }
  if (stale) {
    list = await recommendationsApi<Recommendation[]>("POST", `/recommendations/${id}/generate`);
  }
  return sortByCompatibility(list);
}

/** entity/Asset (campos usados pelo front) */
export interface Asset {
  ticker: string;
  name: string;
  assetType: AssetType;
  riskLevel: RiskLevel;
  currentPrice: number;
  active: boolean;
  sector?: string | null;
  createdAt?: string;
  // Opcionais: produtos de renda fixa e textos para a tela de detalhe
  rateType?: RateType | null;
  rateValue?: number | null;
  liquidity?: string | null;
  taxExempt?: boolean | null;
  minimumInvestment?: number | null;
  description?: string | null;
}

/** Catálogo de ativos com o preço atual (GET /assets). */
export async function getAssets(): Promise<Asset[]> {
  return recommendationsApi<Asset[]>("GET", "/assets");
}

function sortByCompatibility(list: Recommendation[]) {
  return [...list].sort((a, b) => b.compatibilityScore - a.compatibilityScore || a.ticker.localeCompare(b.ticker));
}
