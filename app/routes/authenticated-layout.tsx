import { useAuth0 } from "@auth0/auth0-react";
import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { Logo, PrimaryButton, Screen, TextButton, Title } from "~/components/ui";
import { SessionLoading } from "~/lib/auth";
import { useOnboarding } from "~/lib/onboarding";

export default function AuthenticatedLayout() {
  const { isAuthenticated, logout } = useAuth0();
  const { ready, error, retry, clearDraft } = useOnboarding();
  const location = useLocation();
  const [logoutError, setLogoutError] = useState(false);
  if (!isAuthenticated) {
    return <Navigate to={`/cadastro?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (error) {
    return (
      <Screen header={<Logo />} footer={<>
        <PrimaryButton onClick={retry}>Tentar novamente</PrimaryButton>
        <TextButton onClick={() => {
          clearDraft();
          void logout({ logoutParams: { returnTo: window.location.origin } }).catch(() => { setLogoutError(true); retry(); });
        }}>Sair da conta</TextButton>
      </>}>
        <Title>Não conseguimos carregar seu perfil</Title>
        <p role="alert" className="mt-4 text-muted">{error}</p>
        {logoutError && <p role="alert" className="mt-4 text-aggressive">Não foi possível sair. Tente novamente.</p>}
      </Screen>
    );
  }
  if (!ready) return <SessionLoading />;
  return <Outlet />;
}
