import { ApiError, portfolioApi } from "./api";
import { estimateNetValue, estimateValue, isTaxExempt, type RateType } from "./fixed-income";
import { todayISO } from "./format";
import { NO_INSTITUTION } from "./institutions";
import { getAssets, type AssetType } from "./recommendations";

/** InvestmentRequest do Serviço de Portfólio. */
export interface InvestmentRequest {
  ticker: string;
  assetName: string;
  assetType: AssetType;
  institution?: string;
  /** Renda fixa: como a rentabilidade foi contratada (vai junto com rateValue) */
  rateType?: RateType;
  rateValue?: number;
  /** yyyy-mm-dd */
  maturityDate?: string;
}

/** ContributionRequest */
export interface ContributionRequest {
  quantity: number;
  unitPrice: number;
  /** yyyy-mm-dd, não pode ser no futuro */
  contributionDate: string;
}

/** model/Investment */
export interface Investment {
  id: string;
  portfolioId: string;
  ticker: string;
  assetName: string;
  assetType: AssetType;
  totalQuantity: number;
  totalInvested: number;
  averagePrice: number;
  /** Ausentes nos investimentos cadastrados antes desses campos existirem */
  institution?: string | null;
  rateType?: RateType | null;
  rateValue?: number | null;
  maturityDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** model/Contribution */
export interface Contribution {
  id: string;
  investmentId: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  contributionDate: string;
  createdAt: string;
}

const base = (userId: string) => `/portfolios/${encodeURIComponent(userId)}`;

export async function listInvestments(userId: string): Promise<Investment[]> {
  try {
    return await portfolioApi<Investment[]>("GET", `${base(userId)}/investments`);
  } catch (e) {
    // 404: o usuário ainda não tem carteira (ela é criada no primeiro investimento)
    if (e instanceof ApiError && e.status === 404) return [];
    throw e;
  }
}

export async function listContributions(userId: string, investmentId: string): Promise<Contribution[]> {
  return portfolioApi("GET", `${base(userId)}/investments/${investmentId}/contributions`);
}

/**
 * Adiciona o ativo à carteira. O investimento nasce zerado; os aportes são
 * registrados depois. Se o ticker já estiver na carteira, devolve o existente.
 */
export async function addInvestment(userId: string, req: InvestmentRequest): Promise<Investment> {
  try {
    return await portfolioApi("POST", `${base(userId)}/investments`, req);
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      const existing = (await listInvestments(userId)).find((i) => i.ticker === req.ticker.toUpperCase());
      if (existing) return existing;
    }
    throw e;
  }
}

export async function addContribution(
  userId: string,
  investmentId: string,
  req: ContributionRequest,
): Promise<Contribution> {
  return portfolioApi("POST", `${base(userId)}/investments/${investmentId}/contributions`, req);
}

/** Atualiza nome, instituição e rentabilidade (o backend recebe o InvestmentRequest completo). */
export async function updateInvestment(userId: string, investmentId: string, req: InvestmentRequest): Promise<Investment> {
  return portfolioApi("PUT", `${base(userId)}/investments/${investmentId}`, req);
}

/** Remove o ativo e todos os aportes dele. */
export async function deleteInvestment(userId: string, investmentId: string): Promise<void> {
  return portfolioApi("DELETE", `${base(userId)}/investments/${investmentId}`);
}

/** Remove um aporte; o serviço recalcula quantidade, total investido e preço médio. */
export async function deleteContribution(userId: string, investmentId: string, contributionId: string): Promise<void> {
  return portfolioApi("DELETE", `${base(userId)}/investments/${investmentId}/contributions/${contributionId}`);
}

// --- Resumo da carteira (usado pela Carteira e pelo Início) --------------

/**
 * De onde vem o valor atual:
 * - market: preço do catálogo × quantidade
 * - estimated: renda fixa estimada pela taxa contratada
 * - invested: sem preço nem taxa, mostramos o valor investido
 */
export type Valuation = "market" | "estimated" | "invested";

export interface Holding extends Investment {
  contributions: Contribution[];
  /** Preço atual vindo do Serviço de Recomendações; ausente se o ativo não estiver no catálogo. */
  currentPrice?: number;
  currentValue: number;
  valuation: Valuation;
  /** Renda fixa estimada: valor depois do IR (igual ao bruto se for isenta) */
  netValue?: number;
  taxExempt?: boolean;
  /** Renda fixa e fundos cadastrados por valor aplicado, sem cotação no catálogo */
  amountBased: boolean;
  gain: number;
  /** null quando não há preço ou nada investido */
  gainPct: number | null;
}

export interface PortfolioSummary {
  hasMissingPrices: boolean;
  hasEstimates: boolean;
  holdings: Holding[];
  totalInvested: number;
  currentValue: number;
  gain: number;
  gainPct: number | null;
  /** Valor atual por tipo de ativo, na ordem fixa de ALLOCATION_ORDER */
  allocation: { type: AssetType; value: number; share: number }[];
  /** Valor atual por instituição, da maior para a menor */
  byInstitution: { institution: string; value: number; share: number; count: number }[];
  recentContributions: (Contribution & { ticker: string; assetName: string; assetType: AssetType; amountBased: boolean })[];
}

/** Ordem fixa dos tipos no gráfico (a cor segue o tipo, não o tamanho). */
export const ALLOCATION_ORDER: AssetType[] = ["FIXED_INCOME", "FUND", "ETF", "FII", "STOCK"];

export const institutionOf = (i: Pick<Investment, "institution">) => i.institution || NO_INSTITUTION;

/** Renda fixa e fundos sem cotação no catálogo são registrados por valor aplicado. */
export const isAmountBased = (type: AssetType, hasCatalogPrice: boolean) =>
  (type === "FIXED_INCOME" || type === "FUND") && !hasCatalogPrice;

/** Código interno para renda fixa e fundos, que não têm ticker na bolsa. */
export function generatedTicker(type: AssetType) {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${type === "FUND" ? "FD" : "RF"}-${suffix}`;
}

const isGeneratedTicker = (ticker: string) => /^(RF|FD)-[A-Z0-9]{6}$/.test(ticker);

/** Nome mostrado na tela: o ticker da bolsa ou, sem ele, o nome dado pelo usuário. */
export const displayName = (i: { ticker: string; assetName: string }) =>
  isGeneratedTicker(i.ticker) ? i.assetName : i.ticker;

export async function loadPortfolio(userId: string): Promise<PortfolioSummary> {
  const [investments, prices] = await Promise.all([
    listInvestments(userId),
    // Sem preços a carteira ainda funciona: o valor atual cai para o investido
    getAssets()
      .then((assets) => new Map(assets.map((a) => [a.ticker, a.currentPrice])))
      .catch(() => new Map<string, number>()),
  ]);
  const contributions = await Promise.all(investments.map((i) => listContributions(userId, i.id)));

  const today = todayISO();
  const holdings: Holding[] = investments.map((inv, idx) => {
    const currentPrice = prices.get(inv.ticker);
    let valuation: Valuation = "invested";
    let currentValue = inv.totalInvested;
    let netValue: number | undefined;
    const taxExempt = isTaxExempt(inv.assetName);
    if (currentPrice !== undefined) {
      valuation = "market";
      currentValue = inv.totalQuantity * currentPrice;
    } else if (inv.rateType && inv.rateValue) {
      valuation = "estimated";
      currentValue = estimateValue(contributions[idx], inv.rateType, inv.rateValue, today);
      netValue = estimateNetValue(contributions[idx], inv.rateType, inv.rateValue, today, taxExempt);
    }
    const gain = currentValue - inv.totalInvested;
    return {
      ...inv,
      contributions: contributions[idx],
      currentPrice,
      currentValue,
      valuation,
      netValue,
      taxExempt,
      amountBased: isAmountBased(inv.assetType, currentPrice !== undefined),
      gain,
      gainPct: valuation !== "invested" && inv.totalInvested > 0 ? gain / inv.totalInvested : null,
    };
  });
  holdings.sort((a, b) => b.currentValue - a.currentValue || a.ticker.localeCompare(b.ticker));

  const totalInvested = sum(holdings.map((h) => h.totalInvested));
  const currentValue = sum(holdings.map((h) => h.currentValue));
  const gain = currentValue - totalInvested;

  const allocation = ALLOCATION_ORDER.map((type) => {
    const value = sum(holdings.filter((h) => h.assetType === type).map((h) => h.currentValue));
    return { type, value, share: currentValue > 0 ? value / currentValue : 0 };
  }).filter((a) => a.value > 0);

  const institutions = new Map<string, { value: number; count: number }>();
  for (const h of holdings) {
    const key = institutionOf(h);
    const entry = institutions.get(key) ?? { value: 0, count: 0 };
    institutions.set(key, { value: entry.value + h.currentValue, count: entry.count + 1 });
  }
  const byInstitution = [...institutions.entries()]
    .map(([institution, { value, count }]) => ({ institution, value, count, share: currentValue > 0 ? value / currentValue : 0 }))
    .sort((a, b) => b.value - a.value);

  const recentContributions = holdings
    .flatMap((h) =>
      h.contributions.map((c) => ({ ...c, ticker: h.ticker, assetName: h.assetName, assetType: h.assetType, amountBased: h.amountBased })),
    )
    .sort((a, b) => b.contributionDate.localeCompare(a.contributionDate) || b.createdAt.localeCompare(a.createdAt));

  return {
    hasMissingPrices: holdings.some((h) => h.valuation === "invested" && h.totalInvested > 0),
    hasEstimates: holdings.some((h) => h.valuation === "estimated"),
    holdings,
    totalInvested,
    currentValue,
    gain,
    gainPct: totalInvested > 0 && holdings.some((h) => h.valuation !== "invested") ? gain / totalInvested : null,
    allocation,
    byInstitution,
    recentContributions,
  };
}

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);

export function unitLabel(type: AssetType, quantity: number) {
  const one = quantity === 1;
  if (type === "STOCK") return one ? "ação" : "ações";
  if (type === "FIXED_INCOME") return one ? "título" : "títulos";
  if (type === "FUND") return one ? "cota" : "cotas";
  return one ? "cota" : "cotas";
}
