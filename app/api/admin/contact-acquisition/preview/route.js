import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin";
import { previewContactAcquisition } from "@/lib/contact-acquisition/importer";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const admin = await requireAdminRequest();
  if (admin.error) return admin.error;

  const body = await request.json().catch(() => ({}));

  try {
    const result = await previewContactAcquisition({ page: body.page || body.Page || 1 });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status || 500 }
    );
  }
}
