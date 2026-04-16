"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { SimpleTable } from "@/components/ui/SimpleTable";

const COMPANY_PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

function CompanyMetric({ label, value, detail }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-neutral-950">{value}</div>
      {detail ? <div className="mt-1 text-xs text-neutral-500">{detail}</div> : null}
    </div>
  );
}

function CompanyAcquisitionModal({ open, onClose, onImported }) {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [importInProgress, setImportInProgress] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const importAbortControllerRef = useRef(null);

  const loadPreview = useCallback(async () => {
    setStatus("previewing");
    setMessage("");

    const response = await fetch("/api/admin/company-acquisition/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sampleSize: 8 }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error || "Unable to load company acquisition preview.");
      setStatus("idle");
      return;
    }

    setPreview(payload.result);
    setPreviewLoaded(true);
    setStatus("idle");
  }, []);

  async function readImportProgress(response) {
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Import failed.");
    }

    if (!response.body) {
      const payload = await response.json();
      return payload.result;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult = null;

    function applyLine(line) {
      const trimmed = line.trim();
      if (!trimmed) return;

      const event = JSON.parse(trimmed);
      if (event.stats) {
        setImportSummary((current) => ({ ...(current || {}), ...event.stats }));
      }
      if (event.type === "complete") {
        finalResult = event.result;
        setImportSummary(event.result);
      }
      if (event.type === "error" || event.type === "failed" || event.type === "cancelled") {
        throw new Error(event.error || "Import failed.");
      }
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(applyLine);
    }

    if (buffer) applyLine(buffer);
    return finalResult;
  }

  async function importCompanies() {
    const abortController = new AbortController();
    importAbortControllerRef.current = abortController;
    setImportInProgress(true);
    setImportSummary({
      companies_total: preview?.companies_total ?? 0,
      companies_processed: 0,
      companies_updated: 0,
      companies_skipped: 0,
      companies_failed: 0,
      missing_office_id: preview?.missing_office_id ?? 0,
    });
    setStatus("importing");
    setMessage("");

    try {
      const response = await fetch("/api/admin/company-acquisition/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stream: true }),
        signal: abortController.signal,
      });
      const result = await readImportProgress(response);

      setStatus("idle");
      setMessage(`Bulk update complete. Updated ${result.companies_updated}, skipped ${result.companies_skipped}, failed ${result.companies_failed}.`);
      setImportSummary(result);
      onImported?.();
    } catch (error) {
      setStatus("idle");
      setMessage(error.name === "AbortError" ? "Import cancelled." : error.message || "Import failed.");
    } finally {
      importAbortControllerRef.current = null;
      setImportInProgress(false);
    }
  }

  function cancelImport() {
    importAbortControllerRef.current?.abort();
    importAbortControllerRef.current = null;
    setStatus("idle");
    setMessage("Import cancelled.");
    setImportInProgress(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        className={`relative w-full overflow-hidden rounded-lg bg-white shadow-xl ${
          importInProgress ? "h-[96vh] max-h-[96vh] max-w-5xl" : "max-h-[90vh] max-w-4xl"
        }`}
      >
        {importInProgress ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/90 backdrop-blur-sm">
            <div className="max-h-[calc(96vh-48px)] w-full max-w-sm overflow-y-auto rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-lg">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-950" />
              <div className="text-lg font-semibold text-neutral-950">Updating companies</div>
              <p className="mt-2 text-sm text-neutral-600">
                Pulling Glenigan company records from stored office IDs and updating Supabase.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-left">
                <div className="rounded-md bg-neutral-100 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">Companies</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-950">
                    {importSummary?.companies_total ?? preview?.companies_total ?? 0}
                  </div>
                </div>
                <div className="rounded-md bg-neutral-100 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">Updated</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-950">
                    {importSummary?.companies_updated ?? 0}
                  </div>
                </div>
                <div className="rounded-md bg-neutral-100 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">Skipped</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-950">
                    {importSummary?.companies_skipped ?? 0}
                  </div>
                </div>
                <div className="rounded-md bg-neutral-100 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">Failed</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-950">
                    {importSummary?.companies_failed ?? 0}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
                {status === "idle" && importSummary
                  ? "Bulk update complete. Refreshing companies..."
                  : importSummary?.current_company
                    ? `Processing ${importSummary.current_company}...`
                    : importSummary
                      ? `Processed ${importSummary.companies_processed ?? 0} of ${importSummary.companies_total ?? 0}. Missing office ID: ${importSummary.missing_office_id ?? 0}.`
                      : "Running company acquisition..."}
              </div>
              <Button type="button" variant="danger" className="mt-4 w-full" onClick={cancelImport}>
                Cancel update
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">Company acquisition</div>
            <h2 className="text-lg font-semibold text-neutral-950">Bulk update company data</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`overflow-y-auto px-5 py-4 ${importInProgress ? "max-h-[calc(96vh-150px)]" : "max-h-[calc(90vh-150px)]"}`}>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
            The updater uses stored Glenigan office IDs from imported contact/office records, then calls the company endpoint and writes the normalized payload back to the company table.
          </div>

          {previewLoaded && preview ? (
            <>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <CompanyMetric label="Companies" value={preview.companies_total} detail="Total company records" />
                <CompanyMetric label="Ready" value={preview.ready_companies} detail="Have a usable office ID" />
                <CompanyMetric label="Enriched" value={preview.enriched_companies} detail="Already synced from Glenigan" />
                <CompanyMetric label="Blocked" value={preview.missing_office_id} detail="Missing office ID" />
              </div>

              <div className="mt-5">
                <div className="mb-2 text-sm font-semibold text-neutral-900">Preview sample</div>
                <div className="space-y-2">
                  {(preview.preview || []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium text-neutral-900">{item.name}</div>
                        <div className="text-xs text-neutral-500">
                          {item.sector || "No sector"} {item.office_id ? `- officeId ${item.office_id}` : "- no officeId"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.source_last_seen_at ? <Badge tone="info">Enriched</Badge> : <Badge tone="default">Basic</Badge>}
                        <Badge tone={item.can_acquire ? "success" : "warning"}>
                          {item.can_acquire ? "Ready" : "Blocked"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
              Preview is optional. Click <span className="font-medium">Refresh preview</span> to load readiness and sample metrics before running the bulk update.
            </div>
          )}

          {message ? <div className="mt-4 rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{message}</div> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-4">
          <Button type="button" variant="secondary" onClick={loadPreview} disabled={status !== "idle"}>
            <Search size={16} /> {status === "previewing" ? "Previewing..." : previewLoaded ? "Refresh preview" : "Load preview"}
          </Button>
          <Button type="button" onClick={importCompanies} disabled={status !== "idle"}>
            <RefreshCw size={16} /> {status === "importing" ? "Updating..." : "Bulk update companies"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CompaniesWorkspace({ companies, isAdmin = false, pagination, metrics }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [acquisitionOpen, setAcquisitionOpen] = useState(false);

  const currentPage = Math.max(1, Number(pagination?.page) || 1);
  const pageSize = COMPANY_PAGE_SIZE_OPTIONS.includes(Number(pagination?.pageSize))
    ? Number(pagination.pageSize)
    : 25;
  const totalCount = Number(pagination?.totalCount) || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const stats = metrics || {
    total: totalCount,
    enriched: 0,
    basic: 0,
    linked: 0,
  };

  const updateCompaniesUrl = useCallback(
    (patch = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      const nextPage = patch.page ?? currentPage;
      const nextPageSize = patch.pageSize ?? pageSize;

      if (nextPage > 1) params.set("page", String(nextPage));
      else params.delete("page");

      if (nextPageSize !== 25) params.set("pageSize", String(nextPageSize));
      else params.delete("pageSize");

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [currentPage, pageSize, pathname, router, searchParams]
  );

  const columns = [
    { header: "Company", accessor: "name" },
    { header: "Sector", accessor: "sector" },
    { header: "Contacts", accessor: "contact_count" },
    { header: "Projects", accessor: "project_count" },
    {
      header: "Data",
      accessor: "source_last_seen_at",
      cell: (row) =>
        row.source_last_seen_at ? <Badge tone="info">Enriched</Badge> : <Badge tone="default">Basic</Badge>,
    },
    {
      header: "CRM",
      accessor: "crm_org_id",
      cell: (row) =>
        row.crm_org_id ? <Badge tone="success">Linked</Badge> : <Badge tone="warning">Not linked</Badge>,
    },
    {
      header: "Actions",
      accessor: "actions",
      cell: (row) => (
        <div className="flex gap-2">
          <Link
            href={`/companies/${row.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200"
          >
            Review
          </Link>
          <Button variant="ghost" size="sm">Push</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">Grouping</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Companies & Offices</h1>
          <p className="text-sm text-neutral-600">Batch review contacts at company level.</p>
        </div>
        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setAcquisitionOpen(true)}>
              <RefreshCw size={16} /> Company acquisition
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <CompanyMetric label="Total companies" value={stats.total} detail="Visible company records" />
        <CompanyMetric label="Enriched" value={stats.enriched} detail="Have company data from Glenigan" />
        <CompanyMetric label="Basic" value={stats.basic} detail="Not enriched yet" />
        <CompanyMetric label="CRM linked" value={stats.linked} detail="Linked to CRM orgs" />
      </div>

      <Card>
        <CardBody className="space-y-4">
          <SimpleTable columns={columns} data={companies} />
          <div className="flex flex-col gap-3 text-sm text-neutral-600 md:flex-row md:items-center md:justify-between">
            <div>
              Showing {totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1}
              {"-"}
              {Math.min((safePage - 1) * pageSize + companies.length, totalCount)} of {totalCount}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2">
                <span>Rows</span>
                <select
                  value={pageSize}
                  onChange={(event) => updateCompaniesUrl({ page: 1, pageSize: Number(event.target.value) })}
                  className="rounded-md border border-neutral-200 px-2 py-1.5 text-sm focus:border-black focus:outline-none"
                >
                  {COMPANY_PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => updateCompaniesUrl({ page: Math.max(1, safePage - 1) })}
                disabled={safePage <= 1}
              >
                <ChevronLeft size={16} /> Previous
              </Button>
              <span className="px-2 text-neutral-700">
                Page {safePage} of {totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => updateCompaniesUrl({ page: Math.min(totalPages, safePage + 1) })}
                disabled={safePage >= totalPages}
              >
                Next <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {isAdmin ? (
        <CompanyAcquisitionModal
          open={acquisitionOpen}
          onClose={() => setAcquisitionOpen(false)}
          onImported={() => {
            setAcquisitionOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
