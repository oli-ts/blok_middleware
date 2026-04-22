import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createPipedriveLead,
  createPipedriveOrganization,
  createPipedrivePerson,
  getPipedriveConfig,
  searchPipedriveLeads,
  searchPipedriveOrganizations,
  searchPipedrivePersons,
  toPipedriveId,
  updatePipedrivePerson,
} from "@/lib/crm/pipedrive";

export const dynamic = "force-dynamic";

const DEFAULT_LEAD_CURRENCY = process.env.PIPEDRIVE_LEAD_CURRENCY || "GBP";

function hasText(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function cleanString(value) {
  return hasText(value) ? String(value).trim() : "";
}

function getPipedriveLeadId(value) {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function normalizeContactIds(input) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )
  );
}

function buildMap(rows, key) {
  return new Map((rows || []).map((row) => [row[key], row]));
}

function getContactName(contact) {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
  return fullName || contact.email || "Unnamed contact";
}

function getPhoneNumbers(contact) {
  const fromJson = Array.isArray(contact?.phone_numbers)
    ? contact.phone_numbers
    : Array.isArray(contact?.phone_numbers?.value)
      ? contact.phone_numbers.value
      : [];

  return Array.from(
    new Set(
      [...fromJson, contact?.phone]
        .map((value) => cleanString(value))
        .filter(Boolean)
    )
  );
}

function getPersonPayload(contact) {
  const name = getContactName(contact);
  const emails = hasText(contact.email)
    ? [{ value: cleanString(contact.email), primary: true, label: "work" }]
    : undefined;
  const phones = getPhoneNumbers(contact).length
    ? getPhoneNumbers(contact).map((phone, index) => ({
        value: phone,
        primary: index === 0,
        label: index === 0 ? "work" : "other",
      }))
    : undefined;

  return {
    name,
    emails,
    phones,
  };
}

function getOrganizationPayload(company, office) {
  const addressValue =
    cleanString(company?.headquarters_address) ||
    cleanString(office?.address) ||
    cleanString(office?.region);

  return {
    name: cleanString(company?.name),
    address: addressValue ? { value: addressValue } : undefined,
  };
}

function getPrimaryProject(projects) {
  return [...(projects || [])].sort((left, right) => {
    const leftValue = Number(left?.value_numeric || 0);
    const rightValue = Number(right?.value_numeric || 0);
    if (leftValue !== rightValue) return rightValue - leftValue;
    return String(left?.title || "").localeCompare(String(right?.title || ""));
  })[0] || null;
}

function buildLeadTitle(contact, company, project) {
  if (hasText(project?.title) && hasText(company?.name)) {
    return `${cleanString(project.title)} - ${cleanString(company.name)}`;
  }

  if (hasText(project?.title)) return cleanString(project.title);
  if (hasText(company?.name)) return `${cleanString(company.name)} - ${getContactName(contact)}`;
  return getContactName(contact);
}

function buildLeadPayload({ title, personId, organizationId, project }) {
  const payload = {
    title,
    person_id: personId || undefined,
    organization_id: organizationId || undefined,
  };

  const numericValue = Number(project?.value_numeric);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    payload.value = {
      amount: numericValue,
      currency: DEFAULT_LEAD_CURRENCY,
    };
  }

  return payload;
}

function summarizePayload(contact) {
  return {
    action: "pipedrive_person_org_lead_sync",
    contact_name: getContactName(contact),
    company_name: cleanString(contact.company?.name),
    project_titles: (contact.projects || []).map((project) => project.title).filter(Boolean),
  };
}

async function loadContactPushContext(supabase, contactIds) {
  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, job_title, email, phone, phone_numbers, linkedin_url, source, company_id, office_id, crm_sync_status")
    .in("id", contactIds)
    .is("deleted_at", null);

  if (contactsError) throw contactsError;
  if (!contacts?.length) return [];

  const companyIds = Array.from(new Set(contacts.map((contact) => contact.company_id).filter(Boolean)));
  const officeIds = Array.from(new Set(contacts.map((contact) => contact.office_id).filter(Boolean)));

  const [
    companiesResult,
    officesResult,
    projectLinksResult,
    personLinksResult,
    orgLinksResult,
  ] = await Promise.all([
    companyIds.length
      ? supabase
          .from("companies")
          .select("id, name, sector, website, phone, headquarters_address, crm_org_id")
          .in("id", companyIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
    officeIds.length
      ? supabase.from("offices").select("id, name, address, region, phone").in("id", officeIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("project_contacts").select("contact_id, project_id, role, confidence_score").in("contact_id", contactIds),
    supabase
      .from("crm_record_links")
      .select("source_id, crm_id")
      .eq("source_entity", "contact")
      .eq("crm_type", "person")
      .in("source_id", contactIds),
    companyIds.length
      ? supabase
          .from("crm_record_links")
          .select("source_id, crm_id")
          .eq("source_entity", "company")
          .eq("crm_type", "org")
          .in("source_id", companyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const companiesError = companiesResult.error || officesResult.error || projectLinksResult.error || personLinksResult.error || orgLinksResult.error;
  if (companiesError) throw companiesError;

  const projectIds = Array.from(new Set((projectLinksResult.data || []).map((link) => link.project_id).filter(Boolean)));
  const { data: projects, error: projectsError } = projectIds.length
    ? await supabase
        .from("projects")
        .select("id, title, value_numeric, stage, region, start_date, status")
        .in("id", projectIds)
        .is("deleted_at", null)
    : { data: [], error: null };

  if (projectsError) throw projectsError;

  const companiesById = buildMap(companiesResult.data, "id");
  const officesById = buildMap(officesResult.data, "id");
  const projectsById = buildMap(projects, "id");
  const personLinksByContact = new Map((personLinksResult.data || []).map((row) => [row.source_id, row.crm_id]));
  const orgLinksByCompany = new Map((orgLinksResult.data || []).map((row) => [row.source_id, row.crm_id]));
  const projectLinksByContact = new Map();

  for (const link of projectLinksResult.data || []) {
    const current = projectLinksByContact.get(link.contact_id) || [];
    const project = projectsById.get(link.project_id);
    if (project) {
      current.push({
        ...project,
        role: link.role,
        confidence_score: link.confidence_score,
      });
      projectLinksByContact.set(link.contact_id, current);
    }
  }

  return contacts.map((contact) => {
    const company = contact.company_id ? companiesById.get(contact.company_id) || null : null;
    return {
      ...contact,
      company,
      office: contact.office_id ? officesById.get(contact.office_id) || null : null,
      projects: projectLinksByContact.get(contact.id) || [],
      localPersonId: personLinksByContact.get(contact.id) || null,
      localOrganizationId: company
        ? orgLinksByCompany.get(company.id) || company.crm_org_id || null
        : null,
    };
  });
}

function pickFirstSearchMatch(items, normalizeId = toPipedriveId) {
  for (const item of items || []) {
    const id = normalizeId(item?.id);
    if (id) return { id, item };
  }
  return null;
}

async function resolvePerson(contact, config) {
  const localId = toPipedriveId(contact.localPersonId);
  if (localId) {
    return { id: localId, created: false, source: "local_link" };
  }

  const searchAttempts = [
    hasText(contact.email) ? { term: contact.email, fields: "email" } : null,
    getPhoneNumbers(contact).length ? { term: getPhoneNumbers(contact)[0], fields: "phone" } : null,
    hasText(getContactName(contact)) ? { term: getContactName(contact), fields: "name" } : null,
  ].filter(Boolean);

  for (const attempt of searchAttempts) {
    const match = pickFirstSearchMatch(await searchPipedrivePersons({ ...attempt, exactMatch: true }, { config }));
    if (match) {
      return { id: match.id, created: false, source: "search" };
    }
  }

  const created = await createPipedrivePerson(getPersonPayload(contact), { config });
  const createdId = toPipedriveId(created?.id);
  if (!createdId) {
    throw new Error("Pipedrive person creation did not return an ID.");
  }

  return { id: createdId, created: true, source: "create" };
}

async function resolveOrganization(contact, config) {
  const localId = toPipedriveId(contact.localOrganizationId);
  if (localId) {
    return { id: localId, created: false, source: "local_link" };
  }

  if (!hasText(contact.company?.name)) {
    return { id: null, created: false, source: "missing_company" };
  }

  const match = pickFirstSearchMatch(
    await searchPipedriveOrganizations(
      {
        term: contact.company.name,
        fields: "name",
        exactMatch: true,
      },
      { config }
    )
  );

  if (match) {
    return { id: match.id, created: false, source: "search" };
  }

  const created = await createPipedriveOrganization(getOrganizationPayload(contact.company, contact.office), { config });
  const createdId = toPipedriveId(created?.id);
  if (!createdId) {
    throw new Error("Pipedrive organization creation did not return an ID.");
  }

  return { id: createdId, created: true, source: "create" };
}

async function resolveLead(contact, personId, organizationId, config) {
  const primaryProject = getPrimaryProject(contact.projects);
  const title = buildLeadTitle(contact, contact.company, primaryProject);
  const match = pickFirstSearchMatch(
    await searchPipedriveLeads(
      {
        term: title,
        exactMatch: true,
        personId,
        organizationId,
      },
      { config }
    ),
    getPipedriveLeadId
  );

  if (match) {
    return {
      id: match.id,
      title,
      created: false,
      projectId: primaryProject?.id || null,
    };
  }

  const created = await createPipedriveLead(
    buildLeadPayload({
      title,
      personId,
      organizationId,
      project: primaryProject,
    }),
    { config }
  );
  const createdId = getPipedriveLeadId(created?.id);
  if (!createdId) {
    throw new Error("Pipedrive lead creation did not return an ID.");
  }

  return {
    id: createdId,
    title,
    created: true,
    projectId: primaryProject?.id || null,
  };
}

async function upsertCrmRecordLink(supabase, { sourceEntity, sourceId, crmType, crmId }) {
  const { error } = await supabase.from("crm_record_links").upsert(
    {
      source_entity: sourceEntity,
      source_id: sourceId,
      crm_type: crmType,
      crm_id: String(crmId),
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "source_entity,source_id,crm_type" }
  );

  if (error) throw error;
}

async function syncContactToPipedrive(supabase, contact, config) {
  const person = await resolvePerson(contact, config);
  const organization = await resolveOrganization(contact, config);

  if (person.id && organization.id) {
    await updatePipedrivePerson(person.id, { org_id: organization.id }, { config });
  }

  const lead = await resolveLead(contact, person.id, organization.id, config);

  await upsertCrmRecordLink(supabase, {
    sourceEntity: "contact",
    sourceId: contact.id,
    crmType: "person",
    crmId: person.id,
  });

  if (organization.id && contact.company?.id) {
    await upsertCrmRecordLink(supabase, {
      sourceEntity: "company",
      sourceId: contact.company.id,
      crmType: "org",
      crmId: organization.id,
    });

    const { error: companyUpdateError } = await supabase
      .from("companies")
      .update({
        crm_org_id: String(organization.id),
        updated_at: new Date().toISOString(),
      })
      .eq("id", contact.company.id);

    if (companyUpdateError) throw companyUpdateError;
  }

  const { error: contactUpdateError } = await supabase
    .from("contacts")
    .update({
      crm_sync_status: "pushed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", contact.id);

  if (contactUpdateError) throw contactUpdateError;

  return {
    person_id: person.id,
    organization_id: organization.id,
    lead_id: lead.id,
    lead_title: lead.title,
    lead_created: lead.created,
    person_created: person.created,
    organization_created: organization.created,
    project_id: lead.projectId,
  };
}

export async function POST(request) {
  const admin = await requireAdminRequest();
  if (admin.error) return admin.error;

  const body = await request.json().catch(() => ({}));
  const contactIds = normalizeContactIds(body.contactIds);

  if (contactIds.length === 0) {
    return NextResponse.json({ error: "At least one contact must be selected." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const contacts = await loadContactPushContext(supabase, contactIds);

  if (!contacts.length) {
    return NextResponse.json({ error: "No matching contacts found." }, { status: 404 });
  }

  let config;
  try {
    config = await getPipedriveConfig(supabase);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to load Pipedrive credentials." }, { status: error.status || 500 });
  }

  const { data: job, error: jobError } = await supabase
    .from("crm_push_jobs")
    .insert({
      created_by: admin.user.id,
      status: "running",
      target: "pipedrive",
      summary: `Syncing ${contacts.length} contact${contacts.length === 1 ? "" : "s"} to Pipedrive.`,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  const { data: items, error: itemsError } = await supabase
    .from("crm_push_job_items")
    .insert(
      contacts.map((contact) => ({
        job_id: job.id,
        source_entity: "contact",
        source_id: contact.id,
        target_type: "person",
        status: "queued",
        payload: summarizePayload(contact),
      }))
    )
    .select("id, source_id");

  if (itemsError) {
    await supabase
      .from("crm_push_jobs")
      .update({ status: "failed", completed_at: new Date().toISOString(), summary: "Failed to initialize CRM push job." })
      .eq("id", job.id);

    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const itemIdByContact = new Map((items || []).map((item) => [item.source_id, item.id]));
  const failures = [];
  let pushedCount = 0;

  for (const contact of contacts) {
    const itemId = itemIdByContact.get(contact.id);

    if (itemId) {
      await supabase
        .from("crm_push_job_items")
        .update({ status: "running", updated_at: new Date().toISOString() })
        .eq("id", itemId);
    }

    try {
      const result = await syncContactToPipedrive(supabase, contact, config);
      pushedCount += 1;

      if (itemId) {
        await supabase
          .from("crm_push_job_items")
          .update({
            status: "pushed",
            result,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemId);
      }
    } catch (error) {
      failures.push({
        contact_id: contact.id,
        contact_name: getContactName(contact),
        error: error.message || "Unknown error",
      });

      await supabase
        .from("contacts")
        .update({
          crm_sync_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", contact.id);

      if (itemId) {
        await supabase
          .from("crm_push_job_items")
          .update({
            status: "failed",
            error_message: error.message || "Unknown error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemId);
      }
    }
  }

  const failedCount = failures.length;
  const summary =
    failedCount > 0
      ? `Synced ${pushedCount} contact${pushedCount === 1 ? "" : "s"} to Pipedrive, ${failedCount} failed.`
      : `Synced ${pushedCount} contact${pushedCount === 1 ? "" : "s"} to Pipedrive.`;

  await supabase
    .from("crm_push_jobs")
    .update({
      status: failedCount > 0 ? "completed_with_errors" : "success",
      completed_at: new Date().toISOString(),
      summary,
    })
    .eq("id", job.id);

  await supabase.from("audit_logs").insert({
    actor_id: admin.user.id,
    action: "contacts_pushed_to_pipedrive",
    entity_type: "crm_push_job",
    entity_id: job.id,
    details: {
      contact_ids: contacts.map((contact) => contact.id),
      pushed: pushedCount,
      failed: failedCount,
      failures,
    },
  });

  return NextResponse.json({
    ok: true,
    result: {
      jobId: job.id,
      pushed: pushedCount,
      failed: failedCount,
      failures,
      summary,
    },
  });
}
