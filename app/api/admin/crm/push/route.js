import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function normalizeContactIds(input) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )
  );
}

export async function POST(request) {
  const admin = await requireAdminRequest();
  if (admin.error) return admin.error;

  const body = await request.json().catch(() => ({}));
  const contactIds = normalizeContactIds(body.contactIds);

  if (contactIds.length === 0) {
    return NextResponse.json({ error: "At least one contact must be selected." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, job_title, email, phone, phone_numbers, linkedin_url, source, company_id, office_id")
    .in("id", contactIds)
    .is("deleted_at", null);

  if (contactsError) {
    return NextResponse.json({ error: contactsError.message }, { status: 500 });
  }

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ error: "No matching contacts found." }, { status: 404 });
  }

  const { data: job, error: jobError } = await supabase
    .from("crm_push_jobs")
    .insert({
      created_by: admin.user.id,
      status: "queued",
      target: "pipedrive",
      summary: `Queued ${contacts.length} contact${contacts.length === 1 ? "" : "s"} for CRM push.`,
    })
    .select("id")
    .single();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  const items = contacts.map((contact) => ({
    job_id: job.id,
    source_entity: "contact",
    source_id: contact.id,
    target_type: "person",
    status: "queued",
    payload: contact,
  }));

  const { error: itemsError } = await supabase.from("crm_push_job_items").insert(items);
  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("contacts")
    .update({ crm_sync_status: "queued", updated_at: new Date().toISOString() })
    .in("id", contacts.map((contact) => contact.id));

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    actor_id: admin.user.id,
    action: "contacts_queued_for_crm_push",
    entity_type: "crm_push_job",
    entity_id: job.id,
    details: {
      contact_ids: contacts.map((contact) => contact.id),
      count: contacts.length,
    },
  });

  return NextResponse.json({
    ok: true,
    result: {
      jobId: job.id,
      queued: contacts.length,
    },
  });
}
