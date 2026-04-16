import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchGleniganCompanyByOfficeId } from "@/lib/company-acquisition/gleniganCompanyClient";
import { mapGleniganCompanyResponse } from "@/lib/company-acquisition/gleniganCompanyMapper";

const DEFAULT_BATCH_SIZE = 1000;

function hasText(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function createStatusError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;

  const error = new Error("Import cancelled.");
  error.name = "AbortError";
  error.cancelled = true;
  throw error;
}

async function emitProgress(onProgress, event) {
  if (typeof onProgress === "function") {
    await onProgress(event);
  }
}

function getProgressStats(stats, extra = {}) {
  return {
    companies_total: stats.companies_total,
    companies_processed: stats.companies_processed,
    companies_updated: stats.companies_updated,
    companies_skipped: stats.companies_skipped,
    companies_failed: stats.companies_failed,
    missing_office_id: stats.missing_office_id,
    enriched_before_run: stats.enriched_before_run,
    ...extra,
  };
}

function extractOfficeIdFromObject(source) {
  if (!source || typeof source !== "object") return null;

  const directValue = ["OfficeId", "OfficeID", "Id", "ID"]
    .map((key) => source?.[key])
    .find((value) => value !== undefined && value !== null && String(value).trim() !== "");

  return directValue ? String(directValue).trim() : null;
}

function extractOfficeCandidatesFromContactPayload(payload) {
  if (!payload || typeof payload !== "object") return [];

  const officeGroups = [];
  if (Array.isArray(payload.CurrentOffices)) officeGroups.push(...payload.CurrentOffices);
  if (Array.isArray(payload.PastOffices)) officeGroups.push(...payload.PastOffices);

  return officeGroups.filter((item) => item && typeof item === "object");
}

async function fetchCompanyRecord(supabase, companyId) {
  const { data: company, error } = await supabase
    .from("companies")
    .select(
      [
        "id",
        "name",
        "sector",
        "website",
        "phone",
        "description",
        "employee_count",
        "headquarters_address",
        "external_company_id",
        "source_ref",
        "source_last_seen_at",
      ].join(", ")
    )
    .eq("id", companyId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw createStatusError(404, "Company not found.");
    }
    throw error;
  }

  return company;
}

async function resolveCompanyOfficeLookup(supabase, companyId) {
  const { data: offices, error: officesError } = await supabase
    .from("offices")
    .select("id, name, external_office_id, source_ref, source_payload, source_last_seen_at")
    .eq("company_id", companyId)
    .order("source_last_seen_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (officesError) throw officesError;

  for (const office of offices || []) {
    const officeId = office.external_office_id || office.source_ref || extractOfficeIdFromObject(office.source_payload);
    if (officeId) {
      return {
        officeId,
        officeRecord: office,
        officePayload: office.source_payload || null,
      };
    }
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("source_payload, source_last_seen_at")
    .eq("company_id", companyId)
    .eq("source_system", "glenigan")
    .not("source_payload", "is", null)
    .order("source_last_seen_at", { ascending: false, nullsFirst: false })
    .limit(25);

  if (contactsError) throw contactsError;

  for (const contact of contacts || []) {
    for (const office of extractOfficeCandidatesFromContactPayload(contact.source_payload)) {
      const officeId = extractOfficeIdFromObject(office);
      if (officeId) {
        return {
          officeId,
          officeRecord: (offices || []).find((item) => !hasText(item.external_office_id) && item.name === office.Name) || null,
          officePayload: office,
        };
      }
    }
  }

  return null;
}

function buildCompanyUpdatePayload(existingCompany, mappedCompany, officeId) {
  const now = new Date().toISOString();

  return {
    name: mappedCompany.company.name || existingCompany.name,
    sector: mappedCompany.company.sector || existingCompany.sector || null,
    website: mappedCompany.company.website || existingCompany.website || null,
    phone: mappedCompany.company.phone || existingCompany.phone || null,
    description: mappedCompany.company.description || existingCompany.description || null,
    employee_count: mappedCompany.company.employee_count ?? existingCompany.employee_count ?? null,
    headquarters_address: mappedCompany.company.headquarters_address || existingCompany.headquarters_address || null,
    external_company_id: mappedCompany.external_company_id || existingCompany.external_company_id || null,
    source_system: "glenigan",
    source_ref: mappedCompany.external_company_id || existingCompany.source_ref || officeId,
    source_payload: mappedCompany.source,
    source_last_seen_at: now,
    updated_at: now,
  };
}

async function acquireCompanyDataWithContext(supabase, company, officeLookup, { signal } = {}) {
  throwIfAborted(signal);

  if (!officeLookup?.officeId) {
    throw createStatusError(400, "No Glenigan officeId is stored for this company yet.");
  }

  const { data } = await fetchGleniganCompanyByOfficeId(officeLookup.officeId, { signal });
  throwIfAborted(signal);

  const mappedCompany = mapGleniganCompanyResponse(data);
  const updatePayload = buildCompanyUpdatePayload(company, mappedCompany, officeLookup.officeId);

  const { data: updatedCompany, error: updateError } = await supabase
    .from("companies")
    .update(updatePayload)
    .eq("id", company.id)
    .select(
      [
        "id",
        "name",
        "sector",
        "website",
        "phone",
        "description",
        "employee_count",
        "headquarters_address",
        "external_company_id",
        "source_last_seen_at",
      ].join(", ")
    )
    .single();

  if (updateError) throw updateError;

  if (
    officeLookup.officeRecord?.id &&
    (!hasText(officeLookup.officeRecord.external_office_id) || !officeLookup.officeRecord.source_payload)
  ) {
    const now = new Date().toISOString();
    const officeUpdate = {
      external_office_id: officeLookup.officeId,
      source_system: "glenigan",
      source_ref: officeLookup.officeId,
      source_last_seen_at: now,
      updated_at: now,
    };

    if (!officeLookup.officeRecord.source_payload && officeLookup.officePayload) {
      officeUpdate.source_payload = officeLookup.officePayload;
    }

    const { error: officeUpdateError } = await supabase
      .from("offices")
      .update(officeUpdate)
      .eq("id", officeLookup.officeRecord.id);

    if (officeUpdateError) throw officeUpdateError;
  }

  return {
    company: updatedCompany,
    officeId: officeLookup.officeId,
    rawResponse: data,
  };
}

async function listCompaniesForAcquisition(supabase) {
  const companies = [];
  let from = 0;

  while (true) {
    const to = from + DEFAULT_BATCH_SIZE - 1;
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, sector, source_last_seen_at")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .range(from, to);

    if (error) throw error;

    const rows = data || [];
    companies.push(...rows);

    if (rows.length < DEFAULT_BATCH_SIZE) break;
    from += DEFAULT_BATCH_SIZE;
  }

  return companies;
}

async function inspectCompanyCandidate(supabase, company) {
  const officeLookup = await resolveCompanyOfficeLookup(supabase, company.id);
  return {
    ...company,
    officeLookup,
    can_acquire: Boolean(officeLookup?.officeId),
  };
}

export async function acquireCompanyData(companyId, { signal } = {}) {
  const supabase = createSupabaseAdminClient();
  const company = await fetchCompanyRecord(supabase, companyId);
  const officeLookup = await resolveCompanyOfficeLookup(supabase, companyId);
  return acquireCompanyDataWithContext(supabase, company, officeLookup, { signal });
}

export async function previewCompanyAcquisition({ sampleSize = 8, signal } = {}) {
  const supabase = createSupabaseAdminClient();
  const companies = await listCompaniesForAcquisition(supabase);
  const preview = [];
  let readyCompanies = 0;
  let missingOfficeId = 0;
  let enrichedCompanies = 0;

  for (const company of companies) {
    throwIfAborted(signal);
    const candidate = await inspectCompanyCandidate(supabase, company);

    if (company.source_last_seen_at) enrichedCompanies += 1;
    if (candidate.can_acquire) readyCompanies += 1;
    else missingOfficeId += 1;

    if (preview.length < sampleSize) {
      preview.push({
        id: company.id,
        name: company.name,
        sector: company.sector,
        source_last_seen_at: company.source_last_seen_at,
        office_id: candidate.officeLookup?.officeId || null,
        can_acquire: candidate.can_acquire,
      });
    }
  }

  return {
    companies_total: companies.length,
    ready_companies: readyCompanies,
    missing_office_id: missingOfficeId,
    enriched_companies: enrichedCompanies,
    preview,
  };
}

export async function runCompanyAcquisitionImport({ onProgress, signal } = {}) {
  const supabase = createSupabaseAdminClient();
  const companies = await listCompaniesForAcquisition(supabase);
  const stats = {
    companies_total: companies.length,
    companies_processed: 0,
    companies_updated: 0,
    companies_skipped: 0,
    companies_failed: 0,
    missing_office_id: 0,
    enriched_before_run: companies.filter((company) => company.source_last_seen_at).length,
    failures: [],
  };

  await emitProgress(onProgress, {
    type: "started",
    stats: getProgressStats(stats),
  });

  for (const companySummary of companies) {
    throwIfAborted(signal);

    await emitProgress(onProgress, {
      type: "company_started",
      stats: getProgressStats(stats, {
        current_company: companySummary.name,
      }),
    });

    const company = await fetchCompanyRecord(supabase, companySummary.id);
    const officeLookup = await resolveCompanyOfficeLookup(supabase, companySummary.id);

    if (!officeLookup?.officeId) {
      stats.companies_processed += 1;
      stats.companies_skipped += 1;
      stats.missing_office_id += 1;

      await emitProgress(onProgress, {
        type: "company_skipped",
        stats: getProgressStats(stats, {
          current_company: company.name,
        }),
      });
      continue;
    }

    try {
      await acquireCompanyDataWithContext(supabase, company, officeLookup, { signal });
      stats.companies_processed += 1;
      stats.companies_updated += 1;

      await emitProgress(onProgress, {
        type: "company_completed",
        stats: getProgressStats(stats, {
          current_company: company.name,
        }),
      });
    } catch (error) {
      if (error.name === "AbortError" || error.cancelled === true) {
        throw error;
      }

      stats.companies_processed += 1;
      stats.companies_failed += 1;
      stats.failures.push({
        id: company.id,
        name: company.name,
        error: error.message,
      });

      await emitProgress(onProgress, {
        type: "company_failed",
        error: error.message,
        stats: getProgressStats(stats, {
          current_company: company.name,
        }),
      });
    }
  }

  await emitProgress(onProgress, {
    type: "completed",
    stats: getProgressStats(stats),
  });

  return stats;
}
