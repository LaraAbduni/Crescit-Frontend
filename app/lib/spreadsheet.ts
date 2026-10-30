// Exporta a carteira para uma planilha .xlsx com várias abas.
// buildWorkbook é puro (testável); exportSpreadsheet carrega a biblioteca só
// quando a pessoa pede o download.

import type { Sheet } from "write-excel-file/browser";
import { compareAllocation, monthlyHistory, monthLabel } from "./analysis";
import { rateLabel } from "./fixed-income";
import { displayName, institutionOf, type PortfolioSummary } from "./portfolio";
import { INVESTOR_TYPES, type InvestorType } from "./profile";
import { ASSET_TYPE_LABEL } from "./recommendations";

const MONEY = '"R$" #,##0.00';
const PERCENT = "0.0%";
const DATE = "dd/mm/yyyy";

/** Meio-dia em UTC: o dia não muda em nenhum fuso ao virar data do Excel. */
const toDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};

const header = (labels: string[]) => labels.map((value) => ({ value, fontWeight: "bold" as const }));
const money = (value: number) => ({ value, format: MONEY });
const percent = (value: number | null) => (value === null ? null : { value, format: PERCENT });
const date = (iso: string | null | undefined) => (iso ? { value: toDate(iso), format: DATE } : null);

const VALUATION_LABEL = {
  market: "Preço do catálogo",
  estimated: "Estimado pela taxa",
  invested: "Valor aplicado",
};

export function buildWorkbook(summary: PortfolioSummary, investorType: InvestorType, today: string): Sheet<never>[] {
  const comparison = compareAllocation(summary, investorType);

  const resumo = [
    [{ value: "Carteira Crescit", fontWeight: "bold" as const }],
    ["Gerado em", date(today)],
    ["Perfil de investidor", INVESTOR_TYPES[investorType].label],
    [],
    ["Valor atual", money(summary.currentValue)],
    ["Total investido", money(summary.totalInvested)],
    ["Resultado", money(summary.gain)],
    ["Rentabilidade", percent(summary.gainPct)],
    [],
    header(["Por instituição", "Valor atual", "% do patrimônio", "Investimentos"]),
    ...summary.byInstitution.map((i) => [i.institution, money(i.value), percent(i.share), i.count]),
    [],
    header(["Por tipo", "Valor atual", "% atual", "% referência do perfil"]),
    ...comparison.map((c) => [ASSET_TYPE_LABEL[c.type], money(c.current), percent(c.currentShare), percent(c.targetShare)]),
    [],
    ["Ações, FIIs e ETFs usam os preços do catálogo do Crescit, sem cotação em tempo real."],
    ["Renda fixa com taxa tem o valor bruto estimado; fundos aparecem pelo valor aplicado."],
  ];

  const investimentos = [
    header([
      "Investimento", "Ticker", "Tipo", "Instituição", "Rentabilidade", "Vencimento", "Quantidade",
      "Preço médio", "Total investido", "Valor atual", "Resultado", "Resultado %", "Origem do valor",
    ]),
    ...summary.holdings.map((h) => [
      displayName(h) === h.ticker ? h.assetName : displayName(h),
      displayName(h) === h.ticker ? h.ticker : null,
      ASSET_TYPE_LABEL[h.assetType],
      institutionOf(h),
      h.rateType && h.rateValue ? rateLabel(h.rateType, h.rateValue) : null,
      date(h.maturityDate),
      h.amountBased ? null : h.totalQuantity,
      h.amountBased ? null : money(h.averagePrice),
      money(h.totalInvested),
      money(h.currentValue),
      money(h.gain),
      percent(h.gainPct),
      VALUATION_LABEL[h.valuation],
    ]),
  ];

  const holdingById = new Map(summary.holdings.map((h) => [h.id, h]));
  const aportes = [
    header(["Data", "Investimento", "Tipo", "Instituição", "Quantidade", "Preço unitário", "Valor"]),
    ...summary.recentContributions.map((c) => {
      const h = holdingById.get(c.investmentId);
      return [
        date(c.contributionDate),
        displayName(c),
        ASSET_TYPE_LABEL[c.assetType],
        h ? institutionOf(h) : null,
        c.amountBased ? null : c.quantity,
        c.amountBased ? null : money(c.unitPrice),
        money(c.amount),
      ];
    }),
  ];

  const mensal = [
    header(["Mês", "Aportes no mês", "Quantidade de aportes", "Total investido acumulado"]),
    ...monthlyHistory(summary, today).map((m) => [monthLabel(m.month), money(m.contributed), m.count, money(m.invested)]),
  ];

  return [
    { sheet: "Resumo", data: resumo, columns: [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 22 }] },
    {
      sheet: "Investimentos",
      data: investimentos,
      stickyRowsCount: 1,
      columns: [28, 12, 12, 18, 18, 12, 12, 14, 16, 16, 14, 12, 20].map((width) => ({ width })),
    },
    { sheet: "Aportes", data: aportes, stickyRowsCount: 1, columns: [12, 28, 12, 18, 12, 16, 16].map((width) => ({ width })) },
    { sheet: "Mensal", data: mensal, stickyRowsCount: 1, columns: [22, 18, 22, 26].map((width) => ({ width })) },
  ] as Sheet<never>[];
}

export async function exportSpreadsheet(summary: PortfolioSummary, investorType: InvestorType, today: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  await writeXlsxFile(buildWorkbook(summary, investorType, today)).toFile(`carteira-crescit-${today}.xlsx`);
}
