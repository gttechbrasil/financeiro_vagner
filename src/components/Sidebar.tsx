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
      <div className="px-5 py-6 border-b border-slate-700">
        <h1 className="font-bold text-base leading-tight">Maschio Pionorio</h1>
        <p className="text-xs text-slate-400 mt-1">Gestão Financeira · DRE</p>
      </div>
      <nav className="flex-1 py-4 space-y-1 px-3">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? "bg-blue-600 text-white font-medium" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-slate-700 text-sm">
        <p className="text-slate-300 truncate">{userName}</p>
        <button onClick={logout} className="text-slate-400 hover:text-white text-xs mt-1">
          Sair
        </button>
      </div>
    </aside>
  );
}
