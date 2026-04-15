import Link from "next/link";
import { fetchDashboardProjects } from "../../../lib/queries";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { SimpleTable } from "../../../components/ui/SimpleTable";
import { Badge } from "../../../components/ui/Badge";

export default async function ProjectsIndex() {
  let projects = [];
  try {
    projects = await fetchDashboardProjects();
  } catch (error) {
    projects = [];
  }

  const columns = [
    { header: "Project", accessor: "title" },
    { header: "Region", accessor: "region" },
    { header: "Stage", accessor: "stage" },
    {
      header: "FM Score",
      accessor: "fm_score",
      cell: (row) => <Badge tone={row.fm_score > 0.75 ? "success" : "info"}>{(row.fm_score ?? 0).toFixed(2)}</Badge>,
    },
    {
      header: "Status",
      accessor: "status",
      cell: (row) => <Badge tone="info">{row.status}</Badge>,
    },
    {
      header: "Actions",
      accessor: "actions",
      cell: (row) => (
        <Link
          href={`/projects/${row.id}`}
          className="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 bg-transparent text-neutral-900 hover:bg-neutral-100 px-2.5 py-1.5 text-sm"
        >
          View
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Projects</p>
        <h1 className="text-2xl font-semibold text-neutral-900">All projects</h1>
      </div>
      <Card>
        <CardHeader title="Stream" />
        <CardBody>
          <SimpleTable columns={columns} data={projects} />
        </CardBody>
      </Card>
    </div>
  );
}
