import { notFound } from "next/navigation";
import { fetchDashboardProjects } from "../../../../lib/queries";
import { Card, CardBody, CardHeader } from "../../../../components/ui/Card";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";

export default async function ProjectDetail({ params }) {
  const { id: projectId } = await params;
  let projects = [];
  try {
    projects = await fetchDashboardProjects();
  } catch (error) {
    return notFound();
  }
  const project = projects.find((p) => p.id === projectId);
  if (!project) return notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">Project</p>
          <h1 className="text-2xl font-semibold text-neutral-900">{project.title}</h1>
          <div className="mt-1 flex gap-2 text-sm text-neutral-600">
            <span>{project.region}</span>
            <span>•</span>
            <span>Stage: {project.stage || "—"}</span>
            <span>•</span>
            <span>Value: {project.value_numeric ? `£${Number(project.value_numeric).toLocaleString()}` : "—"}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">Flag for review</Button>
          <Button>Push linked records</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader title="FM score" />
          <CardBody>
            <Badge tone={project.fm_score > 0.75 ? "success" : "info"}>{(project.fm_score ?? 0).toFixed(2)}</Badge>
            <p className="text-sm text-neutral-600 mt-2">Computed from vertical rules and value band.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Relevance tags" />
          <CardBody className="flex flex-wrap gap-2">
            {(project.relevance_tags || []).map((tag) => (
              <Badge key={tag} tone="default">
                {tag}
              </Badge>
            ))}
            {(project.relevance_tags || []).length === 0 ? <span className="text-sm text-neutral-500">None</span> : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Source" />
          <CardBody className="space-y-1 text-sm text-neutral-700">
            <div>Source ref: {project.source_ref || "—"}</div>
            <div>Status: {project.status}</div>
            <div>Ingested: {project.ingested_at || "—"}</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Stakeholders"
          action={<Button variant="secondary" size="sm">Extract contacts</Button>}
        />
        <CardBody>
          <div className="text-sm text-neutral-600">Attach extracted contacts and display confidence scores here.</div>
        </CardBody>
      </Card>
    </div>
  );
}
