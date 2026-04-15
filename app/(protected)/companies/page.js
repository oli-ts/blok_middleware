import { fetchCompanySummary } from "../../../lib/queries";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { SimpleTable } from "../../../components/ui/SimpleTable";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";

export default async function CompaniesPage() {
  let companies = [];
  try {
    companies = await fetchCompanySummary();
  } catch (error) {
    companies = [];
  }

  const columns = [
    { header: "Company", accessor: "name" },
    { header: "Sector", accessor: "sector" },
    { header: "Contacts", accessor: "contact_count" },
    { header: "Projects", accessor: "project_count" },
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
          <Button variant="ghost" size="sm">Review</Button>
          <Button variant="ghost" size="sm">Push</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Grouping</p>
        <h1 className="text-2xl font-semibold text-neutral-900">Companies & Offices</h1>
        <p className="text-sm text-neutral-600">Batch review contacts at company level.</p>
      </div>
      <Card>
        <CardHeader title="Company groups" />
        <CardBody>
          <SimpleTable columns={columns} data={companies} />
        </CardBody>
      </Card>
    </div>
  );
}
