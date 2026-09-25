"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Settings2,
  BarChart3,
  Users,
  ScrollText,
  Settings,
  BookOpen,
  LogOut,
  Gamepad2,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Shift Reports", href: "/reports", icon: FileText },
      { label: "New Report", href: "/reports/new", icon: FileText },
    ],
  },
  {
    title: "Hub Management & Analytics",
    items: [
      { label: "Gaming Config", href: "/config", icon: Settings2 },
      { label: "Hub Overview", href: "/hub-overview", icon: BarChart3 },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Staff Management", href: "/staff", icon: Users, roles: ["super_admin", "admin", "management"] },
      { label: "Audit Logs", href: "/audit", icon: ScrollText, roles: ["super_admin", "admin", "management"] },
      { label: "Settings", href: "/settings", icon: Settings, roles: ["super_admin", "admin", "management"] },
      { label: "Staff Guide", href: "/guide", icon: BookOpen },
    ],
  },
];

interface SidebarProps {
  user: {
    fullName: string;
    role: string;
    branch?: { name: string; code: string } | null;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Overview: true,
    Operations: true,
    "Hub Management & Analytics": true,
    Administration: true,
  });

  function toggleSection(title: string) {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  async function handleLogout() {
    if (!confirm("Are you sure you want to log out?")) return;
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Logged out");
    router.push("/login");
    router.refresh();
  }

  const navContent = (
    <>
      <div className="flex items-center gap-2 px-4 py-5 border-b border-navy-800">
        <div className="p-1.5 bg-blue-500/20 rounded-lg">
          <Gamepad2 className="h-6 w-6 text-blue-300" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-tight">MARVS Gaming</p>
          <p className="text-xs text-navy-300">Staff Portal</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {sections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.roles || item.roles.includes(user.role)
          );
          if (visibleItems.length === 0) return null;
          const isOpen = openSections[section.title];
          return (
            <div key={section.title}>
              <button
                onClick={() => toggleSection(section.title)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-navy-400 hover:text-navy-200"
              >
                {section.title}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {visibleItems.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-blue-600 text-white font-medium"
                            : "text-navy-200 hover:bg-navy-800 hover:text-white"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-navy-800 p-3">
        <div className="px-2 mb-2">
          <p className="text-sm font-medium text-white truncate">{user.fullName}</p>
          <p className="text-xs text-navy-400 capitalize">{user.role.replace("_", " ")}</p>
          {user.branch && (
            <p className="text-xs text-navy-500 mt-0.5">{user.branch.name}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-navy-300 hover:text-white hover:bg-navy-800"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Log out
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileOpen}
        aria-controls="portal-sidebar"
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-navy-900 text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="portal-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-950 text-white transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
