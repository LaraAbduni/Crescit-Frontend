import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/welcome.tsx"),
  route("cadastro", "routes/signup.tsx"),
  // Rota só de servidor: a Juju com IA (a chave da Meta fica aqui, nunca no navegador)
  route("api/juju", "routes/api.juju.ts"),
  layout("routes/authenticated-layout.tsx", [
    route("cadastro/contexto", "routes/signup-context.tsx"),
    route("perfil/questionario", "routes/questionnaire.tsx"),
    route("perfil/resultado", "routes/profile-result.tsx"),
    route("cadastro/investimentos", "routes/existing-investments.tsx"),
    layout("routes/tabs-layout.tsx", [
      route("inicio", "routes/home.tsx"),
      route("recomendacoes", "routes/recommendations.tsx"),
      route("carteira", "routes/portfolio.tsx"),
      route("analise", "routes/analysis.tsx"),
      route("metas", "routes/goals.tsx"),
      route("avisos", "routes/alerts.tsx"),
      route("primeiros-passos", "routes/first-steps.tsx"),
      // Fora do menu: prepara as contas da apresentação
      route("demo", "routes/demo.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
