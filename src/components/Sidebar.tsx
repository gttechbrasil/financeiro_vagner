"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/dre", label: "DRE Gerencial", icon: "📑" },
  { href: "/transacoes", label: "Transações", icon: "💳" },
  { href: "/importar", label: "Importar Extratos", icon: "📥" },
  { href: "/regras", label: "Regras", icon: "⚙️" },
  { href: "/cadastros", label: "Cadastros", icon: "🗂️" },
  { href: "/configuracoes", label: "Configurações", icon: "🔐" },
];

export default function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 bg-slate-900 text-slate-100 flex flex-col">
      <div className="px-5 py-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/40">
          MP
        </div>
        <div>
          <h1 className="font-bold text-sm leading-tight">Maschio Pionorio</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Gestão Financeira · DRE</p>
        </div>
      </div>
      <nav className="flex-1 py-4 space-y-0.5 px-3">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                active
                  ? "bg-blue-600 text-white font-medium shadow-md shadow-blue-900/30"
                  : "text-slate-300 hover:bg-slate-800 hover:translate-x-0.5"
              }`}
            >
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between gap-2 text-sm">
        <div className="min-w-0">
          <p className="text-slate-200 truncate text-xs font-medium">{userName}</p>
          <p className="text-slate-500 text-[10px]">conectado</p>
        </div>
        <button
          onClick={logout}
          className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg px-2.5 py-1.5 text-xs border border-slate-700 transition-colors"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
