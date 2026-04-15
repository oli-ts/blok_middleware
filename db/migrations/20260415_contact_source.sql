-- Add display source for contacts and mark existing Glenigan imports.

alter table public.contacts
  add column if not exists source text,
  add column if not exists external_contact_id text;

update public.contacts
set source = 'Glengian'
where source is null
  and source_system = 'glenigan';

drop view if exists public.vw_contact_review_queue;
create view public.vw_contact_review_queue as
select c.id,
       c.first_name,
       c.last_name,
       c.job_title,
       c.email,
       c.phone,
       c.phone_numbers,
       c.linkedin_url,
       c.validation_state,
       c.duplicate_state,
       c.crm_sync_status,
       c.confidence_score,
       c.source,
       c.external_contact_id,
       c.source_system,
       c.source_ref,
       c.source_last_seen_at,
       c.acquisition_job_title,
       c.acquisition_contact_type,
       co.name as company,
       o.name as office,
       array_remove(array_agg(distinct p.title), null) as source_projects
from public.contacts c
left join public.companies co on co.id = c.company_id
left join public.offices o on o.id = c.office_id
left join public.project_contacts pc on pc.contact_id = c.id
left join public.projects p on p.id = pc.project_id
where c.deleted_at is null
group by c.id, co.name, o.name;

notify pgrst, 'reload schema';
