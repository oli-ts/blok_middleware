import "server-only";

const DEFAULT_CONTACT_SEARCH_PATH = "/contact/_search";

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getSearchUrl({ page = 1 } = {}) {
  const baseUrl = trimTrailingSlash(getRequiredEnv("GLENIGAN_API_BASE_URL"));
  const path = process.env.GLENIGAN_CONTACT_SEARCH_PATH || DEFAULT_CONTACT_SEARCH_PATH;
  const url = new URL(`${baseUrl}${path}`);
  url.searchParams.set("key", getRequiredEnv("GLENIGAN_API_KEY"));
  url.searchParams.set("Page", String(Math.max(1, Math.trunc(Number(page) || 1))));
  return url;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  return { raw: await response.text() };
}

export function buildJobTitleSearchQuery(jobTitle) {
  return {
    query: {
      match_phrase: {
        JobTitle: jobTitle,
      },
    },
  };
}

export async function searchGleniganContactsByJobTitle(jobTitle, { page = 1, signal } = {}) {
  const elasticQuery = buildJobTitleSearchQuery(jobTitle);
  const response = await fetch(getSearchUrl({ page }), {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(elasticQuery),
    cache: "no-store",
    signal,
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(`Glenigan contact search failed with ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return { data, elasticQuery, page };
}
