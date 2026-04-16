import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin";
import { runCompanyAcquisitionImport } from "@/lib/company-acquisition/service";

export const dynamic = "force-dynamic";

function streamImport(signal) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const write = (event) => {
          if (signal?.aborted) return;

          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          } catch {
            // Client disconnected; the importer checks request.signal and exits cooperatively.
          }
        };

        try {
          const result = await runCompanyAcquisitionImport({
            onProgress: write,
            signal,
          });
          write({ type: "complete", result });
        } catch (error) {
          write({
            type: error.name === "AbortError" ? "cancelled" : "error",
            error: error.name === "AbortError" ? "Import cancelled." : error.message,
          });
        } finally {
          try {
            controller.close();
          } catch {
            // The stream may already be closed after a client abort.
          }
        }
      },
    }),
    {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
      },
    }
  );
}

export async function POST(request) {
  const admin = await requireAdminRequest();
  if (admin.error) return admin.error;

  const body = await request.json().catch(() => ({}));

  if (body.stream === true) {
    return streamImport(request.signal);
  }

  try {
    const result = await runCompanyAcquisitionImport({
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
