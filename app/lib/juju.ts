// Juju (de "juros"), a assistente do Crescit. Nesta versão é uma PRÉVIA: as respostas são
// regras prontas (por palavras-chave) que usam os dados da carteira. A ideia
// futura é trocar `answer` por uma IA que recebe o mesmo contexto.

import { compareAllocation, monthlyHistory, monthLabel, portfolioAlerts, suggestContribution, TARGET_ALLOCATION } from "./analysis";
import { taxedEquivalentCdiPercent } from "./fixed-income";
import { money, pct, qty } from "./format";
import { goalRate, monthlyNeeded, monthsUntil, type Goal } from "./goals";
import type { AlertStatus } from "./price-alerts";
import { marketRates, ratePct } from "./market-rates";
import { displayName, type PortfolioSummary } from "./portfolio";
import { INVESTOR_TYPES, type InvestorType } from "./profile";
import { ASSET_TYPE_LABEL } from "./recommendations";

export const MASCOT_NAME = "Juju";

export interface JujuContext {
  /** Ausente enquanto a carteira carrega (ou se ela não carregar) */
  summary?: PortfolioSummary;
  investorType: InvestorType;
  goal: number;
  /** Objetivos da página Metas */
  goals?: Goal[];
  /** Avisos de preço com a situação de cada um */
  priceAlerts?: AlertStatus[];
  /** yyyy-mm-dd */
  today: string;
}

export interface JujuAnswer {
  text: string;
  links?: { to: string; label: string }[];
}

export const SUGGESTED_QUESTIONS = [
  "Como está minha carteira?",
  "Quanto aportar este mês?",
  "LCI ou CDB?",
  "O que é FII?",
  "Tem algo pedindo atenção?",
  "Como estão meus objetivos?",
];

/** Minúsculas e sem acento, para comparar palavras-chave. */
const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

interface Topic {
  match: RegExp;
  reply: (ctx: JujuContext) => JujuAnswer;
}

// Ordem importa: o primeiro tema que casar responde
const TOPICS: Topic[] = [
  { match: /\b(oi|ola|bom dia|boa tarde|boa noite|e ai)\b/, reply: () => ({ text: greeting() }) },
  { match: /\b(lci|lca)\b.*\b(cdb)\b|\b(cdb)\b.*\b(lci|lca)\b|isent|imposto|\bir\b/, reply: () => lciVersusCdb() },
  { match: /aviso|lembrete|vender|lista de compra|quando (cair|subir)/, reply: (ctx) => priceAlertsOverview(ctx) },
  { match: /objetiv|sonho|viagem|casa|apartamento|carro|chegar la/, reply: (ctx) => goalsOverview(ctx) },
  { match: /aport|quanto (devo |posso )?(investir|colocar)|este mes|esse mes|meta/, reply: (ctx) => monthlyContribution(ctx) },
  { match: /atenc|alerta|risco|preocup|venc|fgc/, reply: (ctx) => attention(ctx) },
  { match: /carteira|patrimonio|como (esta|estou|vai)|rendi|ganh|perd/, reply: (ctx) => portfolioOverview(ctx) },
  { match: /perfil|conservador|moderado|arrojado|agressivo/, reply: (ctx) => profile(ctx) },
  { match: /reserva|emergencia/, reply: () => reserve() },
  { match: /\bcdi\b|\bselic\b|\bipca\b|inflacao|juros/, reply: () => rates() },
  { match: /\bfiis?\b|fundo imobiliario/, reply: () => define("FII") },
  { match: /\betfs?\b|indice|bova11|ivvb11/, reply: () => define("ETF") },
  { match: /\bacao\b|\bacoes\b|bolsa/, reply: () => define("STOCK") },
  { match: /tesouro/, reply: () => define("TESOURO") },
  { match: /\bcdb\b|renda fixa/, reply: () => define("CDB") },
  { match: /\blci\b|\blca\b/, reply: () => define("LCI") },
  { match: /fundo/, reply: () => define("FUND") },
  { match: /comecar|iniciante|nunca investi|primeir/, reply: () => firstSteps() },
];

export function answer(question: string, ctx: JujuContext): JujuAnswer {
  const q = normalize(question);
  const topic = TOPICS.find((t) => t.match.test(q));
  if (topic) return topic.reply(ctx);
  return {
    text:
      "Ainda não sei responder isso. Por enquanto eu entendo perguntas sobre a sua carteira, o aporte do mês, pontos de atenção, " +
      "seu perfil e o básico de CDB, LCI, Tesouro, FIIs, ETFs e ações. Na versão com IA, vou conseguir conversar sobre qualquer dúvida.",
  };
}

function greeting() {
  return `Oi! Eu sou a ${MASCOT_NAME}, a assistente do Crescit. Posso explicar investimentos e olhar a sua carteira com você. Escolha uma pergunta abaixo ou escreva a sua.`;
}

function portfolioOverview({ summary }: JujuContext): JujuAnswer {
  if (!summary) return { text: "Ainda estou carregando a sua carteira. Tente de novo em alguns segundos." };
  if (summary.holdings.length === 0) {
    return {
      text: "Sua carteira ainda está vazia. Se você já investe, cadastre o que tem em cada banco; se está começando, o plano de primeiros passos ajuda.",
      links: [{ to: "/carteira", label: "Cadastrar investimentos" }, { to: "/primeiros-passos", label: "Primeiros passos" }],
    };
  }
  const top = summary.holdings[0];
  const result =
    summary.gainPct === null
      ? ""
      : summary.gain >= 0
        ? ` Até aqui ela rendeu ${money(summary.gain)} (${pct(summary.gainPct)}).`
        : ` Até aqui ela está ${money(Math.abs(summary.gain))} abaixo do investido (${pct(summary.gainPct)}).`;
  const banks = summary.byInstitution.filter((i) => i.value > 0);
  return {
    text:
      `Você tem ${money(summary.currentValue)} em ${summary.holdings.length} investimentos` +
      (banks.length > 1 ? `, espalhados por ${banks.length} instituições (a maior é o ${banks[0].institution}, com ${pct(banks[0].share)}).` : ".") +
      result +
      ` O maior investimento é ${displayName(top)}, com ${money(top.currentValue)}.`,
    links: [{ to: "/analise", label: "Ver análise completa" }],
  };
}

function monthlyContribution({ summary, investorType, goal, today }: JujuContext): JujuAnswer {
  if (!summary) return { text: "Ainda estou carregando a sua carteira. Tente de novo em alguns segundos." };
  const month = today.slice(0, 7);
  const done = monthlyHistory(summary, today).find((m) => m.month === month)?.contributed ?? 0;
  const missing = Math.max(goal - done, 0);
  const monthName = monthLabel(month).split(" ")[0];
  if (missing === 0) {
    return { text: `Sua meta é ${money(goal)} por mês e em ${monthName} você já aportou ${money(done)}. Meta cumprida!` };
  }
  const split = suggestContribution(summary, investorType, missing);
  const parts = split.map((s) => `${money(s.amount)} em ${ASSET_TYPE_LABEL[s.type]}`);
  return {
    text:
      `Sua meta é ${money(goal)} por mês` +
      (done > 0 ? ` e em ${monthName} você já aportou ${money(done)}. Faltam ${money(missing)}.` : `. Em ${monthName} ainda não houve aporte.`) +
      (parts.length > 0
        ? ` Para aproximar a carteira da referência do seu perfil, eu dividiria assim: ${joinPt(parts)}.`
        : " Sua carteira já está na referência do perfil, então pode manter a divisão atual."),
    links: [{ to: "/recomendacoes", label: "Ver sugestões de ativos" }],
  };
}

function goalsOverview({ goals = [], investorType, today, goal }: JujuContext): JujuAnswer {
  if (goals.length === 0) {
    return {
      text: "Você ainda não cadastrou objetivos. Dar um destino para o dinheiro (uma viagem, a reserva, a entrada de um imóvel) ajuda a manter a constância: eu calculo quanto guardar por mês para cada um.",
      links: [{ to: "/metas", label: "Criar um objetivo" }],
    };
  }
  const needs = goals.map((g) => ({ g, need: monthlyNeeded(g, today, goalRate(monthsUntil(g.deadline, today), investorType)) }));
  const total = needs.reduce((acc, n) => acc + n.need, 0);
  const parts = needs.map(({ g, need }) => (need === 0 ? `${g.name} (já garantido)` : `${g.name}: ${money(Math.ceil(need))} por mês`));
  return {
    text:
      `Seus objetivos: ${joinPt(parts)}. No total, cerca de ${money(Math.ceil(total))} por mês` +
      (total <= goal ? `, e sua meta de ${money(goal)} dá conta.` : `, acima da sua meta de ${money(goal)}. Vale aumentar a meta ou estender algum prazo.`),
    links: [{ to: "/metas", label: "Ver metas" }],
  };
}

function priceAlertsOverview({ priceAlerts = [] }: JujuContext): JujuAnswer {
  if (priceAlerts.length === 0) {
    return {
      text: "Você não tem avisos de preço. Dá para pedir um lembrete para vender quando um ativo seu subir, ou para comprar quando um ativo que você quer cair.",
      links: [{ to: "/avisos", label: "Criar um aviso" }],
    };
  }
  const fired = priceAlerts.filter((s) => s.triggered);
  const firedText = fired.map((s) => `${s.alert.ticker} ${s.alert.direction === "sell-up" ? "subiu" : "caiu"} ${pct(Math.abs(s.change ?? 0))}`);
  return {
    text:
      `Você tem ${priceAlerts.length} ${priceAlerts.length === 1 ? "aviso" : "avisos"} de preço.` +
      (fired.length > 0
        ? ` ${fired.length === 1 ? "Um disparou" : `${fired.length} dispararam`}: ${joinPt(firedText)}. Vale olhar com calma antes de decidir.`
        : " Nenhum disparou ainda; eu aviso quando o preço chegar lá."),
    links: [{ to: "/avisos", label: "Ver avisos" }],
  };
}

function attention({ summary, today }: JujuContext): JujuAnswer {
  if (!summary) return { text: "Ainda estou carregando a sua carteira. Tente de novo em alguns segundos." };
  const alerts = portfolioAlerts(summary, today);
  if (alerts.length === 0) {
    return { text: "Não encontrei nada preocupante: nenhum vencimento próximo, nada acima do limite do FGC e nenhum ativo pesando demais na carteira." };
  }
  return {
    text: `Encontrei ${alerts.length === 1 ? "1 ponto" : `${alerts.length} pontos`} de atenção. ${alerts.map((a) => `${a.title}: ${a.text}`).join(" ")}`,
    links: [{ to: "/analise", label: "Ver na análise" }],
  };
}

function profile({ summary, investorType }: JujuContext): JujuAnswer {
  const info = INVESTOR_TYPES[investorType];
  const target = TARGET_ALLOCATION[investorType];
  const reference = Object.entries(target)
    .filter(([, share]) => share > 0)
    .map(([type, share]) => `${pct(share)} em ${ASSET_TYPE_LABEL[type as keyof typeof target]}`);
  let gapText = "";
  if (summary && summary.currentValue > 0) {
    const biggest = compareAllocation(summary, investorType).reduce((a, b) => (Math.abs(b.currentShare - b.targetShare) > Math.abs(a.currentShare - a.targetShare) ? b : a));
    gapText = ` Hoje a maior diferença está em ${ASSET_TYPE_LABEL[biggest.type]}: ${pct(biggest.currentShare)} da carteira, contra ${pct(biggest.targetShare)} da referência.`;
  }
  return {
    text: `Seu perfil é ${info.label}. ${info.description} A carteira de referência do Crescit para esse perfil tem ${joinPt(reference)}.${gapText}`,
    links: [{ to: "/perfil/resultado", label: "Ver meu perfil" }],
  };
}

function lciVersusCdb(): JujuAnswer {
  const equivalent = Math.round(taxedEquivalentCdiPercent(92, 24) * 10) / 10;
  return {
    text:
      "A LCI e a LCA são isentas de imposto de renda para pessoa física; o CDB paga IR de 22,5% a 15% sobre o rendimento, conforme o prazo. " +
      `Por isso uma LCI de 92% do CDI, em 2 anos, equivale a um CDB de cerca de ${qty(equivalent)}% do CDI. ` +
      "Em troca, a LCI costuma ter carência para resgate. Os dois têm garantia do FGC até R$ 250 mil por instituição.",
    links: [{ to: "/analise", label: "Comparar no simulador" }],
  };
}

function reserve(): JujuAnswer {
  return {
    text:
      `A reserva de emergência é o dinheiro para imprevistos: o ideal é guardar uns 6 meses dos seus gastos em algo seguro e com resgate no mesmo dia, ` +
      `como Tesouro Selic ou um CDB de liquidez diária que pague pelo menos 100% do CDI (hoje cerca de ${ratePct(marketRates().cdi)} ao ano).`,
    links: [{ to: "/primeiros-passos", label: "Calcular minha reserva" }],
  };
}

function rates(): JujuAnswer {
  const r = marketRates();
  return {
    text:
      `${r.source === "bcb" ? `Segundo o Banco Central (${r.date})` : "Pelas taxas de referência do app"}: CDI de ${ratePct(r.cdi)} ao ano, ` +
      `Selic de ${ratePct(r.selic)} e IPCA de ${ratePct(r.ipca)} em 12 meses. O CDI é a taxa que os bancos usam entre si e serve de régua ` +
      "para a renda fixa; a Selic é a taxa básica de juros; o IPCA é a inflação oficial. Render acima do IPCA é o que faz o dinheiro crescer de verdade.",
  };
}

const DEFINITIONS: Record<string, string> = {
  FII: "FII é um fundo imobiliário: você compra cotas na bolsa e vira sócio de imóveis como galpões, shoppings ou escritórios. Os aluguéis são distribuídos todo mês, geralmente isentos de IR para pessoa física. A cota oscila de preço, então o risco é maior que o da renda fixa.",
  ETF: "ETF é um fundo negociado na bolsa que copia um índice. Com uma cota de BOVA11, por exemplo, você tem um pedacinho das principais empresas do Ibovespa. É um jeito simples e barato de diversificar.",
  STOCK: "Uma ação é um pedaço de uma empresa. Você ganha se ela se valorizar e com os dividendos que ela distribui, mas o preço pode cair bastante. Por isso é para dinheiro de longo prazo e em uma parte menor da carteira.",
  TESOURO: "O Tesouro Direto são títulos do governo federal, o investimento mais seguro do país. O Tesouro Selic acompanha a taxa de juros e pode ser resgatado a qualquer dia, ótimo para a reserva; o IPCA+ protege da inflação no longo prazo.",
  CDB: "O CDB é um empréstimo que você faz ao banco em troca de juros, geralmente um percentual do CDI. Tem garantia do FGC até R$ 250 mil por instituição e paga imposto de renda sobre o rendimento.",
  LCI: "LCI e LCA são parecidas com o CDB, mas o dinheiro financia o setor imobiliário ou o agronegócio. A grande vantagem é a isenção de imposto de renda; em troca, costumam ter carência para resgate.",
  FUND: "Um fundo de investimento junta o dinheiro de muita gente e um gestor profissional decide onde aplicar. Há fundos de renda fixa, multimercado e de ações. Vale olhar a taxa de administração antes de entrar.",
};

function define(key: keyof typeof DEFINITIONS): JujuAnswer {
  return { text: DEFINITIONS[key], links: [{ to: "/recomendacoes", label: "Ver recomendações para o meu perfil" }] };
}

function firstSteps(): JujuAnswer {
  return {
    text: "Para começar: 1) monte a reserva de emergência; 2) abra conta em um banco ou corretora; 3) faça o primeiro aporte dividido conforme o seu perfil; 4) mantenha a constância todo mês. O plano de primeiros passos faz as contas com você.",
    links: [{ to: "/primeiros-passos", label: "Ver primeiros passos" }],
  };
}

/** ["a", "b", "c"] -> "a, b e c" */
function joinPt(items: string[]) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}
