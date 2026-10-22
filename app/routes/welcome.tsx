import { Navigate, useNavigate } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
import type { Route } from "./+types/welcome";
import { Logo, PrimaryButton, Screen, TextButton } from "~/components/ui";
import { QUESTIONS } from "~/lib/profile";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Crescit" },
    { name: "description", content: "Recomendações de investimento de acordo com o seu perfil." },
  ];
}

const HIGHLIGHTS = [
  { title: "Descubra seu perfil", text: `${QUESTIONS.length} perguntas rápidas sobre seus objetivos e sua experiência.` },
  { title: "Receba recomendações", text: "Ativos compatíveis com o seu perfil de investidor." },
  { title: "Acompanhe sua carteira", text: "Seus aportes e a evolução do patrimônio em um só lugar." },
];

export default function Welcome() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();
  if (isAuthenticated) return <Navigate to="/inicio" replace />;

  return (
    <Screen
      header={<Logo />}
      footer={<>
        <PrimaryButton onClick={() => navigate("/cadastro")}>Criar minha conta</PrimaryButton>
        <TextButton onClick={() => navigate("/cadastro?entrar=1")}>Já tenho conta</TextButton>
      </>}
    >
      <div className="mt-12">
        <h1 className="font-serif text-[2.6rem] leading-[1.1] font-bold text-ink">
          Invista com clareza, no seu ritmo.
        </h1>
        <p className="mt-4 text-lg text-muted">
          O Crescit entende quem você é como investidor e mostra os caminhos que fazem sentido para você.
        </p>
      </div>

      <ol className="mt-10 flex flex-col gap-3">
        {HIGHLIGHTS.map((h, i) => (
          <li key={h.title} className="flex items-start gap-4 rounded-2xl border border-line bg-white p-5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand">
              {i + 1}
            </span>
            <span>
              <span className="block text-lg font-semibold text-ink">{h.title}</span>
              <span className="block text-muted">{h.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </Screen>
  );
}
