-- Enable RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_raw_ingestions enable row level security;
alter table public.project_tags enable row level security;
alter table public.contacts enable row level security;
alter table public.companies enable row level security;
alter table public.offices enable row level security;
alter table public.project_contacts enable row level security;
alter table public.opportunity_scores enable row level security;
alter table public.duplicate_matches enable row level security;
alter table public.crm_push_jobs enable row level security;
alter table public.crm_push_job_items enable row level security;
alter table public.crm_record_links enable row level security;
alter table public.audit_logs enable row level security;
alter table public.vertical_rules enable row level security;
alter table public.api_connections enable row level security;
alter table public.contact_acquisition_rules enable row level security;
alter table public.contact_acquisition_runs enable row level security;
alter table public.automation_rules enable row level security;
alter table public.contact_validation_events enable row level security;
alter table public.project_status_history enable row level security;
alter table public.saved_filters enable row level security;
alter table public.user_preferences enable row level security;
alter table public.field_mapping_templates enable row level security;

-- helper: admin check
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- profiles: self read, admin manage
create policy "profiles self read" on public.profiles
  for select using (id = auth.uid());
create policy "profiles admin all" on public.profiles
  for all using (public.is_admin())
  with check (public.is_admin());

-- projects
create policy "projects select all" on public.projects
  for select using (true);
create policy "projects insert auth" on public.projects
  for insert with check (auth.uid() is not null);
create policy "projects update owner or admin" on public.projects
  for update using (created_by = auth.uid() or public.is_admin());

-- project_raw_ingestions (admin + system)
create policy "ingestions read" on public.project_raw_ingestions
  for select using (public.is_admin());
create policy "ingestions write admin" on public.project_raw_ingestions
  for all using (public.is_admin())
  with check (public.is_admin());

-- project_tags
create policy "project_tags select" on public.project_tags for select using (true);
create policy "project_tags insert" on public.project_tags for insert with check (auth.uid() is not null);
create policy "project_tags update" on public.project_tags for update using (auth.uid() is not null);

-- contacts
create policy "contacts select" on public.contacts for select using (true);
create policy "contacts insert" on public.contacts for insert with check (auth.uid() is not null);
create policy "contacts update" on public.contacts for update using (auth.uid() is not null);

-- companies
create policy "companies select" on public.companies for select using (true);
create policy "companies insert" on public.companies for insert with check (auth.uid() is not null);
create policy "companies update" on public.companies for update using (auth.uid() is not null);

-- offices
create policy "offices select" on public.offices for select using (true);
create policy "offices insert" on public.offices for insert with check (auth.uid() is not null);
create policy "offices update" on public.offices for update using (auth.uid() is not null);

-- project_contacts
create policy "project_contacts select" on public.project_contacts for select using (true);
create policy "project_contacts insert" on public.project_contacts for insert with check (auth.uid() is not null);
create policy "project_contacts update" on public.project_contacts for update using (auth.uid() is not null);

-- opportunity_scores
create policy "opportunity_scores select" on public.opportunity_scores for select using (true);
create policy "opportunity_scores insert" on public.opportunity_scores for insert with check (auth.uid() is not null);

-- duplicate_matches
create policy "duplicate_matches select" on public.duplicate_matches for select using (true);
create policy "duplicate_matches update admin" on public.duplicate_matches
  for update using (public.is_admin());

-- crm push jobs
create policy "crm_jobs select" on public.crm_push_jobs for select using (true);
create policy "crm_jobs insert" on public.crm_push_jobs for insert with check (auth.uid() is not null);
create policy "crm_jobs update owner or admin" on public.crm_push_jobs
  for update using (created_by = auth.uid() or public.is_admin());

-- crm job items
create policy "crm_job_items select" on public.crm_push_job_items for select using (true);
create policy "crm_job_items update" on public.crm_push_job_items for update using (auth.uid() is not null);

-- crm record links
create policy "crm_record_links select" on public.crm_record_links for select using (true);
create policy "crm_record_links admin write" on public.crm_record_links
  for all using (public.is_admin())
  with check (public.is_admin());

-- audit logs (admin only)
create policy "audit_admin_select" on public.audit_logs
  for select using (public.is_admin());

-- vertical_rules, api_connections, automation_rules (admin only)
create policy "vertical_rules admin" on public.vertical_rules for all
  using (public.is_admin()) with check (public.is_admin());
create policy "api_connections admin" on public.api_connections for all
  using (public.is_admin()) with check (public.is_admin());
create policy "contact_acquisition_rules admin" on public.contact_acquisition_rules for all
  using (public.is_admin()) with check (public.is_admin());
create policy "contact_acquisition_runs admin" on public.contact_acquisition_runs for all
  using (public.is_admin()) with check (public.is_admin());
create policy "automation_rules admin" on public.automation_rules for all
  using (public.is_admin()) with check (public.is_admin());

-- contact_validation_events
create policy "validation_events select" on public.contact_validation_events for select using (true);
create policy "validation_events insert auth" on public.contact_validation_events for insert with check (auth.uid() is not null);

-- project_status_history
create policy "project_status_history select" on public.project_status_history for select using (true);
create policy "project_status_history insert auth" on public.project_status_history for insert with check (auth.uid() is not null);

-- saved_filters
create policy "saved_filters select owner" on public.saved_filters for select using (owner_id = auth.uid());
create policy "saved_filters write owner" on public.saved_filters for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- user_preferences
create policy "user_prefs select owner" on public.user_preferences for select using (user_id = auth.uid());
create policy "user_prefs write owner" on public.user_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- field_mapping_templates
create policy "mapping_templates select" on public.field_mapping_templates for select using (true);
create policy "mapping_templates insert" on public.field_mapping_templates for insert with check (auth.uid() is not null);
create policy "mapping_templates update owner" on public.field_mapping_templates
  for update using (created_by = auth.uid() or public.is_admin());
