-- Store the external contact id returned by source systems such as Glenigan.

alter table public.contacts
  add column if not exists external_contact_id text;

update public.contacts
set external_contact_id = source_ref
where external_contact_id is null
  and source_system = 'glenigan'
  and source_ref is not null;

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

drop view if exists public.vw_contact_project_summary;
create view public.vw_contact_project_summary as
select c.id as contact_id,
       c.first_name,
       c.last_name,
       c.job_title,
       c.email,
       c.phone,
       c.phone_numbers,
       c.linkedin_url,
       c.source,
       c.external_contact_id,
       c.source_system,
       c.source_ref,
       c.source_last_seen_at,
       c.validation_state,
       c.crm_sync_status,
       array_agg(
         jsonb_build_object(
           'project_id', p.id,
           'title', p.title,
           'stage', p.stage,
           'value', p.value_numeric,
           'region', p.region,
           'relevance_tags', p.relevance_tags,
           'status', p.status
         )
       ) filter (where p.id is not null) as projects
from public.contacts c
left join public.project_contacts pc on pc.contact_id = c.id
left join public.projects p on p.id = pc.project_id
where c.deleted_at is null
group by c.id;

notify pgrst, 'reload schema';
