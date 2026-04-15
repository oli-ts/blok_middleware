import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGleniganContactResults, mapGleniganContact, summarizeMappedContact } from "@/lib/contact-acquisition/gleniganMapper";
import { searchGleniganContactsByJobTitle } from "@/lib/contact-acquisition/gleniganClient";

const GLENIGAN_PAGE_SIZE = 50;
const MAX_IMPORT_PAGES = 200;

function throwIfAborted(signal) {
  if (!signal?.aborted) return;

  const error = new Error("Import cancelled.");
  error.name = "AbortError";
  error.cancelled = true;
  throw error;
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function officeKey({ companyId, name, address }) {
  return [companyId, name || "", address || ""].join("::");
}

function contactKey(contact) {
  return [contact.source_system, contact.source_ref].join("::");
}

async function findOrCreateCompanies(supabase, mappedContacts) {
  const companyPayloads = new Map();

  for (const mapped of mappedContacts) {
    const name = mapped.company?.name;
    if (!name || companyPayloads.has(name)) continue;

    companyPayloads.set(name, {
      name,
      sector: mapped.company.sector,
      website: mapped.company.website,
    });
  }

  const names = Array.from(companyPayloads.keys());
  const companiesByName = new Map();
  if (names.length === 0) return companiesByName;

  const { data: existing, error: existingError } = await supabase
    .from("companies")
    .select("id, name")
    .in("name", names)
    .is("deleted_at", null);

  if (existingError) throw existingError;
  for (const company of existing || []) {
    companiesByName.set(company.name, company.id);
  }

  const missing = names
    .filter((name) => !companiesByName.has(name))
    .map((name) => companyPayloads.get(name));

  if (missing.length === 0) return companiesByName;

  const { data: created, error: createError } = await supabase
    .from("companies")
    .insert(missing)
    .select("id, name");

  if (createError) throw createError;
  for (const company of created || []) {
    companiesByName.set(company.name, company.id);
  }

  return companiesByName;
}

async function findOrCreateOffices(supabase, mappedContacts, companiesByName) {
  const desiredOffices = new Map();

  for (const mapped of mappedContacts) {
    const companyId = companiesByName.get(mapped.company?.name);
    const name = mapped.office?.name || null;
    const address = mapped.office?.address || null;
    if (!companyId || (!name && !address)) continue;

    const key = officeKey({ companyId, name, address });
    if (!desiredOffices.has(key)) {
      desiredOffices.set(key, {
        company_id: companyId,
        name,
        address,
        region: mapped.office.region,
        phone: mapped.office.phone,
      });
    }
  }

  const officesByKey = new Map();
  if (desiredOffices.size === 0) return officesByKey;

  const companyIds = uniqueValues(Array.from(desiredOffices.values()).map((office) => office.company_id));
  const { data: existing, error: existingError } = await supabase
    .from("offices")
    .select("id, company_id, name, address")
    .in("company_id", companyIds);

  if (existingError) throw existingError;
  for (const office of existing || []) {
    const key = officeKey({
      companyId: office.company_id,
      name: office.name,
      address: office.address,
    });
    if (desiredOffices.has(key)) {
      officesByKey.set(key, office.id);
    }
  }

  const missing = Array.from(desiredOffices.entries())
    .filter(([key]) => !officesByKey.has(key))
    .map(([, office]) => office);

  if (missing.length === 0) return officesByKey;

  const { data: created, error: createError } = await supabase
    .from("offices")
    .insert(missing)
    .select("id, company_id, name, address");

  if (createError) throw createError;
  for (const office of created || []) {
    officesByKey.set(
      officeKey({
        companyId: office.company_id,
        name: office.name,
        address: office.address,
      }),
      office.id
    );
  }

  return officesByKey;
}

async function importMappedContactsBatch(supabase, mappedContacts, stats, { runId, rule, page, total, seenForRule, onProgress, signal } = {}) {
  throwIfAborted(signal);

  if (mappedContacts.length === 0) return;

  const companiesByName = await findOrCreateCompanies(supabase, mappedContacts);
  throwIfAborted(signal);

  const officesByKey = await findOrCreateOffices(supabase, mappedContacts, companiesByName);
  throwIfAborted(signal);

  let skipped = 0;
  const contactsByKey = new Map();
  const now = new Date().toISOString();

  for (const mapped of mappedContacts) {
    const companyId = companiesByName.get(mapped.company?.name) || null;
    const officeId = officesByKey.get(
      officeKey({
        companyId,
        name: mapped.office?.name || null,
        address: mapped.office?.address || null,
      })
    ) || null;

    const contact = {
      ...mapped.contact,
      company_id: companyId,
      office_id: officeId,
      updated_at: now,
    };

    if (!contact.source_system || !contact.source_ref) {
      skipped += 1;
      continue;
    }

    contactsByKey.set(contactKey(contact), contact);
  }

  skipped += mappedContacts.length - skipped - contactsByKey.size;
  const contacts = Array.from(contactsByKey.values());

  if (contacts.length === 0) {
    stats.contacts_skipped += skipped;
    return;
  }

  const sourceRefs = contacts.map((contact) => contact.source_ref);
  const { data: existingContacts, error: existingError } = await supabase
    .from("contacts")
    .select("source_ref")
    .eq("source_system", "glenigan")
    .in("source_ref", sourceRefs);

  if (existingError) throw existingError;

  const existingRefs = new Set((existingContacts || []).map((contact) => contact.source_ref));
  const updated = contacts.filter((contact) => existingRefs.has(contact.source_ref)).length;
  const created = contacts.length - updated;

  const { error: upsertError } = await supabase
    .from("contacts")
    .upsert(contacts, { onConflict: "source_system,source_ref" });

  if (upsertError) throw upsertError;

  stats.contacts_created += created;
  stats.contacts_updated += updated;
  stats.contacts_skipped += skipped;

  await emitProgress(onProgress, {
    type: "page_processed",
    stats: getProgressStats(runId, stats, {
      current_rule: rule.job_title,
      current_page: page,
      current_rule_total: total,
      current_rule_seen: seenForRule,
      batch_created: created,
      batch_updated: updated,
      batch_skipped: skipped,
    }),
  });
}

export async function loadActiveContactAcquisitionRules(supabase = createSupabaseAdminClient()) {
  const { data, error } = await supabase
    .from("contact_acquisition_rules")
    .select("id, job_title, contact_type, priority, active")
    .eq("active", true)
    .order("priority", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function previewContactAcquisition({ page = 1 } = {}) {
  const supabase = createSupabaseAdminClient();
  const rules = await loadActiveContactAcquisitionRules(supabase);
  const previews = [];

  for (const rule of rules) {
    const { data, elasticQuery } = await searchGleniganContactsByJobTitle(rule.job_title, { page });
    const mapped = getGleniganContactResults(data)
      .slice(0, 3)
      .map((result) => summarizeMappedContact(mapGleniganContact(result, rule)));

    previews.push({
      rule,
      elasticQuery,
      total: data?.total ?? data?.hits?.total?.value ?? null,
      returned: Array.isArray(data?.results) ? data.results.length : Array.isArray(data?.hits?.hits) ? data.hits.hits.length : 0,
      mapped,
    });
  }

  return { page, previews };
}

function getTotalCount(data) {
  if (typeof data?.total === "number") return data.total;
  if (typeof data?.hits?.total === "number") return data.hits.total;
  if (typeof data?.hits?.total?.value === "number") return data.hits.total.value;
  return null;
}

function getProgressStats(runId, stats, extra = {}) {
  return {
    runId,
    contacts_seen: stats.contacts_seen,
    contacts_found_total: stats.contacts_found_total,
    contacts_created: stats.contacts_created,
    contacts_updated: stats.contacts_updated,
    contacts_skipped: stats.contacts_skipped,
    ...extra,
  };
}

async function emitProgress(onProgress, event) {
  if (typeof onProgress === "function") {
    await onProgress(event);
  }
}

async function importRulePages(supabase, rule, stats, { runId, onProgress, signal } = {}) {
  throwIfAborted(signal);

  let page = 1;
  let total = null;
  let seenForRule = 0;
  const ruleResult = {
    job_title: rule.job_title,
    contact_type: rule.contact_type,
    total: null,
    returned: 0,
    pages: 0,
    query: null,
  };

  await emitProgress(onProgress, {
    type: "rule_started",
    stats: getProgressStats(runId, stats, {
      current_rule: rule.job_title,
      current_page: page,
      current_rule_total: null,
    }),
  });

  while (page <= MAX_IMPORT_PAGES) {
    throwIfAborted(signal);

    const { data, elasticQuery } = await searchGleniganContactsByJobTitle(rule.job_title, { page, signal });
    const results = getGleniganContactResults(data);
    if (total === null) {
      total = getTotalCount(data);
      if (typeof total === "number") {
        stats.contacts_found_total += total;
      }
    }
    ruleResult.total = total;
    ruleResult.query = ruleResult.query || elasticQuery;
    ruleResult.pages += 1;
    ruleResult.returned += results.length;
    stats.contacts_seen += results.length;
    seenForRule += results.length;

    await emitProgress(onProgress, {
      type: "page_loaded",
      stats: getProgressStats(runId, stats, {
        current_rule: rule.job_title,
        current_page: page,
        current_rule_total: total,
        current_rule_seen: seenForRule,
      }),
    });

    await importMappedContactsBatch(
      supabase,
      results.map((result) => mapGleniganContact(result, rule)),
      stats,
      { runId, rule, page, total, seenForRule, onProgress, signal }
    );

    if (results.length === 0) break;
    if (total !== null && seenForRule >= total) break;
    if (results.length < GLENIGAN_PAGE_SIZE) break;
    page += 1;
  }

  if (page > MAX_IMPORT_PAGES) {
    ruleResult.capped_at_pages = MAX_IMPORT_PAGES;
  }

  stats.rule_results.push(ruleResult);

  await emitProgress(onProgress, {
    type: "rule_completed",
    stats: getProgressStats(runId, stats, {
      current_rule: rule.job_title,
      current_page: page,
      current_rule_total: total,
      current_rule_seen: seenForRule,
    }),
  });
}

export async function runContactAcquisitionImport({ triggeredBy = null, onProgress, signal } = {}) {
  throwIfAborted(signal);

  const supabase = createSupabaseAdminClient();
  const rules = await loadActiveContactAcquisitionRules(supabase);
  const { data: run, error: runError } = await supabase
    .from("contact_acquisition_runs")
    .insert({
      triggered_by: triggeredBy,
      status: "running",
      details: { rules: rules.map(({ job_title, contact_type, priority }) => ({ job_title, contact_type, priority })) },
    })
    .select("id")
    .single();

  if (runError) throw runError;

  const stats = {
    contacts_seen: 0,
    contacts_found_total: 0,
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    rule_results: [],
  };

  try {
    throwIfAborted(signal);

    await emitProgress(onProgress, {
      type: "started",
      stats: getProgressStats(run.id, stats, {
        active_rules: rules.length,
      }),
    });

    for (const rule of rules) {
      await importRulePages(supabase, rule, stats, { runId: run.id, onProgress, signal });
    }

    throwIfAborted(signal);

    await supabase
      .from("contact_acquisition_runs")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        contacts_seen: stats.contacts_seen,
        contacts_created: stats.contacts_created,
        contacts_updated: stats.contacts_updated,
        contacts_skipped: stats.contacts_skipped,
        details: stats,
      })
      .eq("id", run.id);

    await supabase.from("audit_logs").insert({
      actor_id: triggeredBy,
      action: "contact_acquisition_import",
      entity_type: "contact_acquisition_run",
      entity_id: run.id,
      details: stats,
    });

    await emitProgress(onProgress, {
      type: "completed",
      stats: getProgressStats(run.id, stats),
    });

    return { runId: run.id, ...stats };
  } catch (error) {
    const cancelled = error.name === "AbortError" || error.cancelled === true;

    await supabase
      .from("contact_acquisition_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: cancelled ? "Import cancelled." : error.message,
        details: { ...stats, cancelled },
      })
      .eq("id", run.id);

    await emitProgress(onProgress, {
      type: cancelled ? "cancelled" : "failed",
      error: cancelled ? "Import cancelled." : error.message,
      stats: getProgressStats(run.id, stats),
    });

    throw error;
  }
}
