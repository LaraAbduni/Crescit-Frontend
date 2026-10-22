import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Logo, PrimaryButton, Screen, Title } from "~/components/ui";
import { SESSION_EXPIRED_EVENT, setAccessTokenGetter } from "./api";

export function safeReturnTo(value: unknown) {
  return typeof value === "string" && /^\/(?!\/)/.test(value) && !/[\\\u0000-\u001f]/.test(value)
    ? value : "/inicio";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <SessionLoading />;
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
  if (!domain || !clientId || !audience) {
    return <Screen header={<Logo />}><Title>Configuração incompleta</Title><p className="mt-4 text-muted">Configure os dados do Auth0 no ambiente do frontend para continuar.</p></Screen>;
  }
  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      cacheLocation="memory"
      authorizationParams={{ redirect_uri: window.location.origin, audience, scope: "openid profile email" }}
      onRedirectCallback={(state) => navigate(safeReturnTo(state?.returnTo), { replace: true })}
    >
      <AuthSession>{children}</AuthSession>
    </Auth0Provider>
  );
}

function AuthSession({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, getAccessTokenSilently, loginWithRedirect, error } = useAuth0();
  const [connected, setConnected] = useState(false);
  const [expired, setExpired] = useState(false);
  const [loginError, setLoginError] = useState(false);
  useEffect(() => {
    setAccessTokenGetter(isAuthenticated ? () => getAccessTokenSilently() : undefined);
    setConnected(true);
    return () => setAccessTokenGetter(undefined);
  }, [isAuthenticated, getAccessTokenSilently]);
  useEffect(() => {
    const onExpired = () => setExpired(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);
  if (isLoading || !connected) return <SessionLoading />;
  if (error || expired) {
    return (
      <Screen header={<Logo />} footer={
        <PrimaryButton onClick={() => {
          setLoginError(false);
          void loginWithRedirect({ appState: { returnTo: safeReturnTo(window.location.pathname + window.location.search) } })
            .catch(() => setLoginError(true));
        }}>Entrar novamente</PrimaryButton>
      }>
        <Title>{expired ? "Entre novamente" : "Não foi possível entrar"}</Title>
        <p role="alert" className="mt-4 text-muted">
          {expired ? "Sua sessão expirou. Entre para continuar de onde parou." : "Não foi possível concluir o login. Tente novamente."}
        </p>
        {loginError && <p role="alert" className="mt-4 text-aggressive">Não foi possível abrir o login. Tente novamente.</p>}
      </Screen>
    );
  }
  return children;
}

export function SessionLoading() {
  return <Screen header={<Logo />}><p role="status" className="mt-12 text-center text-muted">Carregando sua sessão...</p></Screen>;
}
