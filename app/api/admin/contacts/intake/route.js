import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeContactIntake, upsertContactIntake } from "@/lib/contacts/intake";

export const dynamic = "force-dynamic";

function getContactsFromBody(body) {
  if (Array.isArray(body.contacts)) return body.contacts;
  if (body.contact) return [body.contact];
  return [];
}

export async function POST(request) {
  const admin = await requireAdminRequest();
  if (admin.error) return admin.error;

  const body = await request.json().catch(() => ({}));
  const contacts = getContactsFromBody(body);

  if (contacts.length === 0) {
    return NextResponse.json({ error: "At least one contact is required." }, { status: 400 });
  }

  const validationErrors = contacts
    .map((contact, index) => ({
      row: index + 1,
      missing: normalizeContactIntake(contact).missing,
    }))
    .filter((result) => result.missing.length > 0);

  if (validationErrors.length > 0) {
    return NextResponse.json(
      { error: "Some contacts are missing mandatory fields.", validationErrors },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const stats = {
    created: 0,
    updated: 0,
    skipped: 0,
    total: contacts.length,
    results: [],
  };

  try {
    for (const contact of contacts) {
      const result = await upsertContactIntake(supabase, contact);
      if (result.outcome === "created") stats.created += 1;
      if (result.outcome === "updated") stats.updated += 1;
      if (result.outcome === "invalid") stats.skipped += 1;
      stats.results.push(result);
    }

    await supabase.from("audit_logs").insert({
      actor_id: admin.user.id,
      action: body.mode === "import" ? "contacts_file_import" : "contact_manual_create",
      entity_type: "contact",
      details: {
        mode: body.mode || "manual",
        created: stats.created,
        updated: stats.updated,
        skipped: stats.skipped,
        total: stats.total,
      },
    });

    return NextResponse.json({ ok: true, result: stats });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status || 500 }
    );
  }
}
