-- Reset legacy constraint from early drafts (idempotent)
alter table if exists public.profiles drop constraint if exists profiles_role_check;

-- Core extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  full_name text,
  department text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists profiles_role_idx on public.profiles(role);

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'user',
    nullif(
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name'
      ),
      ''
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user_profile();

insert into public.profiles (id, role, full_name)
select
  u.id,
  'user',
  nullif(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'), '')
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- api connections
create table if not exists public.api_connections (
  id uuid primary key default gen_random_uuid(),
  provider text check (provider in ('glenigan','pipedrive')),
  name text,
  credentials jsonb,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- contact acquisition rules
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
create index if not exists contact_acquisition_runs_created_at_idx
  on public.contact_acquisition_runs(created_at desc);

-- vertical rules
create table if not exists public.vertical_rules (
  id uuid primary key default gen_random_uuid(),
  vertical text unique,
  keywords text[],
  weight numeric default 1,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- automation rules
create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text,
  rule_type text check (rule_type in ('auto_push','manual_review','duplicate_handling')),
  config jsonb,
  active boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ingestion
create table if not exists public.project_raw_ingestions (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'glenigan',
  source_ref text,
  payload jsonb not null,
  ingested_at timestamptz default now(),
  status text default 'parsed',
  created_at timestamptz default now()
);
create index if not exists project_raw_ingestions_source_ref_idx on public.project_raw_ingestions(source_ref);

-- companies and offices
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text,
  website text,
  crm_org_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists companies_name_idx on public.companies using gin (to_tsvector('english', name));

create table if not exists public.offices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text,
  address text,
  region text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists offices_company_idx on public.offices(company_id);

-- projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  raw_ingestion_id uuid references public.project_raw_ingestions(id),
  title text not null,
  summary text,
  address text,
  region text,
  value_numeric numeric,
  stage text,
  sector text,
  start_date date,
  relevance_tags text[] default '{}',
  fm_score numeric,
  status text default 'new',
  source_ref text,
  source_payload jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists projects_region_idx on public.projects(region);
create index if not exists projects_stage_idx on public.projects(stage);
create index if not exists projects_relevance_tags_idx on public.projects using gin (relevance_tags);

-- project tags
create table if not exists public.project_tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  tag text not null,
  created_at timestamptz default now(),
  created_by uuid references public.profiles(id)
);
create index if not exists project_tags_project_idx on public.project_tags(project_id);

-- contacts
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  job_title text,
  email text,
  phone text,
  phone_numbers jsonb default '[]'::jsonb,
  linkedin_url text,
  company_id uuid references public.companies(id),
  office_id uuid references public.offices(id),
  source text,
  external_contact_id text,
  source_ref text,
  source_system text,
  source_payload jsonb,
  source_last_seen_at timestamptz,
  acquisition_rule_id uuid references public.contact_acquisition_rules(id),
  acquisition_job_title text,
  acquisition_contact_type text check (acquisition_contact_type in ('primary','secondary')),
  validation_state text default 'unverified',
  confidence_score numeric,
  duplicate_state text default 'unknown',
  crm_sync_status text default 'not_pushed',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists contacts_email_idx on public.contacts(lower(email));
create index if not exists contacts_company_idx on public.contacts(company_id);
create unique index if not exists contacts_source_system_ref_unique_idx
  on public.contacts(source_system, source_ref)
  where source_system is not null and source_ref is not null;
create unique index if not exists contacts_source_system_ref_upsert_idx
  on public.contacts(source_system, source_ref);

-- project_contacts (junction)
create table if not exists public.project_contacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  role text,
  confidence_score numeric,
  created_at timestamptz default now()
);
create unique index if not exists project_contacts_unique on public.project_contacts(project_id, contact_id);

-- opportunity scores
create table if not exists public.opportunity_scores (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  fm_score numeric,
  vertical text,
  rationale text,
  computed_at timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists opportunity_scores_project_idx on public.opportunity_scores(project_id);

-- duplicate matches
create table if not exists public.duplicate_matches (
  id uuid primary key default gen_random_uuid(),
  entity_type text check (entity_type in ('contact','company')),
  entity_id uuid not null,
  candidate_id uuid not null,
  score numeric,
  status text default 'pending',
  created_at timestamptz default now()
);
create index if not exists duplicate_matches_entity_idx on public.duplicate_matches(entity_type, entity_id);

-- crm push tracking
create table if not exists public.crm_push_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id),
  status text default 'queued',
  target text default 'pipedrive',
  summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.crm_push_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.crm_push_jobs(id) on delete cascade,
  source_entity text check (source_entity in ('project','contact','company')),
  source_id uuid,
  target_type text check (target_type in ('deal','person','org')),
  status text default 'queued',
  error_message text,
  payload jsonb,
  result jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists crm_job_items_job_idx on public.crm_push_job_items(job_id);

create table if not exists public.crm_record_links (
  id uuid primary key default gen_random_uuid(),
  source_entity text,
  source_id uuid,
  crm_type text check (crm_type in ('deal','person','org')),
  crm_id text,
  last_synced_at timestamptz default now()
);
create unique index if not exists crm_record_links_unique on public.crm_record_links(source_entity, source_id, crm_type);

-- audit logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz default now()
);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

-- optional: validation events
create table if not exists public.contact_validation_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  from_state text,
  to_state text,
  note text,
  created_at timestamptz default now()
);

-- optional: status history
create table if not exists public.project_status_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  from_status text,
  to_status text,
  actor_id uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- optional: saved filters
create table if not exists public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id),
  name text,
  context text,
  config jsonb,
  created_at timestamptz default now()
);

-- optional: user preferences
create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  prefs jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- optional: mapping templates
create table if not exists public.field_mapping_templates (
  id uuid primary key default gen_random_uuid(),
  name text,
  entity text check (entity in ('deal','person','org')),
  mapping jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
