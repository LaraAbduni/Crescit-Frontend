import { useAuth0 } from "@auth0/auth0-react";
import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/signup";
import { Eyebrow, PrimaryButton, Screen, StepHeader, TextButton, Title } from "~/components/ui";
import { safeReturnTo } from "~/lib/auth";
import { useOnboarding } from "~/lib/onboarding";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sua conta · Crescit" }];
}

export default function Signup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const { ready, profile } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const login = params.get("entrar") === "1";
  if (isAuthenticated) {
    // A rota protegida cuida do carregamento e de eventuais erros da API.
    return <Navigate to={ready && !profile ? "/cadastro/contexto" : safeReturnTo(params.get("returnTo"))} replace />;
  }

  async function enter(signup: boolean) {
    setBusy(true);
    setError(false);
    try {
      await loginWithRedirect({
        appState: { returnTo: safeReturnTo(params.get("returnTo")) },
        authorizationParams: signup ? { screen_hint: "signup" } : {},
      });
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <Screen
      header={<StepHeader label="Cadastro · 1 de 2" progress={0.5} onBack={() => navigate("/")} />}
      footer={<>
        {error && <p role="alert" className="text-center text-aggressive">Não foi possível abrir o login. Tente novamente.</p>}
        <PrimaryButton onClick={() => enter(!login)} disabled={busy}>
          {busy ? "Abrindo acesso seguro..." : login ? "Entrar na minha conta" : "Criar minha conta"}
        </PrimaryButton>
        <TextButton onClick={() => enter(login)} disabled={busy}>
          {login ? "Ainda não tenho conta" : "Já tenho conta"}
        </TextButton>
      </>}
    >
      <Eyebrow>Sua conta</Eyebrow>
      <Title>{login ? "Que bom ter você de volta" : "Vamos começar pelo básico"}</Title>
      <p className="mt-3 text-muted">Continue para acessar sua conta com segurança. Depois, algumas perguntas para conhecer você como investidor.</p>
      <div className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Um acesso para tudo</h2>
        <p className="mt-2 text-muted">Seu perfil, suas recomendações e sua carteira ficam vinculados à sua conta.</p>
      </div>
    </Screen>
  );
}
