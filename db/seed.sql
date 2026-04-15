-- Development seed data (idempotent)
-- Run after schema.sql, views.sql, policies.sql

-- helper: deterministically hashed password for local sign-in
with creds as (
  select
    '00000000-0000-0000-0000-000000000001'::uuid as admin_id,
    '00000000-0000-0000-0000-000000000002'::uuid as user_id,
    crypt('password123', gen_salt('bf')) as pw
)
insert into auth.users (id, email, encrypted_password, email_confirmed_at, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select admin_id, 'alex.ops@example.com', pw, now(), 'authenticated', 'authenticated', jsonb_build_object('provider', 'email'), '{}'::jsonb, now(), now() from creds
on conflict (id) do nothing;

with creds as (
  select
    '00000000-0000-0000-0000-000000000001'::uuid as admin_id,
    '00000000-0000-0000-0000-000000000002'::uuid as user_id,
    crypt('password123', gen_salt('bf')) as pw
)
insert into auth.users (id, email, encrypted_password, email_confirmed_at, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select user_id, 'sam.sales@example.com', pw, now(), 'authenticated', 'authenticated', jsonb_build_object('provider', 'email'), '{}'::jsonb, now(), now() from creds
on conflict (id) do nothing;

-- profiles
insert into public.profiles (id, role, full_name, department)
values
  ('00000000-0000-0000-0000-000000000001', 'admin', 'Alex Ops', 'Operations'),
  ('00000000-0000-0000-0000-000000000002', 'user',  'Sam Sales', 'Sales')
on conflict (id) do nothing;

-- api connections
insert into public.api_connections (id, provider, name, credentials, status)
values
  ('11111111-1111-4111-8111-111111111111', 'glenigan', 'Glenigan Sandbox', jsonb_build_object('api_key', 'demo-key'), 'active'),
  ('11111111-1111-4111-8111-222222222222', 'pipedrive', 'Pipedrive Sandbox', jsonb_build_object('token', 'demo-token', 'region', 'eu'), 'active')
on conflict (id) do nothing;

-- contact acquisition rules
insert into public.contact_acquisition_rules (id, job_title, contact_type, priority, active, created_by)
values
  ('12111111-1111-4111-8111-111111111111', 'facilities manager', 'primary', 1, true, '00000000-0000-0000-0000-000000000001'),
  ('12111111-1111-4111-8111-222222222222', 'head of facilities', 'primary', 2, true, '00000000-0000-0000-0000-000000000001'),
  ('12111111-1111-4111-8111-333333333333', 'estates manager', 'secondary', 3, true, '00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- vertical rules
insert into public.vertical_rules (id, vertical, keywords, weight, active)
values
  ('22222222-2222-4222-8222-111111111111', 'FM', array['facilities','maintenance','fm'], 1.0, true),
  ('22222222-2222-4222-8222-222222222222', 'M&E', array['mechanical','electrical','m&e'], 0.8, true),
  ('22222222-2222-4222-8222-333333333333', 'Refurb', array['refurbishment','fitout'], 0.6, true)
on conflict (id) do nothing;

-- automation rules
insert into public.automation_rules (id, name, rule_type, config, active)
values
  ('33333333-3333-4333-8333-111111111111', 'Auto push high confidence', 'auto_push', jsonb_build_object('threshold', 0.85, 'validation_state', 'verified'), true),
  ('33333333-3333-4333-8333-222222222222', 'Manual review duplicates', 'manual_review', jsonb_build_object('duplicate_state', 'needs_review'), true)
on conflict (id) do nothing;

-- raw ingestion
insert into public.project_raw_ingestions (id, source, source_ref, payload, status, ingested_at)
values
  ('44444444-4444-4444-8444-111111111111', 'glenigan', 'GL-1001', '{}'::jsonb, 'parsed', now())
on conflict (id) do nothing;

-- companies
insert into public.companies (id, name, sector, website, crm_org_id)
values
  ('55555555-5555-4555-8555-111111111111', 'Falcon FM', 'Facilities', 'https://falconfm.example', null),
  ('55555555-5555-4555-8555-222222222222', 'North M&E', 'M&E', 'https://northme.example', null)
on conflict (id) do nothing;

-- offices
insert into public.offices (id, company_id, name, region, address, phone)
values
  ('66666666-6666-4666-8666-111111111111', '55555555-5555-4555-8555-111111111111', 'London HQ', 'London', '12 Threadneedle St, London', '+44 20 1234 1234'),
  ('66666666-6666-4666-8666-222222222222', '55555555-5555-4555-8555-222222222222', 'Manchester', 'North West', '42 Market St, Manchester', '+44 161 555 1111')
on conflict (id) do nothing;

-- projects
insert into public.projects (id, raw_ingestion_id, title, summary, region, value_numeric, stage, sector, start_date, relevance_tags, fm_score, status, source_ref, source_payload, created_by)
values
  ('77777777-7777-4777-8777-111111111111', '44444444-4444-4444-8444-111111111111', 'Camden Civic Centre', 'Civic centre refurb', 'London', 12000000, 'Pre-qual', 'FM', '2026-06-01', array['FM','Maintenance'], 0.78, 'new', 'GL-1001', '{}'::jsonb, '00000000-0000-0000-0000-000000000001'),
  ('77777777-7777-4777-8777-222222222222', null, 'Manchester Science Park', 'Lab and office expansion', 'North West', 8800000, 'Tender', 'M&E', '2026-05-15', array['M&E'], 0.64, 'review', 'GL-1002', '{}'::jsonb, '00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- project tags
insert into public.project_tags (id, project_id, tag, created_by)
values
  ('88888888-8888-4888-8888-111111111111', '77777777-7777-4777-8777-111111111111', 'priority', '00000000-0000-0000-0000-000000000001'),
  ('88888888-8888-4888-8888-222222222222', '77777777-7777-4777-8777-222222222222', 'lab', '00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- contacts
insert into public.contacts (id, first_name, last_name, job_title, email, phone, company_id, office_id, source_ref, validation_state, confidence_score, duplicate_state, crm_sync_status)
values
  ('99999999-9999-4999-8999-111111111111', 'Jamie', 'Cross', 'FM Manager', 'jamie@falconfm.com', '+44 20 1234 1234', '55555555-5555-4555-8555-111111111111', '66666666-6666-4666-8666-111111111111', 'C-1001', 'verified', 0.90, 'clean', 'not_pushed'),
  ('99999999-9999-4999-8999-222222222222', 'Priya', 'Nair', 'Project Lead', 'priya@northme.com', '+44 161 555 1111', '55555555-5555-4555-8555-222222222222', '66666666-6666-4666-8666-222222222222', 'C-1002', 'needs_review', 0.72, 'unknown', 'not_pushed')
on conflict (id) do nothing;

-- project_contacts
insert into public.project_contacts (id, project_id, contact_id, role, confidence_score)
values
  ('aaaaaaa0-aaaa-4aaa-8aaa-000000000001', '77777777-7777-4777-8777-111111111111', '99999999-9999-4999-8999-111111111111', 'Stakeholder', 0.80),
  ('aaaaaaa0-aaaa-4aaa-8aaa-000000000002', '77777777-7777-4777-8777-222222222222', '99999999-9999-4999-8999-222222222222', 'Lead', 0.75)
on conflict (id) do nothing;

-- opportunity scores
insert into public.opportunity_scores (id, project_id, fm_score, vertical, rationale, computed_at)
values
  ('bbbbbbb0-bbbb-4bbb-8bbb-000000000001', '77777777-7777-4777-8777-111111111111', 0.82, 'FM', 'Keywords match + value band', now()),
  ('bbbbbbb0-bbbb-4bbb-8bbb-000000000002', '77777777-7777-4777-8777-222222222222', 0.70, 'M&E', 'Stage tender with relevant tags', now())
on conflict (id) do nothing;

-- duplicate matches (example pending review)
insert into public.duplicate_matches (id, entity_type, entity_id, candidate_id, score, status)
values
  ('ccccccc0-cccc-4ccc-8ccc-000000000001', 'contact', '99999999-9999-4999-8999-111111111111', '99999999-9999-4999-8999-222222222222', 0.46, 'pending')
on conflict (id) do nothing;

-- crm push jobs and items
insert into public.crm_push_jobs (id, created_by, status, target, summary, created_at)
values
  ('ddddddd0-dddd-4ddd-8ddd-000000000001', '00000000-0000-0000-0000-000000000001', 'queued', 'pipedrive', 'Initial push test', now())
on conflict (id) do nothing;

insert into public.crm_push_job_items (id, job_id, source_entity, source_id, target_type, status, payload)
values
  ('eeeeeee0-eeee-4eee-8eee-000000000001', 'ddddddd0-dddd-4ddd-8ddd-000000000001', 'contact', '99999999-9999-4999-8999-111111111111', 'person', 'queued', jsonb_build_object('action', 'upsert')),
  ('eeeeeee0-eeee-4eee-8eee-000000000002', 'ddddddd0-dddd-4ddd-8ddd-000000000001', 'project', '77777777-7777-4777-8777-111111111111', 'deal', 'queued', jsonb_build_object('action', 'create'))
on conflict (id) do nothing;

insert into public.crm_record_links (id, source_entity, source_id, crm_type, crm_id, last_synced_at)
values
  ('fffffff0-ffff-4fff-8fff-000000000001', 'company', '55555555-5555-4555-8555-111111111111', 'org', 'ORG-101', now())
on conflict (id) do nothing;

-- validation + status history
insert into public.contact_validation_events (id, contact_id, actor_id, from_state, to_state, note)
values
  ('11111110-1111-4111-8111-abcdefabcdef', '99999999-9999-4999-8999-111111111111', '00000000-0000-0000-0000-000000000001', 'unverified', 'verified', 'Verified via Glenigan source')
on conflict (id) do nothing;

insert into public.project_status_history (id, project_id, from_status, to_status, actor_id)
values
  ('22222220-2222-4222-8222-abcdefabcdef', '77777777-7777-4777-8777-111111111111', 'new', 'review', '00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- saved filters & preferences
insert into public.saved_filters (id, owner_id, name, context, config)
values
  ('33333330-3333-4333-8333-abcdefabcdef', '00000000-0000-0000-0000-000000000001', 'High FM', 'projects', jsonb_build_object('fm_score_min', 0.75, 'stage', array['Pre-qual','Tender']))
on conflict (id) do nothing;

insert into public.user_preferences (id, user_id, prefs)
values
  ('44444440-4444-4444-8444-abcdefabcdef', '00000000-0000-0000-0000-000000000002', jsonb_build_object('theme', 'light', 'density', 'comfortable'))
on conflict (id) do nothing;

-- mapping templates
insert into public.field_mapping_templates (id, name, entity, mapping, created_by)
values
  ('55555550-5555-4555-8555-abcdefabcdef', 'Pipedrive default deal', 'deal', jsonb_build_object('title', 'projects.title', 'value', 'projects.value_numeric'), '00000000-0000-0000-0000-000000000001'),
  ('55555550-5555-4555-8555-fedcbafedcba', 'Pipedrive person', 'person', jsonb_build_object('name', 'contacts.full_name', 'email', 'contacts.email'), '00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;
