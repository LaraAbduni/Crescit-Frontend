import { Navigate, NavLink, Outlet } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { useState } from "react";
import { Logo } from "~/components/ui";
import { useOnboarding } from "~/lib/onboarding";

const TABS = [
  { to: "/inicio", label: "Início", icon: HomeIcon },
  { to: "/recomendacoes", label: "Recomendações", icon: CompassIcon },
  { to: "/carteira", label: "Carteira", icon: BriefcaseIcon },
  { to: "/analise", label: "Análise", icon: ChartIcon },
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
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-white px-5 py-8 lg:flex">
        <Logo className="px-3" />
        <nav className="mt-10" aria-label="Principal">
          <ul className="flex flex-col gap-1">
            {TABS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-3 text-[1.05rem] transition ${
                      isActive ? "bg-brand-soft font-semibold text-brand" : "text-muted hover:bg-cream hover:text-ink"
                    }`
                  }
                >
                  <Icon size={24} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto border-t border-line px-3 pt-5 text-sm">
          <p className="truncate text-muted" title={userLabel}>{userLabel}</p>
          <button type="button" className="mt-2 font-semibold text-brand hover:underline" onClick={handleLogout}>Sair</button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <div className="mx-auto w-full max-w-md px-6 pt-12 pb-32 md:max-w-3xl lg:max-w-5xl lg:px-10 lg:pb-16">
          <div className="mb-6 flex items-center justify-between gap-4 text-sm text-muted lg:hidden">
            <span className="truncate">{userLabel}</span>
            <button type="button" className="shrink-0 font-semibold text-brand hover:underline" onClick={handleLogout}>Sair</button>
          </div>
          {logoutError && <p role="alert" className="mb-4 text-aggressive">Não foi possível sair. Tente novamente.</p>}
          <Outlet />
        </div>
      </div>

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
