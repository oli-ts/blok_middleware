import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchContactDetail } from "../../../../lib/queries";
import { Card, CardBody, CardHeader } from "../../../../components/ui/Card";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { SourcePayloadModal } from "../../../../components/contacts/SourcePayloadModal";

export default async function ContactDetail({ params }) {
  const { id: contactId } = await params;
  let detail;
  try {
    detail = await fetchContactDetail(contactId);
  } catch (error) {
    return notFound();
  }

  if (!detail) return notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">Contact</p>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {detail.first_name} {detail.last_name}
          </h1>
          <div className="text-sm text-neutral-600">
            {detail.job_title || "No role"} - {detail.email || "No email"}
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            Internal ID: {detail.contact_id}
          </div>
        </div>
        <div className="flex gap-2">
          <SourcePayloadModal payload={detail.source_payload} source={detail.source || "Source"} />
          <Button variant="secondary">Merge duplicate</Button>
          <Button>Push to Pipedrive</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader title="Source record" />
          <CardBody className="space-y-2 text-sm text-neutral-600">
            <div>
              <span className="font-medium text-neutral-900">Source:</span>{" "}
              {detail.source || "Manual"}
            </div>
            <div>
              <span className="font-medium text-neutral-900">Glenigan contact ID:</span>{" "}
              {detail.external_contact_id || "Not available"}
            </div>
            {detail.source_ref ? (
              <div>
                <span className="font-medium text-neutral-900">Source ref:</span>{" "}
                {detail.source_ref}
              </div>
            ) : null}
            <SourcePayloadModal payload={detail.source_payload} source={detail.source || "Source"} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Validation" />
          <CardBody>
            <Badge tone="info">{detail.validation_state}</Badge>
            <p className="text-sm text-neutral-600 mt-2">
              Track changes in contact_validation_events and audit_logs.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="CRM status" />
          <CardBody>
            <Badge tone={detail.crm_sync_status === "pushed" ? "success" : "warning"}>
              {detail.crm_sync_status}
            </Badge>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Activity / audit" />
          <CardBody className="text-sm text-neutral-600">
            Recent actions would appear here from audit_logs.
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Attached projects" />
        <CardBody className="space-y-3">
          {(detail.projects || []).map((proj) => (
            <div key={proj.project_id} className="rounded border border-neutral-200 p-3 flex justify-between">
              <div>
                <div className="font-medium text-neutral-900">{proj.title}</div>
                <div className="text-sm text-neutral-600">
                  Stage: {proj.stage || "--"} - Region: {proj.region || "--"}
                </div>
                <div className="flex gap-2 mt-1">
                  {(proj.relevance_tags || []).map((tag) => (
                    <Badge key={tag} tone="default">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={proj.status === "pushed" ? "success" : "info"}>{proj.status}</Badge>
                <Link
                  href={`/projects/${proj.project_id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 bg-transparent text-neutral-900 hover:bg-neutral-100 px-2.5 py-1.5 text-sm"
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
