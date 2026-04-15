import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdminRequest } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function isAcceptedFile(fileName) {
  const normalized = String(fileName || "").toLowerCase();
  return normalized.endsWith(".csv") || normalized.endsWith(".xlsx");
}

export async function POST(request) {
  const admin = await requireAdminRequest();
  if (admin.error) return admin.error;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "A CSV or XLSX file is required." }, { status: 400 });
  }

  if (!isAcceptedFile(file.name)) {
    return NextResponse.json({ error: "Only CSV and XLSX files are supported." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File is too large. Maximum size is 10MB." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return NextResponse.json({ error: "No worksheet found in file." }, { status: 400 });
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });

    return NextResponse.json({
      rows,
      totalRows: rows.length,
      capped: false,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Unable to parse file: ${error.message}` },
      { status: 400 }
    );
  }
}
