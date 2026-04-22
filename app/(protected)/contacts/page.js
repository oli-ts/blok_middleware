import { fetchContactMetrics, fetchContactQueuePage, fetchContactSources } from "../../../lib/queries";
import { ContactsWorkspace } from "../../../components/contacts/ContactsWorkspace";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBooleanFlag(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

export default async function ContactsPage({ searchParams }) {
  const params = await searchParams;
  const page = parsePositiveInteger(params?.page, 1);
  const requestedPageSize = parsePositiveInteger(params?.pageSize, 25);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize) ? requestedPageSize : 25;
  const search = String(params?.q || "").trim();
  const source = String(params?.source || "").trim();
  const hasPhone = parseBooleanFlag(params?.hasPhone);
  const hasLinkedin = parseBooleanFlag(params?.hasLinkedin);
  let contacts = [];
  let sources = [];
  let pagination = {
    page,
    pageSize,
    totalCount: 0,
    search,
    source,
    hasPhone,
    hasLinkedin,
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

    const [queuePage, contactMetrics, sourceOptions] = await Promise.all([
      fetchContactQueuePage({ page, pageSize, search, source, hasPhone, hasLinkedin }),
      fetchContactMetrics(),
      fetchContactSources(),
    ]);

    contacts = queuePage.contacts;
    sources = sourceOptions;
    pagination = {
      page: queuePage.page,
      pageSize: queuePage.pageSize,
      totalCount: queuePage.totalCount,
      search: queuePage.search,
      source: queuePage.source,
      hasPhone: queuePage.hasPhone,
      hasLinkedin: queuePage.hasLinkedin,
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
      sources={sources}
    />
  );
}
