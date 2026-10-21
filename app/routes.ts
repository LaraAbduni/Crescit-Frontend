import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/welcome.tsx"),
  route("cadastro", "routes/signup.tsx"),
  route("cadastro/contexto", "routes/signup-context.tsx"),
  route("perfil/questionario", "routes/questionnaire.tsx"),
  route("perfil/resultado", "routes/profile-result.tsx"),
  layout("routes/tabs-layout.tsx", [
    route("inicio", "routes/home.tsx"),
    route("recomendacoes", "routes/recommendations.tsx"),
    route("carteira", "routes/portfolio.tsx"),
  ]),
] satisfies RouteConfig;
