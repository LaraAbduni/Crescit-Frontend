// Resumo em texto dos dados do usuário para a Juju com IA. Os números saem das mesmas
// funções que o app usa nas telas, para a IA não precisar (nem poder) fazer contas próprias.

import { compareAllocation, monthlyHistory, portfolioAlerts, suggestContribution, TARGET_ALLOCATION } from "./analysis";
import { money, pct } from "./format";
import { goalRate, monthlyNeeded, monthsUntil } from "./goals";
import type { JujuContext } from "./juju";
import { marketRates, ratePct } from "./market-rates";
import { displayName } from "./portfolio";
import { INVESTOR_TYPES } from "./profile";
import { ASSET_TYPE_LABEL } from "./recommendations";

/** Limite de itens por lista, para o contexto não crescer sem controle. */
const MAX_ITEMS = 15;

export function buildJujuFacts(ctx: JujuContext): string {
  const { summary, investorType, goal, goals = [], priceAlerts = [], today } = ctx;
  const lines: string[] = [];
  const rates = marketRates();
  const profile = INVESTOR_TYPES[investorType];

  lines.push(`Data de hoje: ${today}`);
  lines.push(`Perfil do investidor: ${profile.label}. ${profile.description}`);
  const reference = Object.entries(TARGET_ALLOCATION[investorType])
    .filter(([, share]) => share > 0)
    .map(([type, share]) => `${ASSET_TYPE_LABEL[type as keyof typeof ASSET_TYPE_LABEL]} ${pct(share)}`);
  lines.push(`Carteira de referência do Crescit para o perfil: ${reference.join(", ")}`);
  lines.push(
    `Taxas ${rates.source === "bcb" ? `do Banco Central (${rates.date})` : "de referência do app"}: CDI ${ratePct(rates.cdi)} a.a., Selic ${ratePct(rates.selic)} a.a., IPCA ${ratePct(rates.ipca)} em 12 meses`,
  );
  lines.push(`Meta de aporte mensal: ${money(goal)}`);

  if (!summary) {
    lines.push("Carteira: ainda carregando; não há números da carteira nesta conversa.");
  } else if (summary.holdings.length === 0) {
    lines.push("Carteira: vazia, nenhum investimento cadastrado.");
  } else {
    lines.push(
      `Carteira: ${money(summary.currentValue)} hoje, ${money(summary.totalInvested)} investidos` +
        (summary.gainPct === null ? "" : `, resultado ${money(summary.gain)} (${pct(summary.gainPct)})`) +
        (summary.hasEstimates ? "; a renda fixa é estimada" : "") +
        (summary.hasMissingPrices ? "; alguns ativos estão sem preço" : ""),
    );
    lines.push("Investimentos:");
    for (const h of summary.holdings.slice(0, MAX_ITEMS)) {
      lines.push(
        `- ${displayName(h)} (${ASSET_TYPE_LABEL[h.assetType]}${h.institution ? `, ${h.institution}` : ""}): ` +
          `${money(h.currentValue)} hoje, ${money(h.totalInvested)} investidos` +
          (h.gainPct === null ? "" : `, ${pct(h.gainPct)}`),
      );
    }
    lines.push(`Por instituição: ${summary.byInstitution.slice(0, MAX_ITEMS).map((i) => `${i.institution} ${pct(i.share)}`).join(", ")}`);
    lines.push(
      "Carteira atual × referência: " +
        compareAllocation(summary, investorType)
          .map((g) => `${ASSET_TYPE_LABEL[g.type]} ${pct(g.currentShare)} (referência ${pct(g.targetShare)})`)
          .join(", "),
    );

    const month = today.slice(0, 7);
    const done = monthlyHistory(summary, today).find((m) => m.month === month)?.contributed ?? 0;
    const missing = Math.max(goal - done, 0);
    lines.push(`Aportado neste mês: ${money(done)}; falta para a meta: ${money(missing)}`);
    const split = suggestContribution(summary, investorType, missing);
    if (split.length > 0) {
      lines.push(`Divisão sugerida pelo app para o que falta: ${split.map((s) => `${money(s.amount)} em ${ASSET_TYPE_LABEL[s.type]}`).join(", ")}`);
    }

    const alerts = portfolioAlerts(summary, today);
    lines.push(alerts.length === 0 ? "Pontos de atenção: nenhum." : `Pontos de atenção: ${alerts.map((a) => `${a.title}: ${a.text}`).join(" ")}`);
  }

  if (goals.length === 0) {
    lines.push("Objetivos: nenhum cadastrado.");
  } else {
    lines.push("Objetivos:");
    for (const g of goals.slice(0, MAX_ITEMS)) {
      const need = monthlyNeeded(g, today, goalRate(monthsUntil(g.deadline, today), investorType));
      lines.push(`- ${g.name}: juntar ${money(g.target)} até ${g.deadline}, já guardado ${money(g.saved)}, precisa de ${money(Math.ceil(need))} por mês`);
    }
  }

  if (priceAlerts.length === 0) {
    lines.push("Avisos de preço: nenhum.");
  } else {
    lines.push("Avisos de preço:");
    for (const s of priceAlerts.slice(0, MAX_ITEMS)) {
      lines.push(
        `- ${s.alert.ticker}: ${s.alert.direction === "sell-up" ? "vender se subir" : "comprar se cair"} ${pct(s.alert.percent)}` +
          (s.change === undefined ? ", sem preço atual" : `, variação ${pct(s.change)}`) +
          (s.triggered ? ", DISPAROU" : ""),
      );
    }
  }

  // O formato de moeda usa espaço não separável; texto simples basta para o modelo
  return lines.join("\n").replace(/ /g, " ");
}
