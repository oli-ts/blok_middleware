import { fetchContactMetrics, fetchContactQueuePage } from "../../../lib/queries";
import { ContactsWorkspace } from "../../../components/contacts/ContactsWorkspace";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function ContactsPage({ searchParams }) {
  const params = await searchParams;
  const page = parsePositiveInteger(params?.page, 1);
  const requestedPageSize = parsePositiveInteger(params?.pageSize, 25);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize) ? requestedPageSize : 25;
  const search = String(params?.q || "").trim();
  let contacts = [];
  let pagination = {
    page,
    pageSize,
    totalCount: 0,
    search,
  };
  let metrics = {
    total: 0,
    needsReview: 0,
    pushed: 0,
    primary: 0,
    secondary: 0,
  };
  let isAdmin = false;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };

    const [queuePage, contactMetrics] = await Promise.all([
      fetchContactQueuePage({ page, pageSize, search }),
      fetchContactMetrics(),
    ]);

    contacts = queuePage.contacts;
    pagination = {
      page: queuePage.page,
      pageSize: queuePage.pageSize,
      totalCount: queuePage.totalCount,
      search: queuePage.search,
    };
    metrics = contactMetrics;
    isAdmin = profile?.role === "admin";
  } catch (error) {
    contacts = [];
  }

  return (
    <ContactsWorkspace
      contacts={contacts}
      isAdmin={isAdmin}
      pagination={pagination}
      metrics={metrics}
    />
  );
}
