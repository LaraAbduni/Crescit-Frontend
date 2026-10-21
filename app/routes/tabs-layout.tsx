import { Navigate, NavLink, Outlet } from "react-router";
import { useOnboarding } from "~/lib/onboarding";

const TABS = [
  { to: "/inicio", label: "Início", icon: HomeIcon },
  { to: "/recomendacoes", label: "Recomendações", icon: CompassIcon },
  { to: "/carteira", label: "Carteira", icon: BriefcaseIcon },
];

/** Telas principais do app (depois do onboarding), com a navegação inferior. */
export default function TabsLayout() {
  const { profile, ready } = useOnboarding();

  if (!ready) return null;
  if (!profile) return <Navigate to="/" replace />;

  return (
    <>
      <div className="mx-auto w-full max-w-md px-6 pt-12 pb-32">
        <Outlet />
      </div>
      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-white">
        <ul className="mx-auto grid max-w-md grid-cols-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 text-[0.95rem] ${isActive ? "font-semibold text-brand" : "text-muted"}`
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
  width: 28,
  height: 28,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 10.5L12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" />
    </svg>
  );
}
