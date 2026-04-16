import "server-only";

function firstValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() !== "") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function firstRawValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

function toInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).replace(/[^0-9-]/g, "");
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatAddress(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "object") {
    const parts = [
      value.Address1,
      value.Address2,
      value.Line1,
      value.Line2,
      value.City,
      value.Town,
      value.County,
      value.PostCode,
      value.Postcode,
      value.ZipCode,
      value.Country,
    ]
      .map((part) => (part === undefined || part === null ? "" : String(part).trim()))
      .filter(Boolean);

    return parts.length > 0 ? parts.join(", ") : null;
  }

  return null;
}

function getCompanySourcePayload(responseData) {
  if (!responseData) return {};
  if (Array.isArray(responseData?.results) && responseData.results.length > 0) return responseData.results[0];
  if (Array.isArray(responseData?.companies) && responseData.companies.length > 0) return responseData.companies[0];
  if (responseData?.company && typeof responseData.company === "object") return responseData.company;
  if (Array.isArray(responseData?.hits?.hits) && responseData.hits.hits.length > 0) {
    const hit = responseData.hits.hits[0];
    return hit._source || hit.fields || hit;
  }
  if (Array.isArray(responseData) && responseData.length > 0) return responseData[0];
  return responseData;
}

export function mapGleniganCompanyResponse(responseData) {
  const source = getCompanySourcePayload(responseData) || {};
  const rawAddress = firstRawValue(source, [
    "HeadquartersAddress",
    "HeadOfficeAddress",
    "Address",
    "RegisteredAddress",
  ]);

  return {
    source,
    external_company_id: firstValue(source, [
      "CompanyId",
      "CompanyID",
      "OrganisationId",
      "OrganisationID",
      "Id",
      "ID",
    ]),
    company: {
      name: firstValue(source, ["CompanyName", "OrganisationName", "Name"]),
      sector: firstValue(source, ["Sector", "Industry"]),
      website: firstValue(source, ["Website", "WebSite", "Url"]),
      phone: firstValue(source, ["Phone", "PhoneNumber", "Telephone", "MainPhone"]),
      description: firstValue(source, ["Description", "Overview", "Summary", "CompanyDescription"]),
      employee_count: toInteger(firstRawValue(source, ["EmployeeCount", "Employees", "NumberOfEmployees"])),
      headquarters_address: formatAddress(rawAddress),
    },
  };
}
