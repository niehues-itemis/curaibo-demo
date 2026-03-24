"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Tag } from "lucide-react";

const NAV = [
  { href: "/settings", label: "KI-Einstellungen", icon: Bot },
  { href: "/settings/tags", label: "Tags & Namespaces", icon: Tag },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full">
      <nav className="w-52 flex-shrink-0 border-r border-neutral-200 bg-neutral-50 py-6 px-3">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide px-3 mb-3">Einstellungen</p>
        <ul className="space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active ? "bg-white shadow-sm text-neutral-900 font-medium" : "text-neutral-600 hover:bg-white hover:text-neutral-900"
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
