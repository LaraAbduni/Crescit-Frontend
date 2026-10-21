import { ApiError, isMockPortfolioApi, portfolioApi } from "./api";
import { getAssets, type AssetType } from "./recommendations";

/** InvestmentRequest do Serviço de Portfólio. */
export interface InvestmentRequest {
  ticker: string;
  assetName: string;
  assetType: AssetType;
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
  if (isMockPortfolioApi) return mockStore.read().investments;
  try {
    return await portfolioApi<Investment[]>("GET", `${base(userId)}/investments`);
  } catch (e) {
    // 404: o usuário ainda não tem carteira (ela é criada no primeiro investimento)
    if (e instanceof ApiError && e.status === 404) return [];
    throw e;
  }
}

export async function listContributions(userId: string, investmentId: string): Promise<Contribution[]> {
  if (isMockPortfolioApi) return mockStore.contributionsOf(investmentId);
  return portfolioApi("GET", `${base(userId)}/investments/${investmentId}/contributions`);
}

/**
 * Adiciona o ativo à carteira. O investimento nasce zerado; os aportes são
 * registrados depois. Se o ticker já estiver na carteira, devolve o existente.
 */
export async function addInvestment(userId: string, req: InvestmentRequest): Promise<Investment> {
  if (isMockPortfolioApi) return mockStore.addInvestment(req);
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
  if (isMockPortfolioApi) return mockStore.addContribution(investmentId, req);
  return portfolioApi("POST", `${base(userId)}/investments/${investmentId}/contributions`, req);
}

// --- Resumo da carteira (usado pela Carteira e pelo Início) --------------

export interface Holding extends Investment {
  contributions: Contribution[];
  /** Preço atual vindo do Serviço de Recomendações; ausente se o ativo não estiver no catálogo. */
  currentPrice?: number;
  currentValue: number;
  gain: number;
  /** null quando não há preço ou nada investido */
  gainPct: number | null;
}

export interface PortfolioSummary {
  holdings: Holding[];
  totalInvested: number;
  currentValue: number;
  gain: number;
  gainPct: number | null;
  /** Valor atual por tipo de ativo, na ordem fixa de ALLOCATION_ORDER */
  allocation: { type: AssetType; value: number; share: number }[];
  recentContributions: (Contribution & { ticker: string; assetType: AssetType })[];
}

/** Ordem fixa dos tipos no gráfico (a cor segue o tipo, não o tamanho). */
export const ALLOCATION_ORDER: AssetType[] = ["FIXED_INCOME", "ETF", "FII", "STOCK"];

export async function loadPortfolio(userId: string): Promise<PortfolioSummary> {
  const [investments, prices] = await Promise.all([
    listInvestments(userId),
    // Sem preços a carteira ainda funciona: o valor atual cai para o investido
    getAssets()
      .then((assets) => new Map(assets.map((a) => [a.ticker, a.currentPrice])))
      .catch(() => new Map<string, number>()),
  ]);
  const contributions = await Promise.all(investments.map((i) => listContributions(userId, i.id)));

  const holdings: Holding[] = investments.map((inv, idx) => {
    const currentPrice = prices.get(inv.ticker);
    const currentValue = currentPrice !== undefined ? inv.totalQuantity * currentPrice : inv.totalInvested;
    const gain = currentValue - inv.totalInvested;
    return {
      ...inv,
      contributions: contributions[idx],
      currentPrice,
      currentValue,
      gain,
      gainPct: currentPrice !== undefined && inv.totalInvested > 0 ? gain / inv.totalInvested : null,
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

  const recentContributions = holdings
    .flatMap((h) => h.contributions.map((c) => ({ ...c, ticker: h.ticker, assetType: h.assetType })))
    .sort((a, b) => b.contributionDate.localeCompare(a.contributionDate) || b.createdAt.localeCompare(a.createdAt));

  return {
    holdings,
    totalInvested,
    currentValue,
    gain,
    gainPct: totalInvested > 0 ? gain / totalInvested : null,
    allocation,
    recentContributions,
  };
}

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);

export function unitLabel(type: AssetType, quantity: number) {
  const one = quantity === 1;
  if (type === "STOCK") return one ? "ação" : "ações";
  if (type === "FIXED_INCOME") return one ? "título" : "títulos";
  return one ? "cota" : "cotas";
}

// --- Modo demonstração: carteira guardada no sessionStorage --------------
// Recalcula os totais como o ContributionService do backend.

interface MockData {
  investments: Investment[];
  contributions: Contribution[];
}

const MOCK_KEY = "crescit:mock-portfolio";

const mockStore = {
  read(): MockData {
    try {
      const raw = sessionStorage.getItem(MOCK_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // segue com a carteira vazia
    }
    return { investments: [], contributions: [] };
  },
  write(data: MockData) {
    try {
      sessionStorage.setItem(MOCK_KEY, JSON.stringify(data));
    } catch {
      // idem
    }
  },
  contributionsOf(investmentId: string) {
    return this.read()
      .contributions.filter((c) => c.investmentId === investmentId)
      .sort((a, b) => b.contributionDate.localeCompare(a.contributionDate) || b.createdAt.localeCompare(a.createdAt));
  },
  addInvestment(req: InvestmentRequest): Investment {
    const data = this.read();
    const ticker = req.ticker.trim().toUpperCase();
    const existing = data.investments.find((i) => i.ticker === ticker);
    if (existing) return existing;
    const now = new Date().toISOString();
    const investment: Investment = {
      id: crypto.randomUUID(),
      portfolioId: "demo",
      ticker,
      assetName: req.assetName.trim(),
      assetType: req.assetType,
      totalQuantity: 0,
      totalInvested: 0,
      averagePrice: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.write({ ...data, investments: [...data.investments, investment] });
    return investment;
  },
  addContribution(investmentId: string, req: ContributionRequest): Contribution {
    const data = this.read();
    const contribution: Contribution = {
      id: crypto.randomUUID(),
      investmentId,
      quantity: req.quantity,
      unitPrice: req.unitPrice,
      amount: Math.round(req.quantity * req.unitPrice * 100) / 100,
      contributionDate: req.contributionDate,
      createdAt: new Date().toISOString(),
    };
    const contributions = [...data.contributions, contribution];
    const own = contributions.filter((c) => c.investmentId === investmentId);
    const totalQuantity = sum(own.map((c) => c.quantity));
    const totalInvested = Math.round(sum(own.map((c) => c.amount)) * 100) / 100;
    const investments = data.investments.map((i) =>
      i.id === investmentId
        ? {
            ...i,
            totalQuantity,
            totalInvested,
            averagePrice: totalQuantity ? totalInvested / totalQuantity : 0,
            updatedAt: new Date().toISOString(),
          }
        : i,
    );
    this.write({ investments, contributions });
    return contribution;
  },
};
