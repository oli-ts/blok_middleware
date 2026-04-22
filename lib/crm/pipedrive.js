import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function hasText(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function cleanString(value) {
  return hasText(value) ? String(value).trim() : "";
}

function buildBaseUrl({ baseUrl, companyDomain }) {
  if (hasText(baseUrl)) {
    return trimTrailingSlash(baseUrl);
  }

  const domain = cleanString(companyDomain);
  if (!domain) return "";

  if (/^https?:\/\//i.test(domain)) {
    return trimTrailingSlash(domain);
  }

  return `https://${domain}.pipedrive.com`;
}

function pickFirstText(...values) {
  for (const value of values) {
    if (hasText(value)) return String(value).trim();
  }
  return "";
}

function getConnectionCredential(credentials, keys) {
  for (const key of keys) {
    const value = credentials?.[key];
    if (hasText(value)) return String(value).trim();
  }
  return "";
}

function prunePayload(value) {
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => prunePayload(item))
      .filter((item) => item !== undefined);
    return cleaned.length ? cleaned : undefined;
  }

  if (value && typeof value === "object") {
    const cleanedEntries = Object.entries(value)
      .map(([key, item]) => [key, prunePayload(item)])
      .filter(([, item]) => item !== undefined);

    if (cleanedEntries.length === 0) return undefined;
    return Object.fromEntries(cleanedEntries);
  }

  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function parseResponsePayload(text) {
  if (!hasText(text)) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function createPipedriveError(message, { status, payload } = {}) {
  const error = new Error(message);
  error.status = status;
  error.payload = payload;
  return error;
}

export function toPipedriveId(value) {
  const cleaned = cleanString(value);
  if (!/^\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

export async function getPipedriveConfig(supabase = createSupabaseAdminClient()) {
  const envToken = pickFirstText(process.env.PIPEDRIVE_API_TOKEN);
  const envBaseUrl = buildBaseUrl({
    baseUrl: process.env.PIPEDRIVE_BASE_URL,
    companyDomain: process.env.PIPEDRIVE_COMPANY_DOMAIN,
  });

  if (envToken && envBaseUrl) {
    return { apiToken: envToken, baseUrl: envBaseUrl };
  }

  const { data: connection, error } = await supabase
    .from("api_connections")
    .select("credentials")
    .eq("provider", "pipedrive")
    .eq("status", "active")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const credentials = connection?.credentials || {};
  const apiToken = envToken || getConnectionCredential(credentials, ["token", "api_token", "apiToken"]);
  const baseUrl =
    envBaseUrl ||
    buildBaseUrl({
      baseUrl: getConnectionCredential(credentials, ["base_url", "baseUrl"]),
      companyDomain: getConnectionCredential(credentials, ["company_domain", "companyDomain", "domain"]),
    });

  if (!apiToken || !baseUrl) {
    throw createPipedriveError(
      "Missing Pipedrive credentials. Configure PIPEDRIVE_API_TOKEN and PIPEDRIVE_COMPANY_DOMAIN/PIPEDRIVE_BASE_URL, or store an active Pipedrive connection with token and company domain.",
      { status: 500 }
    );
  }

  return { apiToken, baseUrl };
}

async function pipedriveRequest(path, { method = "GET", searchParams, json, config, signal } = {}) {
  const resolvedConfig = config || (await getPipedriveConfig());
  const url = new URL(`${resolvedConfig.baseUrl}${path}`);
  url.searchParams.set("api_token", resolvedConfig.apiToken);

  for (const [key, value] of Object.entries(searchParams || {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body: json ? JSON.stringify(prunePayload(json)) : undefined,
    cache: "no-store",
    signal,
  });

  const text = await response.text();
  const payload = parseResponsePayload(text);

  if (!response.ok || payload?.success === false) {
    throw createPipedriveError(
      payload?.error || payload?.message || `Pipedrive request failed with ${response.status}.`,
      {
        status: response.status,
        payload,
      }
    );
  }

  return payload?.data;
}

function unwrapSearchItems(data) {
  if (Array.isArray(data?.items)) {
    return data.items.map((item) => item?.item || item).filter(Boolean);
  }

  if (Array.isArray(data)) return data;
  return [];
}

export async function searchPipedrivePersons(
  { term, fields = "name", exactMatch = true, organizationId, limit = 25 },
  options = {}
) {
  const cleanedTerm = cleanString(term);
  if (!cleanedTerm) return [];
  if (cleanedTerm.length < 2 && !exactMatch) return [];

  const data = await pipedriveRequest("/api/v2/persons/search", {
    ...options,
    searchParams: {
      term: cleanedTerm,
      fields,
      exact_match: exactMatch,
      organization_id: organizationId,
      limit,
    },
  });

  return unwrapSearchItems(data);
}

export async function createPipedrivePerson(payload, options = {}) {
  return pipedriveRequest("/api/v2/persons", {
    ...options,
    method: "POST",
    json: payload,
  });
}

export async function updatePipedrivePerson(personId, payload, options = {}) {
  return pipedriveRequest(`/api/v2/persons/${personId}`, {
    ...options,
    method: "PATCH",
    json: payload,
  });
}

export async function searchPipedriveOrganizations(
  { term, fields = "name", exactMatch = true, limit = 25 },
  options = {}
) {
  const cleanedTerm = cleanString(term);
  if (!cleanedTerm) return [];
  if (cleanedTerm.length < 2 && !exactMatch) return [];

  const data = await pipedriveRequest("/api/v2/organizations/search", {
    ...options,
    searchParams: {
      term: cleanedTerm,
      fields,
      exact_match: exactMatch,
      limit,
    },
  });

  return unwrapSearchItems(data);
}

export async function createPipedriveOrganization(payload, options = {}) {
  return pipedriveRequest("/api/v2/organizations", {
    ...options,
    method: "POST",
    json: payload,
  });
}

export async function searchPipedriveLeads(
  { term, exactMatch = true, personId, organizationId, limit = 25 },
  options = {}
) {
  const cleanedTerm = cleanString(term);
  if (!cleanedTerm) return [];
  if (cleanedTerm.length < 2 && !exactMatch) return [];

  const data = await pipedriveRequest("/api/v2/leads/search", {
    ...options,
    searchParams: {
      term: cleanedTerm,
      exact_match: exactMatch,
      person_id: personId,
      organization_id: organizationId,
      limit,
    },
  });

  return unwrapSearchItems(data);
}

export async function createPipedriveLead(payload, options = {}) {
  return pipedriveRequest("/api/v1/leads", {
    ...options,
    method: "POST",
    json: payload,
  });
}
