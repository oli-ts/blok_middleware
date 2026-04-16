"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SourcePayloadModal } from "@/components/contacts/SourcePayloadModal";

export function CompanyAcquisitionPanel({
  companyId,
  lastSyncedAt,
  initialRawPayload = null,
  canRefresh = false,
}) {
  const router = useRouter();
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [rawPayload, setRawPayload] = useState(initialRawPayload);

  async function fetchCompanyData() {
    setStatus("loading");
    setMessage("");

    const response = await fetch(`/api/admin/company-acquisition/${companyId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const payload = await response.json();

    if (!response.ok) {
      setStatus("idle");
      setMessage(payload.error || "Unable to fetch company data.");
      return;
    }

    setRawPayload(payload.result?.rawResponse || null);
    setStatus("idle");
    setMessage(`Company data refreshed using officeId ${payload.result.officeId}.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <SourcePayloadModal
          payload={rawPayload}
          source="Glenigan company"
          buttonLabel={canRefresh ? "View raw API response" : "View raw response"}
        />
        {canRefresh ? (
          <Button type="button" onClick={fetchCompanyData} disabled={status === "loading"}>
            <RefreshCw size={16} className={status === "loading" ? "animate-spin" : ""} />
            {status === "loading" ? "Fetching company data..." : "Fetch company data"}
          </Button>
        ) : null}
      </div>
      <div className="text-right text-xs text-neutral-500">
        {lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}` : "No company data synced yet."}
      </div>
      {message ? <div className="max-w-sm rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{message}</div> : null}
    </div>
  );
}
