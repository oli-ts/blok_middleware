import { redirect } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { Button } from "../ui/Button";
import { SidebarNav } from "./SidebarNav";

export async function AppShell({ children }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, department")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role || "user";
  const displayName = profile?.full_name || user.email?.split("@")[0] || "User";
  const department = profile?.department || "No department";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  async function handleSignOut() {
    "use server";
    const supa = await createSupabaseServerClient();
    await supa.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>

      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[240px] flex-col bg-gray-800 px-4 py-5 text-white md:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          
          <div>
            <div className="text-lg font-semibold leading-tight">Blok Facilities</div>
            <div className="text-xs text-gray-400">Lead Middleware</div>
          </div>
        </div>

        <SidebarNav role={role} />

        <div className="mt-auto space-y-4">
          <div className="rounded-xl bg-gray-900/50 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Signed in</div>
            <div className="mt-1 truncate text-sm font-medium text-gray-100">{displayName}</div>
            <div className="truncate text-xs text-gray-400">{role}</div>
          </div>
          <form action={handleSignOut}>
            <Button type="submit" variant="secondary" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="min-h-screen md:pl-[240px]">
        <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm md:left-[240px] md:px-6">
          <div>
            <div className="text-2xl font-semibold text-gray-900">Dashboard</div>
            <div className="hidden text-xs text-gray-500 sm:block">Internal middleware - Glenigan to Pipedrive</div>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="search"
                placeholder="Search projects..."
                className="h-10 w-64 rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            <button
              type="button"
              className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Notifications"
            >
              <Bell size={20} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>

            <button
              type="button"
              className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="User menu"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {initials}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium leading-tight text-gray-900">{displayName}</span>
                <span className="block text-xs leading-tight text-gray-500">{department}</span>
              </span>
            </button>
          </div>
        </header>

        <main id="main-content" className="min-h-screen overflow-y-auto bg-gray-50 p-4 pt-20 md:p-6 md:pt-22">
          {children}
        </main>
      </div>
    </div>
  );
}
