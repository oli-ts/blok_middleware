-- Expose the original source payload on contact detail pages.

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
       c.source_payload,
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
