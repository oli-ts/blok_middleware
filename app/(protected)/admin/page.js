import { notFound } from "next/navigation";
import { AdminConfiguration } from "@/components/admin/AdminConfiguration";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") notFound();

  return <AdminConfiguration />;
}
