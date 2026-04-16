import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin";
import { acquireCompanyData } from "@/lib/company-acquisition/service";

export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  const admin = await requireAdminRequest();
  if (admin.error) return admin.error;

  const { companyId } = await params;

  try {
    const result = await acquireCompanyData(companyId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status || 500 }
    );
  }
}
