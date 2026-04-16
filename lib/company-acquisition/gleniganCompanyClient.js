import "server-only";

const DEFAULT_COMPANY_PATH = "/company";

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getCompanyUrl(officeId) {
  const baseUrl = trimTrailingSlash(getRequiredEnv("GLENIGAN_API_BASE_URL"));
  const path = process.env.GLENIGAN_COMPANY_PATH || DEFAULT_COMPANY_PATH;
  const url = new URL(`${baseUrl}${path}`);
  url.searchParams.set("key", getRequiredEnv("GLENIGAN_API_KEY"));
  url.searchParams.set("Ids", String(officeId));
  return url;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  return { raw: await response.text() };
}

export async function fetchGleniganCompanyByOfficeId(officeId, { signal } = {}) {
  if (!officeId) {
    const error = new Error("An officeId is required to fetch company data.");
    error.status = 400;
    throw error;
  }
  
  const response = await fetch(getCompanyUrl(officeId), {
    method: "GET",
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
    signal,
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(`Glenigan company lookup failed with ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return { data, officeId };
}
