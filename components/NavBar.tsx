"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "儀表板" },
  { href: "/students", label: "學生管理" },
  { href: "/settings", label: "設定" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-3 sm:gap-6 overflow-x-auto">
        <span className="font-semibold text-slate-800 text-sm sm:text-base shrink-0">課程追蹤</span>
        <nav className="flex gap-1 shrink-0">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
