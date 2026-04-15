import { createSupabaseServerClient } from "./supabase/server";

export async function fetchDashboardProjects(limit = 200) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vw_dashboard_projects")
    .select("*")
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchDashboardStats() {
  const supabase = await createSupabaseServerClient();
  const [projects, contacts] = await Promise.all([
    supabase.from("vw_dashboard_projects").select("id", { count: "exact", head: true }),
    supabase.from("vw_contact_review_queue").select("id", { count: "exact", head: true }),
  ]);

  const error = projects.error || contacts.error;
  if (error) throw error;

  return {
    projects: projects.count || 0,
    contacts: contacts.count || 0,
  };
}

export async function fetchContactQueue(limit = 5000) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vw_contact_review_queue")
    .select("*")
    .limit(limit);
  if (error) throw error;
  return data || [];
}

function cleanContactSearchTerm(search) {
  return String(search || "")
    .trim()
    .replace(/[%*,()]/g, " ")
    .replace(/\s+/g, " ");
}

function applyContactSearch(query, search) {
  const q = cleanContactSearchTerm(search);
  if (!q) return query;

  const pattern = `%${q}%`;
  return query.or(
    [
      `first_name.ilike.${pattern}`,
      `last_name.ilike.${pattern}`,
      `job_title.ilike.${pattern}`,
      `email.ilike.${pattern}`,
      `company.ilike.${pattern}`,
      `source.ilike.${pattern}`,
      `acquisition_job_title.ilike.${pattern}`,
      `acquisition_contact_type.ilike.${pattern}`,
      `linkedin_url.ilike.${pattern}`,
    ].join(",")
  );
}

export async function fetchContactQueuePage({ page = 1, pageSize = 25, search = "" } = {}) {
  const safePage = Math.max(1, Math.trunc(Number(page) || 1));
  const safePageSize = [25, 50, 100, 250].includes(Number(pageSize)) ? Number(pageSize) : 25;
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  const supabase = await createSupabaseServerClient();
  const query = applyContactSearch(
    supabase
      .from("vw_contact_review_queue")
      .select("*", { count: "exact" }),
    search
  )
    .order("last_name", { ascending: true, nullsFirst: false })
    .order("first_name", { ascending: true, nullsFirst: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    contacts: data || [],
    totalCount: count || 0,
    page: safePage,
    pageSize: safePageSize,
    search: cleanContactSearchTerm(search),
  };
}

export async function fetchContactMetrics() {
  const supabase = await createSupabaseServerClient();
  const [total, needsReview, pushed, primary, secondary] = await Promise.all([
    supabase.from("vw_contact_review_queue").select("id", { count: "exact", head: true }),
    supabase
      .from("vw_contact_review_queue")
      .select("id", { count: "exact", head: true })
      .neq("validation_state", "verified"),
    supabase
      .from("vw_contact_review_queue")
      .select("id", { count: "exact", head: true })
      .eq("crm_sync_status", "pushed"),
    supabase
      .from("vw_contact_review_queue")
      .select("id", { count: "exact", head: true })
      .eq("acquisition_contact_type", "primary"),
    supabase
      .from("vw_contact_review_queue")
      .select("id", { count: "exact", head: true })
      .eq("acquisition_contact_type", "secondary"),
  ]);

  const error = total.error || needsReview.error || pushed.error || primary.error || secondary.error;
  if (error) throw error;

  return {
    total: total.count || 0,
    needsReview: needsReview.count || 0,
    pushed: pushed.count || 0,
    primary: primary.count || 0,
    secondary: secondary.count || 0,
  };
}

export async function fetchContactDetail(id) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vw_contact_project_summary")
    .select("*")
    .eq("contact_id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchCompanySummary() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("vw_company_contact_summary").select("*");
  if (error) throw error;
  return data || [];
}
