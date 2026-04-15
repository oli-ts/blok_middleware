"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ActivitySquare, Home, Layers, Settings, Users } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/projects", label: "Projects", icon: Layers },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/crm/push", label: "CRM Push", icon: ActivitySquare },
  { href: "/admin", label: "Admin", icon: Settings, adminOnly: true },
];

export function SidebarNav({ role }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {nav.filter((item) => !item.adminOnly || role === "admin").map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
              active ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:bg-gray-700 hover:text-white"
            )}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
