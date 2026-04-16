"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, ChevronLeft, ChevronRight, ExternalLink, FileSpreadsheet, Plus, RefreshCw, Search, Settings, Trash2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { SourcePayloadModal } from "@/components/contacts/SourcePayloadModal";

const REQUIRED_CONTACT_FIELDS = ["first_name", "last_name", "job_title", "email", "company", "source"];
const CREATE_CONTACT_DEFAULT = {
  first_name: "",
  last_name: "",
  job_title: "",
  email: "",
  company: "",
  phone: "",
  linkedin_url: "",
  source: "Manual",
  acquisition_contact_type: "secondary",
};
const IMPORT_FIELD_LABELS = [
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["job_title", "Job title"],
  ["email", "Email"],
  ["company", "Company"],
  ["phone", "Phone"],
  ["linkedin_url", "LinkedIn"],
  ["source", "Source"],
];
const CONTACT_PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

function ContactMetric({ label, value, detail }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-neutral-950">{value}</div>
      {detail ? <div className="mt-1 text-xs text-neutral-500">{detail}</div> : null}
    </div>
  );
}

function getContactName(contact) {
  const name = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
  return name || contact.email || "Unnamed contact";
}

function getPhoneNumbers(contact) {
  if (Array.isArray(contact.phone_numbers) && contact.phone_numbers.length > 0) {
    return contact.phone_numbers.filter(Boolean);
  }
  return contact.phone ? [contact.phone] : [];
}

function cleanText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function capitalizeFirstLetter(value) {
  const cleaned = String(value || "").replace(/^\s+/, "");
  if (!cleaned) return "";
  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`;
}

function firstImportedValue(row, keys) {
  const entries = Object.entries(row || {});
  for (const key of keys) {
    const direct = cleanText(row?.[key]);
    if (direct) return direct;

    const match = entries.find(([entryKey]) => entryKey.toLowerCase().trim() === key.toLowerCase());
    const value = cleanText(match?.[1]);
    if (value) return value;
  }
  return "";
}

function mapImportedRow(row, index) {
  return {
    client_id: `import-${index}-${Date.now()}`,
    first_name: firstImportedValue(row, ["first_name", "First Name", "FirstName", "Forename"]),
    last_name: firstImportedValue(row, ["last_name", "Last Name", "LastName", "Surname"]),
    job_title: firstImportedValue(row, ["job_title", "Job Title", "JobTitle", "Title"]),
    email: firstImportedValue(row, ["email", "Email", "Email Address", "EmailAddress"]),
    company: firstImportedValue(row, ["company", "Company", "Company Name", "CompanyName"]),
    phone: firstImportedValue(row, ["phone", "Phone", "Phone Number", "PhoneNumber", "Mobile"]),
    linkedin_url: firstImportedValue(row, ["linkedin_url", "LinkedIn", "LinkedIn URL", "Linkedin"]),
    source: capitalizeFirstLetter(firstImportedValue(row, ["source", "Source"]) || "Imported"),
    acquisition_contact_type:
      firstImportedValue(row, ["acquisition_contact_type", "Contact Type", "contact_type"]).toLowerCase() === "primary"
        ? "primary"
        : "secondary",
    raw: row,
  };
}

function getMissingContactFields(contact) {
  return REQUIRED_CONTACT_FIELDS.filter((field) => !cleanText(contact[field]));
}

function TextField({ label, value, onChange, required = false, type = "text", placeholder }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-neutral-700">
        {label} {required ? <span className="text-red-600">*</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
      />
    </label>
  );
}

function ContactIntakeModal({ open, onClose, onSaved }) {
  const [tab, setTab] = useState("create");
  const [createForm, setCreateForm] = useState(CREATE_CONTACT_DEFAULT);
  const [importRows, setImportRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  function updateCreateField(field, value) {
    setCreateForm((current) => ({
      ...current,
      [field]: field === "source" ? capitalizeFirstLetter(value) : value,
    }));
  }

  function updateImportRow(index, field, value) {
    setImportRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? { ...row, [field]: field === "source" ? capitalizeFirstLetter(value) : value }
          : row
      )
    );
  }

  function removeImportRow(index) {
    setImportRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function saveContacts(mode, contacts) {
    setStatus("saving");
    setMessage("");

    const response = await fetch("/api/admin/contacts/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, contacts }),
    });
    const payload = await response.json();

    if (!response.ok) {
      const validationSummary = payload.validationErrors
        ? ` ${payload.validationErrors.length} row(s) need required fields.`
        : "";
      setMessage(`${payload.error || "Unable to save contacts."}${validationSummary}`);
      setStatus("idle");
      return;
    }

    setStatus("idle");
    setMessage(`Saved. Created ${payload.result.created}, updated ${payload.result.updated}.`);
    onSaved?.();
  }

  async function saveCreateContact() {
    const missing = getMissingContactFields(createForm);
    if (missing.length > 0) {
      setMessage(`Missing required fields: ${missing.join(", ")}.`);
      return;
    }

    await saveContacts("manual", [{ ...createForm, source: capitalizeFirstLetter(createForm.source) }]);
  }

  async function parseImportFile(file) {
    if (!file) return;

    setStatus("parsing");
    setMessage("");
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/contacts/intake/parse", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to parse file.");
      }

      const rows = payload.rows || [];
      setImportRows(rows.map(mapImportedRow));
      setMessage(
        rows.length
          ? `Parsed ${rows.length} row(s).${payload.capped ? ` Showing first ${rows.length} of ${payload.totalRows}.` : ""} Review and edit before saving.`
          : "No rows found in file."
      );
    } catch (error) {
      setImportRows([]);
      setMessage(error.message);
    } finally {
      setStatus("idle");
    }
  }

  async function saveImportContacts() {
    const invalidRows = importRows
      .map((row, index) => ({ index: index + 1, missing: getMissingContactFields(row) }))
      .filter((row) => row.missing.length > 0);

    if (invalidRows.length > 0) {
      setMessage(`Fix required fields before saving. ${invalidRows.length} row(s) are incomplete.`);
      return;
    }

    await saveContacts(
      "import",
      importRows.map((row) => ({
        ...row,
        source: capitalizeFirstLetter(row.source),
        source_payload: row.raw,
      }))
    );
  }

  if (!open) return null;

  const createMissing = getMissingContactFields(createForm);
  const importInvalidCount = importRows.filter((row) => getMissingContactFields(row).length > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">Contact intake</div>
            <h2 className="text-lg font-semibold text-neutral-950">Create or import contacts</h2>
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

        <div className="border-b border-neutral-200 px-5 pt-4">
          <div className="flex gap-2">
            {[
              ["create", "Create"],
              ["import", "Import"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTab(value);
                  setMessage("");
                }}
                className={`rounded-t-md px-4 py-2 text-sm font-medium ${
                  tab === value
                    ? "border border-b-white border-neutral-200 bg-white text-neutral-950"
                    : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[calc(90vh-170px)] overflow-y-auto px-5 py-4">
          {tab === "create" ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                Required fields are marked with <span className="font-semibold text-red-600">*</span>. Source is editable and always saved with a capital first letter.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="First name" required value={createForm.first_name} onChange={(value) => updateCreateField("first_name", value)} />
                <TextField label="Last name" required value={createForm.last_name} onChange={(value) => updateCreateField("last_name", value)} />
                <TextField label="Job title" required value={createForm.job_title} onChange={(value) => updateCreateField("job_title", value)} />
                <TextField label="Email" required type="email" value={createForm.email} onChange={(value) => updateCreateField("email", value)} />
                <TextField label="Company" required value={createForm.company} onChange={(value) => updateCreateField("company", value)} />
                <TextField label="Source" required value={createForm.source} onChange={(value) => updateCreateField("source", value)} />
                <TextField label="Phone" value={createForm.phone} onChange={(value) => updateCreateField("phone", value)} />
                <TextField label="LinkedIn" value={createForm.linkedin_url} onChange={(value) => updateCreateField("linkedin_url", value)} />
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-neutral-700">Contact type</span>
                  <select
                    value={createForm.acquisition_contact_type}
                    onChange={(event) => updateCreateField("acquisition_contact_type", event.target.value)}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                  </select>
                </label>
              </div>
              {createMissing.length > 0 ? (
                <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Missing required fields: {createMissing.join(", ")}.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                Upload a CSV or XLSX file. Headers are auto-mapped into the contact schema, then you can confirm and edit every row before saving.
              </div>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-8 text-center hover:bg-neutral-50">
                <Upload size={24} className="text-neutral-500" />
                <span className="mt-2 text-sm font-medium text-neutral-900">Upload CSV or XLSX</span>
                <span className="mt-1 text-xs text-neutral-500">Accepted: .csv, .xlsx</span>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={(event) => parseImportFile(event.target.files?.[0])}
                />
              </label>

              {fileName ? (
                <div className="flex items-center gap-2 text-sm text-neutral-700">
                  <FileSpreadsheet size={16} /> {fileName}
                </div>
              ) : null}

              {importRows.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-neutral-900">
                      Review import rows ({importRows.length})
                    </div>
                    {importInvalidCount > 0 ? (
                      <Badge tone="warning">{importInvalidCount} incomplete</Badge>
                    ) : (
                      <Badge tone="success">Ready to save</Badge>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-neutral-200">
                    <table className="min-w-[1100px] divide-y divide-neutral-200">
                      <thead className="bg-neutral-50">
                        <tr>
                          {IMPORT_FIELD_LABELS.map(([, label]) => (
                            <th key={label} className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                              {label}
                            </th>
                          ))}
                          <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Type</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 bg-white">
                        {importRows.map((row, rowIndex) => {
                          const missing = getMissingContactFields(row);
                          return (
                            <tr key={row.client_id}>
                              {IMPORT_FIELD_LABELS.map(([field]) => (
                                <td key={`${row.client_id}-${field}`} className="px-2 py-2 align-top">
                                  <input
                                    value={row[field] || ""}
                                    onChange={(event) => updateImportRow(rowIndex, field, event.target.value)}
                                    className={`w-full min-w-32 rounded-md border px-2 py-1.5 text-sm focus:border-black focus:outline-none ${
                                      missing.includes(field) ? "border-amber-300 bg-amber-50" : "border-neutral-200"
                                    }`}
                                  />
                                </td>
                              ))}
                              <td className="px-2 py-2 align-top">
                                <select
                                  value={row.acquisition_contact_type}
                                  onChange={(event) => updateImportRow(rowIndex, "acquisition_contact_type", event.target.value)}
                                  className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-sm focus:border-black focus:outline-none"
                                >
                                  <option value="primary">Primary</option>
                                  <option value="secondary">Secondary</option>
                                </select>
                              </td>
                              <td className="px-2 py-2 align-top">
                                <button
                                  type="button"
                                  onClick={() => removeImportRow(rowIndex)}
                                  className="rounded-md p-2 text-neutral-500 hover:bg-red-50 hover:text-red-700"
                                  aria-label="Remove row"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {message ? <div className="mt-4 rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{message}</div> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={status !== "idle"}>
            Cancel
          </Button>
          {tab === "create" ? (
            <Button type="button" onClick={saveCreateContact} disabled={status !== "idle" || createMissing.length > 0}>
              <Plus size={16} /> {status === "saving" ? "Saving..." : "Create contact"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={saveImportContacts}
              disabled={status !== "idle" || importRows.length === 0 || importInvalidCount > 0}
            >
              <Upload size={16} /> {status === "saving" ? "Saving..." : "Save import"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactAcquisitionModal({ open, onClose, onImported }) {
  const [rules, setRules] = useState([]);
  const [runs, setRuns] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);
  const [importInProgress, setImportInProgress] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const importAbortControllerRef = useRef(null);

  const estimatedContactsFound = useMemo(() => {
    if (!Array.isArray(preview?.previews)) return null;
    const totals = preview.previews
      .map((item) => (typeof item.total === "number" ? item.total : null))
      .filter((total) => total !== null);
    if (totals.length === 0) return null;
    return totals.reduce((sum, total) => sum + total, 0);
  }, [preview]);

  const loadRules = useCallback(async () => {
    setStatus("loading");
    setMessage("");
    const response = await fetch("/api/admin/contact-acquisition/rules", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error || "Unable to load contact acquisition rules.");
      setStatus("idle");
      return;
    }

    setRules(payload.rules || []);
    setRuns(payload.runs || []);
    setStatus("idle");
  }, []);

  useEffect(() => {
    if (open) loadRules();
  }, [loadRules, open]);

  function addRule() {
    const jobTitle = newTitle.trim();
    if (!jobTitle) return;

    setRules((current) => [
      ...current,
      {
        job_title: jobTitle,
        contact_type: "secondary",
        priority: current.length + 1,
        active: true,
      },
    ]);
    setNewTitle("");
  }

  function updateRule(index, patch) {
    setRules((current) => current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  function removeRule(index) {
    setRules((current) => current.filter((_, i) => i !== index));
  }

  async function saveRules() {
    setStatus("saving");
    setMessage("");
    const response = await fetch("/api/admin/contact-acquisition/rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error || "Unable to save rules.");
      setStatus("idle");
      return false;
    }

    setRules(payload.rules || []);
    setStatus("idle");
    setMessage("Rules saved.");
    return true;
  }

  async function previewImport() {
    const saved = await saveRules();
    if (!saved) return;

    setStatus("previewing");
    const response = await fetch("/api/admin/contact-acquisition/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: 1 }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error || "Preview failed.");
      setStatus("idle");
      return;
    }

    setPreview(payload.result);
    setStatus("idle");
    setMessage("Preview loaded.");
  }

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

  async function importContacts() {
    const abortController = new AbortController();
    importAbortControllerRef.current = abortController;
    setImportInProgress(true);
    setImportSummary(null);
    const saved = await saveRules();
    if (!saved) {
      importAbortControllerRef.current = null;
      setImportInProgress(false);
      return;
    }

    if (estimatedContactsFound === null) {
      setStatus("previewing");
      const previewResponse = await fetch("/api/admin/contact-acquisition/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: 1 }),
        signal: abortController.signal,
      });
      const previewPayload = await previewResponse.json().catch(() => ({}));
      if (previewResponse.ok) {
        setPreview(previewPayload.result);
      }
    }

    setStatus("importing");
    setImportSummary({
      contacts_seen: 0,
      contacts_found_total: estimatedContactsFound ?? null,
      contacts_created: 0,
      contacts_updated: 0,
      contacts_skipped: 0,
    });

    try {
      const response = await fetch("/api/admin/contact-acquisition/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stream: true }),
        signal: abortController.signal,
      });
      const result = await readImportProgress(response);

      setStatus("idle");
      setMessage(
        `Import complete. Created ${result.contacts_created}, updated ${result.contacts_updated}.`
      );
      setImportSummary(result);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setImportInProgress(false);
      await loadRules();
      onImported?.();
    } catch (error) {
      setMessage(error.name === "AbortError" ? "Import cancelled." : error.message || "Import failed.");
      setStatus("idle");
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
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
        {importInProgress ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/90 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-lg">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-950" />
              <div className="text-lg font-semibold text-neutral-950">Importing contacts</div>
              <p className="mt-2 text-sm text-neutral-600">
                Pulling every matching Glenigan page, mapping contacts to the schema, and updating Supabase.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-left">
                <div className="rounded-md bg-neutral-100 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">Contacts found</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-950">
                    {importSummary?.contacts_found_total ?? estimatedContactsFound ?? "Searching"}
                  </div>
                </div>
                <div className="rounded-md bg-neutral-100 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">Updated</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-950">
                    {importSummary?.contacts_updated ?? 0}
                  </div>
                </div>
                <div className="rounded-md bg-neutral-100 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">Created</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-950">
                    {importSummary?.contacts_created ?? 0}
                  </div>
                </div>
                <div className="rounded-md bg-neutral-100 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">Skipped</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-950">
                    {importSummary?.contacts_skipped ?? 0}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
                {status === "saving"
                  ? "Saving acquisition rules..."
                  : status === "previewing"
                    ? "Counting matching contacts..."
                    : status === "idle" && importSummary
                      ? "Import complete. Refreshing contacts..."
                      : importSummary
                      ? importSummary.current_rule
                        ? `Processing ${importSummary.current_rule} page ${importSummary.current_page || 1}...`
                        : "Running contact import..."
                      : "Running contact import..."}
              </div>
              <Button type="button" variant="danger" className="mt-4 w-full" onClick={cancelImport}>
                Cancel import
              </Button>
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">Contact acquisition</div>
            <h2 className="text-lg font-semibold text-neutral-950">Curated job-title rules</h2>
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

        <div className="max-h-[calc(90vh-150px)] overflow-y-auto px-5 py-4">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
            Each active rule searches Glenigan with an Elastic <code className="rounded bg-white px-1.5 py-0.5">match_phrase</code> on <code className="rounded bg-white px-1.5 py-0.5">JobTitle</code>.
            The selector stores whether matched contacts are primary or secondary.
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addRule();
              }}
              placeholder="Add job title, e.g. facilities manager"
              className="min-w-0 flex-1 rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
            <Button type="button" variant="secondary" onClick={addRule}>
              <Plus size={16} /> Add
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {rules.map((rule, index) => (
              <div key={rule.id || `${rule.job_title}-${index}`} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
                <input
                  value={rule.job_title}
                  onChange={(event) => updateRule(index, { job_title: event.target.value })}
                  className="min-w-0 rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                />
                <select
                  value={rule.contact_type || "secondary"}
                  onChange={(event) => updateRule(index, { contact_type: event.target.value })}
                  className="rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </select>
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={rule.active !== false}
                    onChange={(event) => updateRule(index, { active: event.target.checked })}
                    className="h-4 w-4"
                  />
                  Active
                </label>
                <button
                  type="button"
                  onClick={() => removeRule(index)}
                  className="rounded-md p-2 text-neutral-500 hover:bg-red-50 hover:text-red-700"
                  aria-label="Remove rule"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {preview ? (
            <div className="mt-5 space-y-3">
              <div className="text-sm font-semibold text-neutral-900">Preview</div>
              {preview.previews.map((item) => (
                <div key={item.rule.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{item.rule.job_title}</div>
                    <Badge tone={item.rule.contact_type === "primary" ? "success" : "info"}>
                      {item.rule.contact_type}
                    </Badge>
                  </div>
                  <div className="mt-1 text-neutral-600">Returned {item.returned} of {item.total ?? "unknown"}.</div>
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    {item.mapped.map((contact) => (
                      <div key={`${item.rule.id}-${contact.source_ref}`} className="rounded-md bg-neutral-50 p-2">
                        <div className="font-medium">{`${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unnamed"}</div>
                        <div className="text-xs text-neutral-500">{contact.job_title || "No title"}</div>
                        <div className="text-xs text-neutral-500">{contact.company || "No company"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-5">
            <div className="mb-2 text-sm font-semibold text-neutral-900">Recent imports</div>
            <div className="space-y-2">
              {runs.length === 0 ? (
                <div className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-500">
                  No imports yet.
                </div>
                ) : (
                  runs.map((run) => (
                    <div key={run.id} className="rounded-md border border-neutral-200 px-3 py-2 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div>
                            <span className="font-medium">{run.status}</span>
                            <span className="text-neutral-500"> - {run.started_at ? new Date(run.started_at).toLocaleString() : "not started"}</span>
                          </div>
                          {run.error_message ? (
                            <div className="mt-1 text-xs text-red-700">{run.error_message}</div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {run.details?.error_payload ? (
                            <SourcePayloadModal
                              payload={run.details.error_payload}
                              source="Recent contact import error"
                              buttonLabel="Error payload"
                            />
                          ) : null}
                          <div className="text-neutral-600">
                            +{run.contacts_created || 0} / {run.contacts_updated || 0} updated
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          {message ? <div className="mt-4 rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{message}</div> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-4">
          <Button type="button" variant="secondary" onClick={saveRules} disabled={status !== "idle"}>
            Save rules
          </Button>
          <Button type="button" variant="secondary" onClick={previewImport} disabled={status !== "idle"}>
            <Search size={16} /> {status === "previewing" ? "Previewing..." : "Preview"}
          </Button>
          <Button type="button" onClick={importContacts} disabled={status !== "idle"}>
            <RefreshCw size={16} /> {status === "importing" ? "Importing..." : "Import contacts"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ContactsWorkspace({ contacts, isAdmin = false, pagination, metrics }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(pagination?.search || "");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [acquisitionOpen, setAcquisitionOpen] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [crmPushStatus, setCrmPushStatus] = useState("idle");
  const [crmPushMessage, setCrmPushMessage] = useState("");
  const currentPage = Math.max(1, Number(pagination?.page) || 1);
  const pageSize = CONTACT_PAGE_SIZE_OPTIONS.includes(Number(pagination?.pageSize))
    ? Number(pagination.pageSize)
    : 25;
  const totalCount = Number(pagination?.totalCount) || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const stats = metrics || {
    total: totalCount,
    needsReview: 0,
    pushed: 0,
    primary: 0,
    secondary: 0,
  };

  const updateContactsUrl = useCallback(
    (patch = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      const nextPage = patch.page ?? currentPage;
      const nextPageSize = patch.pageSize ?? pageSize;
      const nextSearch = patch.q ?? search;

      if (nextPage > 1) params.set("page", String(nextPage));
      else params.delete("page");

      if (nextPageSize !== 25) params.set("pageSize", String(nextPageSize));
      else params.delete("pageSize");

      if (String(nextSearch || "").trim()) params.set("q", String(nextSearch).trim());
      else params.delete("q");

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [currentPage, pageSize, pathname, router, search, searchParams]
  );

  useEffect(() => {
    setSearch(pagination?.search || "");
  }, [pagination?.search]);

  useEffect(() => {
    setSelectedContactIds([]);
  }, [contacts]);

  useEffect(() => {
    const normalizedSearch = search.trim();
    if (normalizedSearch === (pagination?.search || "")) return undefined;

    const timeout = setTimeout(() => {
      updateContactsUrl({ page: 1, q: normalizedSearch });
    }, 350);

    return () => clearTimeout(timeout);
  }, [pagination?.search, search, updateContactsUrl]);

  const selectedContactIdSet = useMemo(() => new Set(selectedContactIds), [selectedContactIds]);
  const allVisibleSelected =
    contacts.length > 0 && contacts.every((contact) => selectedContactIdSet.has(contact.id));

  function toggleContactSelection(contactId) {
    setSelectedContactIds((current) =>
      current.includes(contactId)
        ? current.filter((id) => id !== contactId)
        : [...current, contactId]
    );
  }

  function toggleVisibleSelection() {
    if (allVisibleSelected) {
      const visibleIds = new Set(contacts.map((contact) => contact.id));
      setSelectedContactIds((current) => current.filter((id) => !visibleIds.has(id)));
      return;
    }

    setSelectedContactIds((current) =>
      Array.from(new Set([...current, ...contacts.map((contact) => contact.id)]))
    );
  }

  async function pushContactsToCrm(contactIds) {
    const ids = Array.from(new Set(contactIds.filter(Boolean)));
    if (ids.length === 0) {
      setCrmPushMessage("Select at least one contact to push.");
      return;
    }

    setCrmPushStatus("pushing");
    setCrmPushMessage("");

    const response = await fetch("/api/admin/crm/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: ids }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setCrmPushStatus("idle");
      setCrmPushMessage(payload.error || "Unable to queue CRM push.");
      return;
    }

    setCrmPushStatus("idle");
    setSelectedContactIds([]);
    setCrmPushMessage(`Queued ${payload.result.queued} contact${payload.result.queued === 1 ? "" : "s"} for CRM push.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">Contact operations</p>
          <h1 className="text-2xl font-semibold text-neutral-950">Contacts</h1>
          <p className="text-sm text-neutral-600">
            Review duplicates, validate contacts, and prepare records for CRM sync.
          </p>
        </div>
        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setIntakeOpen(true)}>
              <Plus size={16} /> Add contact
            </Button>
            <Button variant="secondary" onClick={() => setAcquisitionOpen(true)}>
              <Settings size={16} /> Contact acquisition
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <ContactMetric label="Total contacts" value={stats.total} detail="Current review queue" />
        <ContactMetric label="Primary contacts" value={stats.primary} detail="From acquisition rules" />
        <ContactMetric label="Secondary contacts" value={stats.secondary} detail="From acquisition rules" />
        <ContactMetric label="Needs review" value={stats.needsReview} detail="Validation not verified" />
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <ArrowDownUp size={16} /> Review queue
            </div>
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              {isAdmin && selectedContactIds.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => pushContactsToCrm(selectedContactIds)}
                  disabled={crmPushStatus === "pushing"}
                >
                  {crmPushStatus === "pushing" ? "Queuing..." : `Push selected to CRM (${selectedContactIds.length})`}
                </Button>
              ) : null}
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, role, company, email"
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-black focus:outline-none md:w-80"
              />
            </div>
          </div>

          {crmPushMessage ? (
            <div className="rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
              {crmPushMessage}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleVisibleSelection}
                      aria-label="Select visible contacts"
                      className="h-4 w-4"
                    />
                  </th>
                  {["Contact", "Company", "Source", "Acquisition", "Phone number(s)", "LinkedIn", "CRM", "Actions"].map((header) => (
                    <th key={header} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white text-sm">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedContactIdSet.has(contact.id)}
                        onChange={() => toggleContactSelection(contact.id)}
                        aria-label={`Select ${getContactName(contact)}`}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-neutral-950">{getContactName(contact)}</div>
                      <div className="text-xs text-neutral-500">{contact.job_title || "No role"} - {contact.email || "No email"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-neutral-900">{contact.company || "Unknown company"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={contact.source === "Glengian" ? "info" : "default"}>
                        {contact.source || "Manual"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={contact.acquisition_contact_type === "primary" ? "success" : "info"}>
                          {contact.acquisition_contact_type || "manual"}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {getPhoneNumbers(contact).length > 0 ? (
                        <div className="space-y-1">
                          {getPhoneNumbers(contact).map((phone) => (
                            <div key={phone} className="text-sm text-neutral-800">{phone}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-400">None</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {contact.linkedin_url ? (
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
                        >
                          LinkedIn <ExternalLink size={14} />
                        </a>
                      ) : (
                        <span className="text-neutral-400">None</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={contact.crm_sync_status === "pushed" ? "success" : "warning"}>
                        {contact.crm_sync_status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
                        >
                          View
                        </Link>
                        {isAdmin ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => pushContactsToCrm([contact.id])}
                            disabled={crmPushStatus === "pushing"}
                          >
                            Push to CRM
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm text-neutral-500">
                      No contacts match the current search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 text-sm text-neutral-600 md:flex-row md:items-center md:justify-between">
            <div>
              Showing {totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1}
              {"-"}
              {Math.min((safePage - 1) * pageSize + contacts.length, totalCount)} of {totalCount}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2">
                <span>Rows</span>
                <select
                  value={pageSize}
                  onChange={(event) => updateContactsUrl({ page: 1, pageSize: Number(event.target.value) })}
                  className="rounded-md border border-neutral-200 px-2 py-1.5 text-sm focus:border-black focus:outline-none"
                >
                  {CONTACT_PAGE_SIZE_OPTIONS.map((option) => (
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
                onClick={() => updateContactsUrl({ page: Math.max(1, safePage - 1) })}
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
                onClick={() => updateContactsUrl({ page: Math.min(totalPages, safePage + 1) })}
                disabled={safePage >= totalPages}
              >
                Next <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {isAdmin ? (
        <>
          <ContactIntakeModal
            open={intakeOpen}
            onClose={() => setIntakeOpen(false)}
            onSaved={() => {
              setIntakeOpen(false);
              router.refresh();
            }}
          />
          <ContactAcquisitionModal
            open={acquisitionOpen}
            onClose={() => setAcquisitionOpen(false)}
            onImported={() => {
              setAcquisitionOpen(false);
              router.refresh();
            }}
          />
        </>
      ) : null}
    </div>
  );
}
