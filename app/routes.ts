import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/welcome.tsx"),
  route("cadastro", "routes/signup.tsx"),
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
    ]),
  ]),
] satisfies RouteConfig;
