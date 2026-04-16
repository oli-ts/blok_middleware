import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchCompanyDetail } from "../../../../lib/queries";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { Card, CardBody, CardHeader } from "../../../../components/ui/Card";
import { Badge } from "../../../../components/ui/Badge";
import { CompanyAcquisitionPanel } from "../../../../components/companies/CompanyAcquisitionPanel";

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

export default async function CompanyDetailPage({ params }) {
  const { id } = await params;
  let detail;

  try {
    detail = await fetchCompanyDetail(id);
  } catch (error) {
    return notFound();
  }

  if (!detail) return notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">Company</div>
          <h1 className="text-2xl font-semibold text-neutral-900">{detail.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
            <span>{detail.sector || "Sector not set"}</span>
            {detail.website ? (
              <a href={detail.website} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                Visit website
              </a>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-neutral-500">Internal ID: {detail.id}</div>
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <Link
            href="/companies"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            Back to companies
          </Link>
          <CompanyAcquisitionPanel
            companyId={detail.id}
            lastSyncedAt={detail.source_last_seen_at}
            initialRawPayload={detail.source_payload}
            canRefresh={isAdmin}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader title="Contacts" />
          <CardBody>
            <div className="text-2xl font-semibold text-neutral-950">{formatCount(detail.contact_count)}</div>
            <div className="mt-1 text-sm text-neutral-600">Contacts linked to this company.</div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Projects" />
          <CardBody>
            <div className="text-2xl font-semibold text-neutral-950">{formatCount(detail.project_count)}</div>
            <div className="mt-1 text-sm text-neutral-600">Projects linked via contact associations.</div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Offices" />
          <CardBody>
            <div className="text-2xl font-semibold text-neutral-950">{formatCount(detail.offices?.length)}</div>
            <div className="mt-1 text-sm text-neutral-600">Stored office records for enrichment and routing.</div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="CRM status" />
          <CardBody className="space-y-2">
            <Badge tone={detail.crm_org_id ? "success" : "warning"}>
              {detail.crm_org_id ? "Linked" : "Not linked"}
            </Badge>
            <div className="text-sm text-neutral-600">
              {detail.crm_org_id ? `CRM org ID: ${detail.crm_org_id}` : "No CRM organization is linked yet."}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader title="Company details" />
          <CardBody className="space-y-4 text-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-500">Phone</div>
                <div className="mt-1 text-neutral-900">{detail.phone || "Not available"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-500">Employees</div>
                <div className="mt-1 text-neutral-900">
                  {detail.employee_count !== null && detail.employee_count !== undefined
                    ? detail.employee_count.toLocaleString()
                    : "Not available"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-500">External company ID</div>
                <div className="mt-1 text-neutral-900">{detail.external_company_id || "Not available"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-500">Source ref</div>
                <div className="mt-1 text-neutral-900">{detail.source_ref || "Not available"}</div>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-500">Headquarters</div>
              <div className="mt-1 text-neutral-900">{detail.headquarters_address || "Not available"}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-500">Description</div>
              <div className="mt-1 whitespace-pre-wrap text-neutral-700">
                {detail.description || "No company description has been acquired yet."}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Office records" />
          <CardBody className="space-y-3">
            {(detail.offices || []).length === 0 ? (
              <div className="text-sm text-neutral-500">No offices linked to this company yet.</div>
            ) : (
              detail.offices.map((office) => (
                <div key={office.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
                  <div className="font-medium text-neutral-900">{office.name || "Unnamed office"}</div>
                  <div className="mt-1 text-neutral-600">{office.address || office.region || "No address"}</div>
                  <div className="mt-2 grid gap-2 text-xs text-neutral-500 md:grid-cols-2">
                    <div>Office ID: {office.external_office_id || "Not stored"}</div>
                    <div>Source ref: {office.source_ref || "Not stored"}</div>
                    <div>Phone: {office.phone || "Not available"}</div>
                    <div>
                      Last seen:{" "}
                      {office.source_last_seen_at ? new Date(office.source_last_seen_at).toLocaleString() : "Never"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Company contacts" />
        <CardBody className="space-y-3">
          {(detail.contacts || []).length === 0 ? (
            <div className="text-sm text-neutral-500">No contacts linked to this company yet.</div>
          ) : (
            detail.contacts.map((contact) => (
              <div key={contact.id} className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium text-neutral-900">
                    {[contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "Unnamed contact"}
                  </div>
                  <div className="text-sm text-neutral-600">
                    {contact.job_title || "No role"} {contact.office_name ? `- ${contact.office_name}` : ""}
                  </div>
                  <div className="text-xs text-neutral-500">{contact.email || "No email"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={contact.crm_sync_status === "pushed" ? "success" : "warning"}>
                    {contact.crm_sync_status}
                  </Badge>
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
                  >
                    View contact
                  </Link>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
