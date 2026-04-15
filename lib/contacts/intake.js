import "server-only";

const REQUIRED_FIELDS = ["first_name", "last_name", "job_title", "email", "company", "source"];

function cleanString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

export function normalizeContactSource(value) {
  const source = cleanString(value);
  if (!source) return "";
  return `${source.charAt(0).toUpperCase()}${source.slice(1)}`;
}

function firstPopulated(input, keys) {
  for (const key of keys) {
    const value = cleanString(input?.[key]);
    if (value) return value;
  }
  return "";
}

function normalizePhoneNumbers(input) {
  const rawValues = Array.isArray(input?.phone_numbers)
    ? input.phone_numbers
    : [
        input?.phone_numbers,
        input?.phone,
        input?.mobile,
        input?.telephone,
      ];

  return Array.from(
    new Set(
      rawValues
        .flatMap((value) => cleanString(value).split(/[,\n;|]/))
        .map((value) => cleanString(value))
        .filter(Boolean)
    )
  );
}

export function normalizeContactIntake(input = {}) {
  const phoneNumbers = normalizePhoneNumbers(input);
  const contact = {
    first_name: firstPopulated(input, ["first_name", "firstName", "forename", "First Name", "FirstName"]),
    last_name: firstPopulated(input, ["last_name", "lastName", "surname", "Last Name", "LastName"]),
    job_title: firstPopulated(input, ["job_title", "jobTitle", "title", "Job Title", "JobTitle"]),
    email: firstPopulated(input, ["email", "Email", "Email Address", "email_address"]),
    phone: phoneNumbers[0] || "",
    phone_numbers: phoneNumbers,
    linkedin_url: firstPopulated(input, ["linkedin_url", "linkedin", "LinkedIn", "LinkedIn URL", "Linkedin"]),
    source: normalizeContactSource(firstPopulated(input, ["source", "Source"])),
    source_system: firstPopulated(input, ["source_system", "sourceSystem"]) || "manual",
    source_ref: firstPopulated(input, ["source_ref", "sourceRef"]) || null,
    source_payload: input.source_payload || input.raw || null,
    source_last_seen_at: new Date().toISOString(),
    acquisition_contact_type: input.acquisition_contact_type === "primary" ? "primary" : "secondary",
    validation_state: "unverified",
    confidence_score: input.confidence_score ?? null,
    duplicate_state: "unknown",
    crm_sync_status: "not_pushed",
  };

  const company = {
    name: firstPopulated(input, ["company", "company_name", "companyName", "Company", "Company Name"]),
    sector: firstPopulated(input, ["sector", "Sector"]) || null,
    website: firstPopulated(input, ["website", "Website"]) || null,
  };

  const office = {
    name: firstPopulated(input, ["office", "office_name", "Office", "Office Name"]) || null,
    address: firstPopulated(input, ["address", "Address", "Office Address"]) || null,
    region: firstPopulated(input, ["region", "Region"]) || null,
    phone: firstPopulated(input, ["office_phone", "Office Phone"]) || null,
  };

  const normalized = { contact, company, office };
  const missing = REQUIRED_FIELDS.filter((field) => {
    if (field === "company") return !company.name;
    return !contact[field];
  });

  return {
    ...normalized,
    missing,
    valid: missing.length === 0,
  };
}

async function findOrCreateCompany(supabase, company) {
  if (!company.name) return null;

  const { data: existing, error: existingError } = await supabase
    .from("companies")
    .select("id")
    .ilike("name", company.name)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name: company.name,
      sector: company.sector,
      website: company.website,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

async function findOrCreateOffice(supabase, office, companyId) {
  if (!companyId || (!office.name && !office.address)) return null;

  let query = supabase.from("offices").select("id").eq("company_id", companyId).limit(1);
  if (office.name) query = query.ilike("name", office.name);
  if (!office.name && office.address) query = query.ilike("address", office.address);

  const { data: existing, error: existingError } = await query.maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("offices")
    .insert({
      company_id: companyId,
      name: office.name,
      address: office.address,
      region: office.region,
      phone: office.phone,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

async function findExistingContact(supabase, contact) {
  if (contact.source_system && contact.source_ref) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id")
      .eq("source_system", contact.source_system)
      .eq("source_ref", contact.source_ref)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data;
  }

  if (contact.email) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id")
      .ilike("email", contact.email)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data;
  }

  return null;
}

export async function upsertContactIntake(supabase, input) {
  const normalized = normalizeContactIntake(input);
  if (!normalized.valid) {
    return {
      outcome: "invalid",
      missing: normalized.missing,
    };
  }

  const companyId = await findOrCreateCompany(supabase, normalized.company);
  const officeId = await findOrCreateOffice(supabase, normalized.office, companyId);
  const contact = {
    ...normalized.contact,
    company_id: companyId,
    office_id: officeId,
  };

  const existing = await findExistingContact(supabase, contact);
  if (existing?.id) {
    const { error } = await supabase
      .from("contacts")
      .update({
        first_name: contact.first_name,
        last_name: contact.last_name,
        job_title: contact.job_title,
        email: contact.email,
        phone: contact.phone,
        phone_numbers: contact.phone_numbers,
        linkedin_url: contact.linkedin_url,
        company_id: contact.company_id,
        office_id: contact.office_id,
        source: contact.source,
        source_system: contact.source_system,
        source_ref: contact.source_ref,
        source_payload: contact.source_payload,
        source_last_seen_at: contact.source_last_seen_at,
        acquisition_contact_type: contact.acquisition_contact_type,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) throw error;
    return { outcome: "updated", id: existing.id };
  }

  const { data, error } = await supabase.from("contacts").insert(contact).select("id").single();
  if (error) throw error;
  return { outcome: "created", id: data.id };
}
