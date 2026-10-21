import { isMockRecommendationsApi, recommendationsApi } from "./api";
import type { InvestorType } from "./profile";

// Valores dos enums do Serviço de Recomendações (entity/AssetType e RiskLevel)
export type AssetType = "STOCK" | "FII" | "ETF" | "FIXED_INCOME";
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
  FIXED_INCOME: "Renda Fixa",
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
};

/**
 * Busca as recomendações salvas. Se ainda não existirem (primeiro acesso
 * logo após o questionário), pede para o backend gerar.
 */
export async function getRecommendations(userId: string, investorType: InvestorType): Promise<Recommendation[]> {
  if (isMockRecommendationsApi) return sortByCompatibility(mockRecommend(userId, investorType));
  const id = encodeURIComponent(userId);
  let list = await recommendationsApi<Recommendation[]>("GET", `/recommendations/${id}`);
  // Recomendações de um perfil antigo também são regeradas
  if (list.length === 0 || list[0].investorType !== investorType) {
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
}

/** Catálogo de ativos com o preço atual (GET /assets). */
export async function getAssets(): Promise<Asset[]> {
  if (isMockRecommendationsApi) {
    return MOCK_ASSETS.map((a) => ({
      ticker: a.ticker,
      name: a.assetName,
      assetType: a.assetType,
      riskLevel: a.riskLevel,
      currentPrice: a.currentPrice,
      active: true,
    }));
  }
  return recommendationsApi<Asset[]>("GET", "/assets");
}

function sortByCompatibility(list: Recommendation[]) {
  return [...list].sort((a, b) => b.compatibilityScore - a.compatibilityScore || a.ticker.localeCompare(b.ticker));
}

// --- Modo demonstração ---------------------------------------------------

const MOCK_ASSETS: Pick<Recommendation, "ticker" | "assetName" | "assetType" | "riskLevel" | "currentPrice">[] = [
  { ticker: "TESOURO-SELIC", assetName: "Tesouro Selic 2029", assetType: "FIXED_INCOME", riskLevel: "LOW", currentPrice: 15890.42 },
  { ticker: "TESOURO-IPCA", assetName: "Tesouro IPCA+ 2035", assetType: "FIXED_INCOME", riskLevel: "LOW", currentPrice: 2210.15 },
  { ticker: "BOVA11", assetName: "iShares Ibovespa", assetType: "ETF", riskLevel: "MEDIUM", currentPrice: 131.2 },
  { ticker: "IVVB11", assetName: "iShares S&P 500", assetType: "ETF", riskLevel: "MEDIUM", currentPrice: 342.5 },
  { ticker: "HGLG11", assetName: "CSHG Logística", assetType: "FII", riskLevel: "MEDIUM", currentPrice: 156.8 },
  { ticker: "KNRI11", assetName: "Kinea Renda Imobiliária", assetType: "FII", riskLevel: "MEDIUM", currentPrice: 139.9 },
  { ticker: "ITUB4", assetName: "Itaú Unibanco PN", assetType: "STOCK", riskLevel: "MEDIUM", currentPrice: 39.1 },
  { ticker: "PETR4", assetName: "Petrobras PN", assetType: "STOCK", riskLevel: "HIGH", currentPrice: 36.45 },
  { ticker: "MGLU3", assetName: "Magazine Luiza ON", assetType: "STOCK", riskLevel: "HIGH", currentPrice: 8.72 },
];

// Espelha as estratégias Conservative/Moderate/AggressiveRecommendationStrategy.
const MOCK_SCORES: Record<InvestorType, Partial<Record<RiskLevel, number>>> = {
  CONSERVATIVE: { LOW: 95 },
  MODERATE: { LOW: 90, MEDIUM: 80 },
  AGGRESSIVE: { LOW: 70, MEDIUM: 85, HIGH: 95 },
};

function mockRecommend(userId: string, investorType: InvestorType): Recommendation[] {
  const now = new Date().toISOString();
  return MOCK_ASSETS.flatMap((asset) => {
    const score = MOCK_SCORES[investorType][asset.riskLevel];
    if (score === undefined) return [];
    return [
      {
        ...asset,
        id: `demo-${asset.ticker}`,
        assetId: `demo-${asset.ticker}`,
        userId,
        investorType,
        compatibilityScore: score,
        reason: "",
        createdAt: now,
      },
    ];
  });
}
