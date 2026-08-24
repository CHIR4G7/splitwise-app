import clsx from "clsx";
import { ChartPie, User, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/insights", label: "Insights", icon: ChartPie },
  { to: "/profile", label: "Profile", icon: User }
];

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-6">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur">
        <ul className="mx-auto flex max-w-2xl">
          {tabs.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  clsx(
                    "flex flex-col items-center gap-1 py-3 text-xs font-medium transition",
                    isActive ? "text-brand-700" : "text-slate-500 hover:text-slate-700"
                  )
                }
              >
                <Icon size={20} aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
