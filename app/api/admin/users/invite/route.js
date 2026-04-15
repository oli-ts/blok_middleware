import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeRole(value) {
  return value === "admin" ? "admin" : "user";
}

function getRedirectTo(request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  const origin = configured || new URL(request.url).origin;
  return `${origin.replace(/\/+$/, "")}/login`;
}

export async function POST(request) {
  const admin = await requireAdminRequest();
  if (admin.error) return admin.error;

  const body = await request.json().catch(() => ({}));
  const email = cleanString(body.email).toLowerCase();
  const fullName = cleanString(body.full_name || body.fullName);
  const department = cleanString(body.department);
  const role = normalizeRole(body.role);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName || null,
      department: department || null,
      role,
    },
    redirectTo: getRedirectTo(request),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }

  const invitedUser = data?.user;
  if (!invitedUser?.id) {
    return NextResponse.json({ error: "Supabase did not return an invited user." }, { status: 500 });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: invitedUser.id,
        role,
        full_name: fullName || null,
        department: department || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    actor_id: admin.user.id,
    action: "user_invited",
    entity_type: "profile",
    entity_id: invitedUser.id,
    details: {
      email,
      role,
      full_name: fullName || null,
      department: department || null,
    },
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: invitedUser.id,
      email,
      role,
      full_name: fullName || null,
      department: department || null,
    },
  });
}
