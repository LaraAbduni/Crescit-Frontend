import { Navigate, NavLink, Outlet } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { useState } from "react";
import { JujuLauncher } from "~/components/juju";
import { useOnboarding } from "~/lib/onboarding";

const TABS = [
  { to: "/inicio", label: "Início", short: "Início", icon: HomeIcon },
  { to: "/recomendacoes", label: "Recomendações", short: "Sugestões", icon: CompassIcon },
  { to: "/carteira", label: "Carteira", short: "Carteira", icon: BriefcaseIcon },
  { to: "/analise", label: "Análise", short: "Análise", icon: ChartIcon },
];

/** Telas principais do app (depois do onboarding): navegação inferior no celular e lateral no computador. */
export default function TabsLayout() {
  const { account, profile, ready, clearDraft, retry } = useOnboarding();
  const { logout } = useAuth0();
  const [logoutError, setLogoutError] = useState(false);

  if (!ready) return null;
  if (!profile) return <Navigate to="/cadastro/contexto" replace />;

  const handleLogout = () => {
    clearDraft();
    void logout({ logoutParams: { returnTo: window.location.origin } }).catch(() => { setLogoutError(true); retry(); });
  };
  const userLabel = account?.email || account?.name;

  return (
    <>
      {/* Computador: faixa estreita e flutuante, para o conteúdo ficar em primeiro plano */}
      <aside className="fixed top-4 bottom-4 left-4 z-30 hidden w-[88px] flex-col items-center rounded-[28px] border border-line bg-white py-5 shadow-[0_8px_30px_rgba(28,42,46,0.06)] lg:flex">
        <NavLink to="/inicio" aria-label="Crescit, início" className="rounded-xl">
          <img src="/favicon.svg" alt="" width={40} height={40} className="size-10" />
        </NavLink>
        <nav className="mt-8" aria-label="Principal">
          <ul className="flex flex-col gap-2">
            {TABS.map(({ to, label, short, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} title={label} className="group flex w-[72px] flex-col items-center gap-1 rounded-2xl py-1.5">
                  {({ isActive }) => (
                    <>
                      <span
                        className={`grid h-9 w-12 place-items-center rounded-full transition ${
                          isActive ? "bg-brand text-white" : "text-muted group-hover:bg-cream group-hover:text-ink"
                        }`}
                      >
                        <Icon size={22} />
                      </span>
                      <span className={`text-[0.72rem] leading-tight ${isActive ? "font-semibold text-brand" : "text-muted group-hover:text-ink"}`}>
                        {short}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto flex flex-col items-center gap-3">
          <span
            className="grid size-10 place-items-center rounded-full bg-brand-soft font-semibold text-brand"
            title={userLabel}
            aria-label={`Conta: ${userLabel}`}
            role="img"
          >
            {(account?.name || account?.email || "?").charAt(0).toUpperCase()}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[0.72rem] text-muted hover:text-aggressive"
          >
            <LogoutIcon />
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:pl-[104px]">
        <div className="mx-auto w-full max-w-md px-6 pt-12 pb-32 md:max-w-3xl lg:max-w-5xl lg:px-10 lg:pb-16">
          <div className="mb-6 flex items-center justify-between gap-4 text-sm text-muted lg:hidden">
            <span className="truncate">{userLabel}</span>
            <button type="button" className="shrink-0 font-semibold text-brand hover:underline" onClick={handleLogout}>Sair</button>
          </div>
          {logoutError && <p role="alert" className="mb-4 text-aggressive">Não foi possível sair. Tente novamente.</p>}
          <Outlet />
        </div>
      </div>

      <JujuLauncher userId={profile.userId} investorType={profile.investorType} />

      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-white lg:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 text-[0.8rem] min-[400px]:text-[0.9rem] ${isActive ? "font-semibold text-brand" : "text-muted"}`
                }
              >
                <Icon />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function HomeIcon({ size = 28 }: { size?: number }) {
  return (
    <svg {...iconProps} width={size} height={size}>
      <path d="M4 10.5L12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function CompassIcon({ size = 28 }: { size?: number }) {
  return (
    <svg {...iconProps} width={size} height={size}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </svg>
  );
}

function ChartIcon({ size = 28 }: { size?: number }) {
  return (
    <svg {...iconProps} width={size} height={size}>
      <path d="M4 20h16" />
      <path d="M7 16v-4M12 16V8M17 16v-7" />
    </svg>
  );
}

function BriefcaseIcon({ size = 28 }: { size?: number }) {
  return (
    <svg {...iconProps} width={size} height={size}>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg {...iconProps} width={20} height={20}>
      <path d="M14 4.5h3.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H14" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </svg>
  );
}
