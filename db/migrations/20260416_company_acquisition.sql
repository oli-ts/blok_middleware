-- Persist office source identifiers for downstream company enrichment and
-- store normalized company acquisition data alongside the raw Glenigan payload.

alter table public.companies
  add column if not exists external_company_id text,
  add column if not exists source_system text,
  add column if not exists source_ref text,
  add column if not exists source_payload jsonb,
  add column if not exists source_last_seen_at timestamptz,
  add column if not exists description text,
  add column if not exists phone text,
  add column if not exists employee_count integer,
  add column if not exists headquarters_address text;

create unique index if not exists companies_source_system_ref_unique_idx
  on public.companies(source_system, source_ref)
  where source_system is not null and source_ref is not null;

alter table public.offices
  add column if not exists external_office_id text,
  add column if not exists source_system text,
  add column if not exists source_ref text,
  add column if not exists source_payload jsonb,
  add column if not exists source_last_seen_at timestamptz;

create unique index if not exists offices_source_system_ref_unique_idx
  on public.offices(source_system, source_ref)
  where source_system is not null and source_ref is not null;

drop view if exists public.vw_company_contact_summary;
create view public.vw_company_contact_summary as
select co.id,
       co.name,
       co.sector,
       co.website,
       co.phone,
       co.employee_count,
       co.external_company_id,
       co.source_last_seen_at,
       count(distinct c.id) as contact_count,
       count(distinct p.id) as project_count,
       max(crl.crm_id) as crm_org_id
from public.companies co
left join public.contacts c on c.company_id = co.id
left join public.project_contacts pc on pc.contact_id = c.id
left join public.projects p on p.id = pc.project_id
left join public.crm_record_links crl on crl.source_entity = 'company' and crl.source_id = co.id
where co.deleted_at is null
group by co.id;

notify pgrst, 'reload schema';
