import { fetchCompanyMetrics, fetchCompanySummaryPage } from "../../../lib/queries";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { CompaniesWorkspace } from "../../../components/companies/CompaniesWorkspace";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function CompaniesPage({ searchParams }) {
  const params = await searchParams;
  const page = parsePositiveInteger(params?.page, 1);
  const requestedPageSize = parsePositiveInteger(params?.pageSize, 25);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize) ? requestedPageSize : 25;
  let companies = [];
  let isAdmin = false;
  let pagination = {
    page,
    pageSize,
    totalCount: 0,
  };
  let metrics = {
    total: 0,
    enriched: 0,
    basic: 0,
    linked: 0,
  };

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };

    const [companyPage, companyMetrics] = await Promise.all([
      fetchCompanySummaryPage({ page, pageSize }),
      fetchCompanyMetrics(),
    ]);

    companies = companyPage.companies;
    pagination = {
      page: companyPage.page,
      pageSize: companyPage.pageSize,
      totalCount: companyPage.totalCount,
    };
    metrics = companyMetrics;
    isAdmin = profile?.role === "admin";
  } catch (error) {
    companies = [];
    isAdmin = false;
  }

  return <CompaniesWorkspace companies={companies} isAdmin={isAdmin} pagination={pagination} metrics={metrics} />;
}
