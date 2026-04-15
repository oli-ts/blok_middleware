function firstValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

function uniqueValues(values) {
  return Array.from(
    new Set(values.map((value) => (value ? String(value).trim() : "")).filter(Boolean))
  );
}

function firstOffice(source) {
  if (Array.isArray(source?.CurrentOffices) && source.CurrentOffices.length > 0) {
    return source.CurrentOffices[0];
  }
  if (Array.isArray(source?.PastOffices) && source.PastOffices.length > 0) {
    return source.PastOffices[0];
  }
  return null;
}

function splitName(fullName) {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1),
  };
}

export function getGleniganContactResults(responseData) {
  if (Array.isArray(responseData?.results)) {
    return responseData.results.map((result) => ({
      resultId: result.id || result.Id || result.source?.ContactId,
      source: result.source || result._source || result.fields || result,
    }));
  }

  if (Array.isArray(responseData?.hits?.hits)) {
    return responseData.hits.hits.map((hit) => ({
      resultId: hit._id,
      source: hit._source || hit.fields || hit,
    }));
  }

  if (Array.isArray(responseData)) {
    return responseData.map((result) => ({
      resultId: result.id || result.Id || result.ContactId,
      source: result.source || result,
    }));
  }

  return [];
}

export function mapGleniganContact(result, rule) {
  const source = result.source || {};
  const office = firstOffice(source);
  const split = splitName(firstValue(source, ["FullName", "Name", "ContactName"]));
  const contactId = firstValue(source, ["ContactId", "ContactID", "Id", "ID"]) || result.resultId;
  const email = firstValue(source, ["Email", "EmailAddress", "OfficeEmail"]);
  const phoneNumbers = uniqueValues([
    firstValue(source, ["PhoneNumber", "Phone", "Telephone"]),
    firstValue(source, ["Mobile"]),
    firstValue(source, ["OfficePhoneNumber", "OfficePhone"]),
  ]);

  return {
    contact: {
      first_name: firstValue(source, ["FirstName", "Forename"]) || split.firstName,
      last_name: firstValue(source, ["LastName", "Surname"]) || split.lastName,
      job_title: firstValue(source, ["JobTitle", "Title"]),
      email,
      phone: phoneNumbers[0] || null,
      phone_numbers: phoneNumbers,
      linkedin_url: firstValue(source, ["ContactLinkedInUrl", "LinkedInUrl", "LinkedIn", "Linkedin"]),
      source: "Glengian",
      external_contact_id: contactId ? String(contactId) : null,
      source_system: "glenigan",
      source_ref: contactId ? String(contactId) : email,
      source_payload: source,
      source_last_seen_at: new Date().toISOString(),
      acquisition_rule_id: rule.id,
      acquisition_job_title: rule.job_title,
      acquisition_contact_type: rule.contact_type,
      validation_state: "unverified",
      confidence_score: 0.75,
      duplicate_state: "unknown",
      crm_sync_status: "not_pushed",
    },
    company: {
      name: firstValue(source, ["CompanyName", "OrganisationName", "Company"]) || office?.Name || null,
      sector: firstValue(source, ["Sector"]),
      website: firstValue(source, ["Website"]) || office?.Website || null,
    },
    office: {
      name: firstValue(source, ["OfficeName", "BranchName"]) || office?.Name || null,
      address: firstValue(source, ["Address", "OfficeAddress"]) || office?.Address || null,
      region: firstValue(source, ["ContactRegion", "Region", "CountyName", "County"]),
      phone: firstValue(source, ["OfficePhoneNumber", "OfficePhone", "CompanyPhone"]),
    },
  };
}

export function summarizeMappedContact(mapped) {
  return {
    source_ref: mapped.contact.source_ref,
    first_name: mapped.contact.first_name,
    last_name: mapped.contact.last_name,
    job_title: mapped.contact.job_title,
    email: mapped.contact.email,
    phone_numbers: mapped.contact.phone_numbers,
    linkedin_url: mapped.contact.linkedin_url,
    source: mapped.contact.source,
    external_contact_id: mapped.contact.external_contact_id,
    company: mapped.company.name,
    contact_type: mapped.contact.acquisition_contact_type,
  };
}
