import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin";
import { previewCompanyAcquisition } from "@/lib/company-acquisition/service";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const admin = await requireAdminRequest();
  if (admin.error) return admin.error;

  const body = await request.json().catch(() => ({}));

  try {
    const result = await previewCompanyAcquisition({
      sampleSize: body.sampleSize || 8,
      signal: request.signal,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status || 500 }
    );
  }
}
