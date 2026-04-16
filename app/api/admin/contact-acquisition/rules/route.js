import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function normalizeRules(input) {
  if (!Array.isArray(input)) return [];

  return input
    .map((item, index) => ({
      id: item.id || undefined,
      job_title: String(item.job_title || item.jobTitle || "").trim(),
      contact_type: item.contact_type === "primary" ? "primary" : "secondary",
      priority: index + 1,
      active: item.active !== false,
    }))
    .filter((item) => item.job_title.length > 0);
}

export async function GET() {
  const admin = await requireAdminRequest();
  if (admin.error) return admin.error;

  const supabase = createSupabaseAdminClient();
  const [{ data: rules, error: rulesError }, { data: runs, error: runsError }] = await Promise.all([
    supabase
      .from("contact_acquisition_rules")
      .select("id, job_title, contact_type, priority, active, updated_at")
      .order("priority", { ascending: true }),
    supabase
      .from("contact_acquisition_runs")
      .select("id, status, started_at, completed_at, contacts_seen, contacts_created, contacts_updated, contacts_skipped, error_message, details")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (rulesError || runsError) {
    return NextResponse.json(
      { error: rulesError?.message || runsError?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ rules: rules || [], runs: runs || [] });
}

export async function PUT(request) {
  const admin = await requireAdminRequest();
  if (admin.error) return admin.error;

  const body = await request.json().catch(() => ({}));
  const rules = normalizeRules(body.rules);
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { error: deactivateError } = await supabase
    .from("contact_acquisition_rules")
    .update({ active: false, updated_at: now })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deactivateError) {
    return NextResponse.json({ error: deactivateError.message }, { status: 500 });
  }

  for (const rule of rules) {
    const payload = {
      job_title: rule.job_title,
      contact_type: rule.contact_type,
      priority: rule.priority,
      active: rule.active,
      created_by: admin.user.id,
      updated_at: now,
    };

    const query = rule.id
      ? supabase.from("contact_acquisition_rules").update(payload).eq("id", rule.id)
      : supabase.from("contact_acquisition_rules").upsert(payload, { onConflict: "job_title" });

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await supabase.from("audit_logs").insert({
    actor_id: admin.user.id,
    action: "contact_acquisition_rules_updated",
    entity_type: "contact_acquisition_rules",
    details: { rules },
  });

  const { data, error } = await supabase
    .from("contact_acquisition_rules")
    .select("id, job_title, contact_type, priority, active, updated_at")
    .order("priority", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data || [] });
}
