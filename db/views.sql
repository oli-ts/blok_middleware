create or replace view public.vw_dashboard_projects as
select p.id,
       p.title,
       p.region,
       p.value_numeric,
       p.stage,
       p.start_date,
       p.fm_score,
       p.relevance_tags,
       p.status,
       p.created_at as ingested_at,
       os.vertical,
       os.fm_score as vertical_score,
       p.source_ref
from public.projects p
left join lateral (
  select vertical, fm_score
  from public.opportunity_scores os
  where os.project_id = p.id
  order by os.computed_at desc
  limit 1
) os on true
where p.deleted_at is null;

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
       c.source_payload,
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

create or replace view public.vw_contact_project_summary as
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

create or replace view public.vw_crm_push_status as
select j.id as job_id,
       j.status as job_status,
       j.target,
       j.summary,
       j.created_at,
       j.started_at,
       j.completed_at,
       ji.id as item_id,
       ji.source_entity,
       ji.source_id,
       ji.target_type,
       ji.status as item_status,
       ji.error_message,
       ji.result
from public.crm_push_jobs j
join public.crm_push_job_items ji on ji.job_id = j.id;

create or replace view public.vw_duplicate_review_queue as
select dm.id,
       dm.entity_type,
       dm.entity_id,
       dm.candidate_id,
       dm.score,
       dm.status,
       case when dm.entity_type = 'contact'
            then concat_ws(' ', c.first_name, c.last_name)
            else co.name end as entity_name
from public.duplicate_matches dm
left join public.contacts c on dm.entity_type = 'contact' and dm.entity_id = c.id
left join public.companies co on dm.entity_type = 'company' and dm.entity_id = co.id;
