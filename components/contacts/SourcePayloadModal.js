"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

function formatPayload(payload) {
  if (!payload) return "";
  return JSON.stringify(payload, null, 2);
}

export function SourcePayloadModal({ payload, source = "Source", buttonLabel = "View raw response", className = "" }) {
  const [open, setOpen] = useState(false);
  const formattedPayload = useMemo(() => formatPayload(payload), [payload]);
  const hasPayload = Boolean(payload);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
        disabled={!hasPayload}
      >
        {buttonLabel}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-500">{source}</div>
                <h2 className="text-lg font-semibold text-neutral-950">Raw API response</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(90vh-140px)] overflow-auto p-5">
              <pre className="whitespace-pre-wrap rounded-lg bg-neutral-950 p-4 text-xs leading-relaxed text-neutral-100">
                {formattedPayload}
              </pre>
            </div>

            <div className="flex justify-end border-t border-neutral-200 px-5 py-4">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
