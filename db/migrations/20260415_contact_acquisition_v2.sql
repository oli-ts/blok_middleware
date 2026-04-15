-- Contact acquisition v2: curated job-title rules and Glenigan source metadata.

create table if not exists public.contact_acquisition_rules (
  id uuid primary key default gen_random_uuid(),
  job_title text not null unique,
  contact_type text not null default 'secondary' check (contact_type in ('primary','secondary')),
  priority integer not null default 0,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists contact_acquisition_rules_active_priority_idx
  on public.contact_acquisition_rules(active, priority);

create table if not exists public.contact_acquisition_runs (
  id uuid primary key default gen_random_uuid(),
  triggered_by uuid references public.profiles(id),
  status text not null default 'running' check (status in ('running','success','failed')),
  started_at timestamptz default now(),
  completed_at timestamptz,
  contacts_seen integer not null default 0,
  contacts_created integer not null default 0,
  contacts_updated integer not null default 0,
  contacts_skipped integer not null default 0,
  error_message text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.contact_acquisition_runs
  add column if not exists contacts_skipped integer not null default 0,
  add column if not exists details jsonb default '{}'::jsonb;

create index if not exists contact_acquisition_runs_created_at_idx
  on public.contact_acquisition_runs(created_at desc);

alter table public.contacts
  add column if not exists phone_numbers jsonb default '[]'::jsonb,
  add column if not exists linkedin_url text,
  add column if not exists source text,
  add column if not exists external_contact_id text,
  add column if not exists source_system text,
  add column if not exists source_payload jsonb,
  add column if not exists source_last_seen_at timestamptz,
  add column if not exists acquisition_rule_id uuid references public.contact_acquisition_rules(id),
  add column if not exists acquisition_job_title text,
  add column if not exists acquisition_contact_type text check (acquisition_contact_type in ('primary','secondary'));

create unique index if not exists contacts_source_system_ref_unique_idx
  on public.contacts(source_system, source_ref)
  where source_system is not null and source_ref is not null;

alter table public.contact_acquisition_rules enable row level security;
alter table public.contact_acquisition_runs enable row level security;

drop policy if exists "contact_acquisition_rules admin" on public.contact_acquisition_rules;
create policy "contact_acquisition_rules admin" on public.contact_acquisition_rules for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "contact_acquisition_runs admin" on public.contact_acquisition_runs;
create policy "contact_acquisition_runs admin" on public.contact_acquisition_runs for all
  using (public.is_admin()) with check (public.is_admin());

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

insert into public.contact_acquisition_rules (job_title, contact_type, priority, active)
values
  ('facilities manager', 'primary', 1, true),
  ('head of facilities', 'primary', 2, true),
  ('estates manager', 'secondary', 3, true)
on conflict (job_title) do nothing;

notify pgrst, 'reload schema';
