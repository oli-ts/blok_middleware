-- Enable fast batched contact upserts by source system/reference.
-- PostgreSQL unique indexes still allow multiple null source refs, so manual/null-source contacts remain supported.

create unique index if not exists contacts_source_system_ref_upsert_idx
  on public.contacts(source_system, source_ref);

notify pgrst, 'reload schema';
