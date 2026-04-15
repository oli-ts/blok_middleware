import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckSquare,
  Contact,
  MapPin,
  MoreHorizontal,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { fetchDashboardProjects, fetchDashboardStats } from "../../../lib/queries";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";

function formatCurrency(value) {
  if (!value) return "--";
  return `GBP ${Number(value).toLocaleString()}`;
}

function getPotential(project) {
  const score = Math.round((project.fm_score ?? 0) * 100);
  if (score >= 90) return { level: "High", tone: "high", score };
  if (score >= 60) return { level: "Medium", tone: "medium", score };
  return { level: "Low", tone: "low", score };
}

function getStageTone(stage) {
  const normalized = String(stage || "").toLowerCase();
  if (normalized.includes("construction")) return "warning";
  if (normalized.includes("completion")) return "success";
  return "info";
}

function getTagTone(tag) {
  const normalized = String(tag || "").toLowerCase();
  if (normalized.includes("review")) return "danger";
  if (normalized.includes("priority")) return "indigo";
  if (normalized.includes("fm")) return "purple";
  return "default";
}

function MetricCard({ label, value, change, icon: Icon, tone = "blue" }) {
  const toneMap = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    yellow: "bg-yellow-100 text-yellow-600",
    red: "bg-red-100 text-red-600",
  };

  return (
    <Card>
      <CardBody className="relative p-5">
        <div className={`absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full ${toneMap[tone]}`}>
          <Icon size={20} />
        </div>
        <div className="pr-12">
          <p className="text-sm text-gray-600">{label}</p>
          <div className="mt-2 text-3xl font-bold text-gray-900">{value}</div>
          <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
            <ArrowUpRight size={14} />
            <span>{change}</span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export default async function DashboardPage() {
  let projects = [];
  let stats = { projects: 0, contacts: 0 };
  const now = new Date();

  try {
    [projects, stats] = await Promise.all([
      fetchDashboardProjects(),
      fetchDashboardStats(),
    ]);
  } catch (error) {
    projects = [];
  }

  const highPotentialCount = projects.filter((project) => (project.fm_score ?? 0) > 0.75).length;
  const formattedDateTime = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(now);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-gray-500">Dashboard</p>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">{formattedDateTime}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <MetricCard label="Total Projects" value={stats.projects.toLocaleString()} change="+12% from last month" icon={BriefcaseBusiness} />
        <MetricCard label="High FM Potential" value={highPotentialCount.toLocaleString()} change="+8%" icon={TrendingUp} tone="green" />
        <MetricCard label="Contacts Extracted" value={stats.contacts.toLocaleString()} change="+15%" icon={Contact} tone="yellow" />
        <MetricCard label="Pushed to CRM" value="0" change="+22%" icon={Send} tone="blue" />
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <label className="relative w-full xl:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                placeholder="Search by project name, location..."
                className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
            <select className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700">
              <option>Region</option>
            </select>
            <select className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700">
              <option>Project Stage</option>
              <option>Planning</option>
              <option>Construction</option>
              <option>Completion</option>
            </select>
            <select className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700">
              <option>Value Range</option>
              <option>GBP 0 - GBP 10M+</option>
            </select>
            <select className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700">
              <option>Vertical</option>
              <option>FM</option>
              <option>M&E</option>
              <option>Asbestos</option>
              <option>Refurbishment</option>
              <option>Maintenance</option>
            </select>
            <Button variant="ghost" className="xl:ml-auto">
              Clear Filters
            </Button>
            <Button>
              <SlidersHorizontal size={16} /> Apply Filters
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Opportunity Feed"
          action={
            <div className="hidden flex-wrap items-center gap-2 md:flex">
              <div className="rounded-lg border border-gray-300 bg-white p-1 text-sm">
                <span className="rounded-md bg-blue-600 px-3 py-1.5 text-white">Table</span>
                <span className="px-3 py-1.5 text-gray-500">Card</span>
              </div>
              <Button variant="secondary" size="sm">
                <CheckSquare size={16} /> Select All
              </Button>
              <Button variant="secondary" size="sm">Extract Contacts</Button>
              <Button size="sm">Send to CRM</Button>
              <select className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700">
                <option>Sort by: Relevance</option>
                <option>Sort by: Date</option>
                <option>Sort by: Value</option>
              </select>
            </div>
          }
        />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["", "Project Name", "Location", "Value", "Stage", "FM Potential", "Contacts", "Tags", "Actions"].map((header) => (
                    <th key={header || "select"} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-600">
                      {header || <input type="checkbox" aria-label="Select all projects" className="h-4 w-4" />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white text-sm">
                {projects.map((project) => {
                  const potential = getPotential(project);
                  const tags = project.relevance_tags?.length ? project.relevance_tags : project.fm_score > 0.75 ? ["High FM Potential"] : [];

                  return (
                    <tr key={project.id} className="cursor-pointer transition-colors hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <input type="checkbox" aria-label={`Select ${project.title}`} className="h-4 w-4" />
                      </td>
                      <td className="px-4 py-4">
                        <Link href={`/projects/${project.id}`} className="font-medium text-blue-600 hover:text-blue-700">
                          {project.title}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={14} /> {project.region || "Unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-gray-900">{formatCurrency(project.value_numeric)}</td>
                      <td className="px-4 py-4">
                        <Badge tone={getStageTone(project.stage)}>{project.stage || "Planning"}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={potential.tone}>{potential.level} {potential.score}%</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone="default">0 contacts</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} tone={getTagTone(tag)}>
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Project actions">
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                          <Sparkles size={22} />
                        </div>
                        <div className="mt-3 font-medium text-gray-900">No projects found</div>
                        <div className="mt-1 text-sm text-gray-500">Adjust filters or import new Glenigan project data.</div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
            <div>Showing {projects.length} projects</div>
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <select className="rounded-lg border border-gray-300 bg-white px-2 py-1.5">
                <option>10</option>
                <option>25</option>
                <option>50</option>
                <option>100</option>
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="High Value contacts" />
        <CardBody>
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-sm text-gray-500">
            High Value contact logic is not defined yet. This stream is intentionally blank until the scoring rules are agreed.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
